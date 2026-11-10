import { validationError } from "./errors.js";

const MOBILE_PATTERN = /^\+[1-9]\d{7,14}$/;

export const requireString = (value, field, { min = 1, max = 255 } = {}) => {
  if (typeof value !== "string") {
    throw validationError(`${field} must be a string`, { field });
  }
  const trimmed = value.trim();
  if (trimmed.length < min || trimmed.length > max) {
    throw validationError(`${field} must contain between ${min} and ${max} characters`, { field });
  }
  return trimmed;
};

export const normalizeMobileNumber = (value) => {
  const mobileNumber = requireString(value, "mobileNumber", { min: 8, max: 16 })
    .replace(/[\s()-]/g, "");
  if (!MOBILE_PATTERN.test(mobileNumber)) {
    throw validationError("mobileNumber must use international format, for example +919876543210", {
      field: "mobileNumber",
    });
  }
  return mobileNumber;
};

export const normalizeEmail = (value) => {
  const email = requireString(value, "email", { min: 5, max: 255 }).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw validationError("email must be a valid email address", { field: "email" });
  }
  return email;
};

export const optionalString = (value, field, options) => {
  if (value === undefined || value === null) return undefined;
  return requireString(value, field, options);
};

export const validateProfileUpdate = (body) => {
  const updates = {};
  if (body.managerName !== undefined || body.fullName !== undefined) {
    updates.managerName = requireString(body.managerName ?? body.fullName, "fullName", { min: 2, max: 100 });
  }
  if (body.address !== undefined) {
    updates.address = requireString(body.address, "address", { min: 5, max: 1000 });
  }
  if (body.preferences !== undefined) {
    if (!body.preferences || typeof body.preferences !== "object" || Array.isArray(body.preferences)) {
      throw validationError("preferences must be an object", { field: "preferences" });
    }
    updates.preferences = body.preferences;
  }
  if (Object.keys(updates).length === 0) {
    throw validationError("At least one profile field is required");
  }
  return updates;
};
