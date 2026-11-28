import dotenv from "dotenv";

dotenv.config();

const toPositiveInteger = (value, fallback) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const oneYearMs = 365 * 24 * 60 * 60 * 1000;

export const env = {
  port: toPositiveInteger(process.env.PORT, 5000),
  databaseName: process.env.MONGODB_DB_NAME || "bhic",
  mongodbUri: process.env.MONGODB_URI,
  accessTokenTtlMs: toPositiveInteger(process.env.ACCESS_TOKEN_TTL_MS, 15 * 60 * 1000),
  refreshTokenTtlMs: Math.max(toPositiveInteger(process.env.REFRESH_TOKEN_TTL_MS, oneYearMs), oneYearMs),
  otpTtlMs: toPositiveInteger(process.env.OTP_TTL_MS, 5 * 60 * 1000),
  otpMaxAttempts: toPositiveInteger(process.env.OTP_MAX_ATTEMPTS, 5),
  debugOtp: process.env.DEBUG_OTP || "123456",
  debugOtpEnabled: process.env.AUTH_DEBUG_OTP === "true",
  paymentDebugMode: process.env.PAYMENT_DEBUG_MODE === "true" && process.env.NODE_ENV !== "production",
  nodeEnv: process.env.NODE_ENV || "development",
  schedulerEnabled: process.env.SCHEDULER_ENABLED !== "false",
  schedulerCron: process.env.SCHEDULER_CRON || "*/5 * * * *",
  fcmEnabled: process.env.FCM_ENABLED === "true",
  fcmProjectId: process.env.FCM_PROJECT_ID || null,
};

if (!env.mongodbUri) {
  throw new Error("MONGODB_URI is required in .env");
}

if (!/^\d{6}$/.test(env.debugOtp)) {
  throw new Error("DEBUG_OTP must contain exactly 6 digits");
}
