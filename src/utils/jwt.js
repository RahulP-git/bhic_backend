import jwt from "jsonwebtoken";
import config from "../config/index.js";
import { createError } from "../utils/errors.js";

const ACCESS_TOKEN_EXPIRES = config.jwt.accessExpiresIn;
const REFRESH_TOKEN_EXPIRES = config.jwt.refreshExpiresIn;

// Generate access token
const generateAccessToken = (payload) => {
  return jwt.sign(payload, config.jwt.accessSecret, {
    expiresIn: ACCESS_TOKEN_EXPIRES,
  });
};

// Generate refresh token
const generateRefreshToken = (payload) => {
  return jwt.sign(payload, config.jwt.refreshSecret, {
    expiresIn: REFRESH_TOKEN_EXPIRES,
  });
};

// Verify access token
const verifyAccessToken = (token) => {
  try {
    return jwt.verify(token, config.jwt.accessSecret);
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      throw createError.authExpired("Access token expired");
    }
    throw createError.authRequired("Invalid access token");
  }
};

// Verify refresh token
const verifyRefreshToken = (token) => {
  try {
    return jwt.verify(token, config.jwt.refreshSecret);
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      throw createError.authExpired("Refresh token expired");
    }
    throw createError.authRequired("Invalid refresh token");
  }
};

// Decode token without verification (for debugging)
const decodeToken = (token) => {
  try {
    return jwt.decode(token);
  } catch {
    return null;
  }
};

export {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  decodeToken,
};