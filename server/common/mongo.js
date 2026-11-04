import { ObjectId } from "mongodb";
import { AppError } from "./errors.js";

export const toObjectId = (value, field = "id") => {
  if (!value || !ObjectId.isValid(value)) {
    throw new AppError("VALIDATION_ERROR", `${field} must be a valid identifier`, 400);
  }
  return new ObjectId(value);
};

export const serialize = (value) => {
  if (value instanceof ObjectId) return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(serialize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, serialize(entry)]));
  }
  return value;
};

export const moneyToPaise = (value, field = "amount") => {
  if (typeof value !== "number" && typeof value !== "string") {
    throw new AppError("VALIDATION_ERROR", `${field} must be a number`, 400);
  }
  const text = String(value).trim();
  if (!/^\d+(\.\d{1,2})?$/.test(text)) {
    throw new AppError("VALIDATION_ERROR", `${field} must be a non-negative amount with up to 2 decimals`, 400);
  }
  const paise = Math.round(Number(text) * 100);
  if (!Number.isSafeInteger(paise)) {
    throw new AppError("VALIDATION_ERROR", `${field} is too large`, 400);
  }
  return paise;
};

export const paiseToMoney = (paise) => Number((paise / 100).toFixed(2));

export const parseDate = (value, field) => {
  if (!value || Number.isNaN(new Date(value).getTime())) {
    throw new AppError("VALIDATION_ERROR", `${field} must be a valid date`, 400);
  }
  return new Date(value);
};
