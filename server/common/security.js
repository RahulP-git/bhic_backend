import crypto from "node:crypto";

export const hashValue = (value) =>
  crypto.createHash("sha256").update(value).digest("hex");

export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString("hex");

export const createOtpHash = (otp) => hashValue(otp);
