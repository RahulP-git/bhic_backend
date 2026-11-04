import crypto from "node:crypto";
import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

// Hash a plain text value (OTP, refresh token, etc.)
const hashValue = async (plainText) => {
  return bcrypt.hash(plainText, SALT_ROUNDS);
};

// Compare plain text with hash
const compareHash = async (plainText, hash) => {
  return bcrypt.compare(plainText, hash);
};

// Generate a random token
const generateToken = (length = 32) => {
  return crypto.randomBytes(length).toString("hex");
};

// Generate a UUID
const generateUuid = () => {
  return crypto.randomUUID();
};

// Generate a numeric OTP
const generateOtp = (length = 6) => {
  let otp = "";
  for (let i = 0; i < length; i++) {
    otp += Math.floor(Math.random() * 10);
  }
  return otp;
};

// Generate SHA-256 hash (for idempotency keys, etc.)
const sha256 = (data) => {
  return crypto.createHash("sha256").update(data).digest("hex");
};

export { hashValue, compareHash, generateToken, generateUuid, generateOtp, sha256 };