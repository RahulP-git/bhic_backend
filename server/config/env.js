import dotenv from "dotenv";

dotenv.config();

const toPositiveInteger = (value, fallback) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

export const env = {
  port: toPositiveInteger(process.env.PORT, 5000),
  databaseName: process.env.MONGODB_DB_NAME || "bhic",
  mongodbUri: process.env.MONGODB_URI,
  accessTokenTtlMs: toPositiveInteger(process.env.ACCESS_TOKEN_TTL_MS, 15 * 60 * 1000),
  refreshTokenTtlMs: toPositiveInteger(process.env.REFRESH_TOKEN_TTL_MS, 30 * 24 * 60 * 60 * 1000),
  otpTtlMs: toPositiveInteger(process.env.OTP_TTL_MS, 5 * 60 * 1000),
  otpMaxAttempts: toPositiveInteger(process.env.OTP_MAX_ATTEMPTS, 5),
  debugOtp: process.env.DEBUG_OTP || "123456",
  debugOtpEnabled: process.env.AUTH_DEBUG_OTP === "true",
  paymentDebugMode: process.env.PAYMENT_DEBUG_MODE === "true" && process.env.NODE_ENV !== "production",
  nodeEnv: process.env.NODE_ENV || "development",
};

if (!env.mongodbUri) {
  throw new Error("MONGODB_URI is required in .env");
}

if (!/^\d{6}$/.test(env.debugOtp)) {
  throw new Error("DEBUG_OTP must contain exactly 6 digits");
}
