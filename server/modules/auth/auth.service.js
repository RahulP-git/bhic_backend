import crypto from "node:crypto";
import { env } from "../../config/env.js";
import { AppError } from "../../common/errors.js";
import { createOtpHash, hashValue, randomToken } from "../../common/security.js";
import { normalizeEmail, normalizeMobileNumber, requireString } from "../../common/validation.js";
import {
  createChallenge,
  findChallenge,
  updateChallenge,
} from "../../models/auth-challenges.model.js";
import {
  createUser,
  findUserByEmail,
  findUserByMobile,
  findUserById,
  updateUserAfterLogin,
  updateUserProfile,
} from "../../models/users.model.js";
import {
  createSession,
  findRefreshSession,
  revokeSession,
  rotateSession,
} from "../../models/sessions.model.js";
import { writeAuditLog } from "../../models/audit-logs.model.js";

const getUserForLogin = async (managerName, mobileNumber) => {
  const existingUser = await findUserByMobile(mobileNumber);
  if (existingUser) return existingUser;
  return createUser({ managerName, mobileNumber });
};

const profileState = (user) => {
  const onboardingCompleted = Boolean(user.email && user.emailVerifiedAt && user.address);
  return {
    onboardingCompleted,
    nextStep: onboardingCompleted ? "HOME" : user.email && !user.emailVerifiedAt ? "EMAIL_OTP" : user.email ? "ADDRESS" : "EMAIL",
  };
};

const publicUser = (user) => ({
  id: user._id.toString(),
  managerName: user.managerName,
  fullName: user.managerName,
  mobileNumber: user.mobileNumber,
  email: user.email || null,
  emailVerifiedAt: user.emailVerifiedAt || null,
  address: user.address || null,
  role: user.role,
  status: user.status,
  ...profileState(user),
});

export const requestOtp = async ({ managerName, fullName, mobileNumber, deviceId, requestId }) => {
  const normalizedName = requireString(managerName ?? fullName, "fullName", { min: 2, max: 100 });
  const normalizedMobile = normalizeMobileNumber(mobileNumber);
  const normalizedDeviceId = deviceId
    ? requireString(deviceId, "deviceId", { min: 1, max: 255 })
    : undefined;
  const challengeId = crypto.randomUUID();
  const otp = env.debugOtpEnabled ? env.debugOtp : String(crypto.randomInt(100000, 1000000));
  const now = new Date();
  const expiresAt = new Date(now.getTime() + env.otpTtlMs);

  await createChallenge({
    challengeId,
    mobileNumber: normalizedMobile,
    managerName: normalizedName,
    otpHash: createOtpHash(otp),
    attemptCount: 0,
    deviceId: normalizedDeviceId,
    expiresAt,
    createdAt: now,
    requestId,
  });

  if (env.debugOtpEnabled) {
    console.log(`[OTP DEBUG] otp=${otp}`);
  } else {
    console.log(`OTP challenge created for ${normalizedMobile}: sent through provider`);
  }
  return {
    challengeId,
    expiresAt: expiresAt.toISOString(),
    ...(env.debugOtpEnabled ? { debugOtp: otp } : {}),
  };
};

export const verifyOtp = async ({ challengeId, otp, deviceId, requestId }) => {
  const normalizedChallengeId = requireString(challengeId, "challengeId", { min: 10, max: 100 });
  const normalizedOtp = requireString(otp, "otp", { min: 6, max: 6 });
  if (!/^\d{6}$/.test(normalizedOtp)) {
    throw new AppError("VALIDATION_ERROR", "otp must contain exactly 6 digits", 400);
  }

  const challenge = await findChallenge(normalizedChallengeId);
  if (!challenge) throw new AppError("AUTH_REQUIRED", "OTP challenge is invalid", 401);
  if (challenge.consumedAt) throw new AppError("AUTH_REQUIRED", "OTP challenge has already been used", 401);
  if (challenge.expiresAt <= new Date()) throw new AppError("AUTH_EXPIRED", "OTP challenge has expired", 401);
  if (challenge.attemptCount >= env.otpMaxAttempts) {
    throw new AppError("RATE_LIMITED", "OTP attempt limit exceeded", 429);
  }

  if (hashValue(normalizedOtp) !== challenge.otpHash) {
    await updateChallenge(normalizedChallengeId, { attemptCount: challenge.attemptCount + 1 });
    throw new AppError("AUTH_REQUIRED", "OTP is invalid", 401);
  }

  const user = await getUserForLogin(challenge.managerName, challenge.mobileNumber);
  const updatedUser = await updateUserAfterLogin(user._id, challenge.managerName);
  const accessToken = randomToken();
  const refreshToken = randomToken();
  const now = new Date();

  await updateChallenge(normalizedChallengeId, { consumedAt: now, verifiedAt: now });
  await createSession({
    userId: updatedUser._id,
    deviceId: deviceId || challenge.deviceId,
    accessTokenHash: hashValue(accessToken),
    refreshTokenHash: hashValue(refreshToken),
    issuedAt: now,
    expiresAt: new Date(now.getTime() + env.accessTokenTtlMs),
    refreshExpiresAt: new Date(now.getTime() + env.refreshTokenTtlMs),
    createdAt: now,
  });
  await writeAuditLog({
    actorType: "MANAGER",
    actorId: updatedUser._id,
    action: "MANAGER_LOGIN",
    entityType: "USER",
    entityId: updatedUser._id,
    requestId,
  });

  return {
    accessToken,
    refreshToken,
    expiresIn: Math.floor(env.accessTokenTtlMs / 1000),
    user: publicUser(updatedUser),
  };
};

export const requestEmailOtp = async ({ userId, email, requestId }) => {
  const normalizedEmail = normalizeEmail(email);
  const user = await findUserById(userId);
  if (!user) throw new AppError("AUTH_REQUIRED", "User not found", 401);
  const emailOwner = await findUserByEmail(normalizedEmail);
  if (emailOwner && emailOwner._id.toString() !== userId.toString()) {
    throw new AppError("CONFLICT", "Email address is already in use", 409);
  }

  const challengeId = crypto.randomUUID();
  const otp = env.debugOtpEnabled ? env.debugOtp : String(crypto.randomInt(100000, 1000000));
  const now = new Date();
  const expiresAt = new Date(now.getTime() + env.otpTtlMs);
  await createChallenge({
    challengeId,
    type: "EMAIL",
    userId,
    email: normalizedEmail,
    otpHash: createOtpHash(otp),
    attemptCount: 0,
    expiresAt,
    createdAt: now,
    requestId,
  });
  if (env.debugOtpEnabled) console.log(`[EMAIL OTP DEBUG] otp=${otp}`);
  return { challengeId, expiresAt: expiresAt.toISOString(), ...(env.debugOtpEnabled ? { debugOtp: otp } : {}) };
};

export const verifyEmailOtp = async ({ userId, challengeId, otp }) => {
  const normalizedChallengeId = requireString(challengeId, "challengeId", { min: 10, max: 100 });
  const normalizedOtp = requireString(otp, "otp", { min: 6, max: 6 });
  if (!/^\d{6}$/.test(normalizedOtp)) throw new AppError("VALIDATION_ERROR", "otp must contain exactly 6 digits", 400);
  const challenge = await findChallenge(normalizedChallengeId);
  if (!challenge || challenge.type !== "EMAIL" || challenge.userId.toString() !== userId.toString()) throw new AppError("AUTH_REQUIRED", "Email OTP challenge is invalid", 401);
  if (challenge.consumedAt) throw new AppError("AUTH_REQUIRED", "OTP challenge has already been used", 401);
  if (challenge.expiresAt <= new Date()) throw new AppError("AUTH_EXPIRED", "OTP challenge has expired", 401);
  if (challenge.attemptCount >= env.otpMaxAttempts) throw new AppError("RATE_LIMITED", "OTP attempt limit exceeded", 429);
  if (hashValue(normalizedOtp) !== challenge.otpHash) {
    await updateChallenge(normalizedChallengeId, { attemptCount: challenge.attemptCount + 1 });
    throw new AppError("AUTH_REQUIRED", "OTP is invalid", 401);
  }
  const now = new Date();
  await updateChallenge(normalizedChallengeId, { consumedAt: now, verifiedAt: now });
  const user = await updateUserProfile(userId, { email: challenge.email, emailVerifiedAt: now });
  return { user: publicUser(user) };
};

export const refreshSession = async (refreshToken, requestId) => {
  const session = await findRefreshSession(hashValue(refreshToken));
  if (!session) throw new AppError("AUTH_EXPIRED", "Refresh token is invalid or expired", 401);

  const accessToken = randomToken();
  const nextRefreshToken = randomToken();
  const now = new Date();
  await rotateSession(session._id, {
    accessTokenHash: hashValue(accessToken),
    refreshTokenHash: hashValue(nextRefreshToken),
    issuedAt: now,
    expiresAt: new Date(now.getTime() + env.accessTokenTtlMs),
    refreshExpiresAt: new Date(now.getTime() + env.refreshTokenTtlMs),
  });
  return {
    accessToken,
    refreshToken: nextRefreshToken,
    expiresIn: Math.floor(env.accessTokenTtlMs / 1000),
    user: publicUser(await findUserById(session.userId)),
    requestId,
  };
};

export const logout = async (accessToken, requestId, userId) => {
  await revokeSession(hashValue(accessToken));
  await writeAuditLog({
    actorType: "MANAGER",
    actorId: userId,
    action: "MANAGER_LOGOUT",
    entityType: "USER",
    entityId: userId,
    requestId,
  });
};
