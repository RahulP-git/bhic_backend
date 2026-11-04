const requiredEnvVars = [
  "MONGODB_URI",
  "MONGODB_DB_NAME",
  "JWT_ACCESS_SECRET",
  "JWT_REFRESH_SECRET",
];

const missing = requiredEnvVars.filter((v) => !process.env[v]);
if (missing.length > 0) {
  throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
}

const config = {
  mongodb: {
    uri: process.env.MONGODB_URI,
    dbName: process.env.MONGODB_DB_NAME,
  },
  server: {
    port: Number(process.env.PORT || 5000),
    env: process.env.NODE_ENV || "development",
    apiPrefix: process.env.API_PREFIX || "/api/v1",
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "15m",
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
  },
  otp: {
    length: Number(process.env.OTP_LENGTH || 6),
    expiresMinutes: Number(process.env.OTP_EXPIRES_MINUTES || 10),
    maxAttempts: Number(process.env.OTP_MAX_ATTEMPTS || 5),
    debugOtp: process.env.DEBUG_OTP || "123456",
  },
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID,
    keySecret: process.env.RAZORPAY_KEY_SECRET,
  },
  whatsapp: {
    apiUrl: process.env.WHATSAPP_API_URL || "",
    apiToken: process.env.WHATSAPP_API_TOKEN || "",
  },
  fcm: {
    serverKey: process.env.FCM_SERVER_KEY || "",
  },
  scheduler: {
    enabled: process.env.SCHEDULER_ENABLED !== "false",
  },
  defaultTimezone: process.env.DEFAULT_TIMEZONE || "Asia/Kolkata",
  rateLimit: {
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 900000),
    maxRequests: Number(process.env.RATE_LIMIT_MAX_REQUESTS || 100),
  },
  cors: {
    allowedOrigins: (process.env.ALLOWED_ORIGINS || "")
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean),
  },
};

export default config;