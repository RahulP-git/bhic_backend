import { createError } from "./errors.js";

// Phone number normalization (basic - assumes E.164 format)
const normalizePhone = (phone) => {
  if (!phone || typeof phone !== "string") {
    throw createError.validation("Phone number is required");
  }
  let cleaned = phone.replace(/[\s()+-]/g, "");
  if (cleaned.startsWith("0")) cleaned = "+91" + cleaned.slice(1);
  if (!cleaned.startsWith("+")) cleaned = "+91" + cleaned;
  const match = cleaned.match(/^\+\d{10,15}$/);
  if (!match) {
    throw createError.validation("Invalid phone number format");
  }
  return cleaned;
};

// Validate name (2-100 chars, letters, spaces, hyphens, apostrophes)
const validateName = (name, field = "name") => {
  if (!name || typeof name !== "string") {
    throw createError.validation(`${field} is required`);
  }
  const trimmed = name.trim();
  if (trimmed.length < 2) {
    throw createError.validation(`${field} must be at least 2 characters`);
  }
  if (trimmed.length > 100) {
    throw createError.validation(`${field} must not exceed 100 characters`);
  }
  if (!/^[a-zA-Z\s-']+$/.test(trimmed)) {
    throw createError.validation(`${field} contains invalid characters`);
  }
  return trimmed;
};

// Validate amount (non-negative, max 2 decimal places)
const validateAmount = (amount, field = "amount", allowNegative = false) => {
  if (amount === undefined || amount === null || amount === "") {
    throw createError.validation(`${field} is required`);
  }
  const num = Number(amount);
  if (isNaN(num) || !isFinite(num)) {
    throw createError.validation(`${field} must be a valid number`);
  }
  if (!allowNegative && num < 0) {
    throw createError.validation(`${field} cannot be negative`);
  }
  // Check decimal places
  const str = String(amount);
  if (str.includes(".") && str.split(".")[1].length > 2) {
    throw createError.validation(`${field} must have at most 2 decimal places`);
  }
  return Number(num.toFixed(2)); // Store and return amounts in rupees
};

// Normalize a stored rupee amount
const normalizeAmount = (amount) => Number(Number(amount).toFixed(2));

// Validate enum
const validateEnum = (value, allowed, field = "value") => {
  if (!allowed.includes(value)) {
    throw createError.validation(
      `${field} must be one of: ${allowed.join(", ")}`
    );
  }
  return value;
};

// Validate date
const validateDate = (date, field = "date") => {
  if (!date) {
    throw createError.validation(`${field} is required`);
  }
  const d = new Date(date);
  if (isNaN(d.getTime())) {
    throw createError.validation(`Invalid ${field} format`);
  }
  return d;
};

// Validate OTP format
const validateOtp = (otp) => {
  if (!otp || typeof otp !== "string") {
    throw createError.validation("OTP is required");
  }
  const trimmed = otp.trim();
  if (!/^\d{6}$/.test(trimmed)) {
    throw createError.validation("OTP must be 6 digits");
  }
  return trimmed;
};

// Validate email
const validateEmail = (email) => {
  if (!email) return null;
  const trimmed = email.trim().toLowerCase();
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!re.test(trimmed)) {
    throw createError.validation("Invalid email format");
  }
  return trimmed;
};

// Validate address
const validateAddress = (address) => {
  if (!address || typeof address !== "string") {
    throw createError.validation("Address is required");
  }
  const trimmed = address.trim();
  if (trimmed.length < 5) {
    throw createError.validation("Address must be at least 5 characters");
  }
  if (trimmed.length > 500) {
    throw createError.validation("Address must not exceed 500 characters");
  }
  return trimmed;
};

// Validate description
const validateDescription = (description) => {
  if (!description) return "";
  if (typeof description !== "string") {
    throw createError.validation("Description must be text");
  }
  const trimmed = description.trim();
  if (trimmed.length > 1000) {
    throw createError.validation("Description must not exceed 1000 characters");
  }
  return trimmed;
};

export {
  normalizePhone,
  validateName,
  validateAmount,
  normalizeAmount,
  validateEnum,
  validateDate,
  validateOtp,
  validateEmail,
  validateAddress,
  validateDescription,
};
