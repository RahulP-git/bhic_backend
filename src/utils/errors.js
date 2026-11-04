class AppError extends Error {
  constructor(code, message, status = 500, details = null, retryable = false) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status;
    this.details = details;
    this.retryable = retryable;
    Error.captureStackTrace(this, this.constructor);
  }
}

const ErrorCodes = {
  AUTH_REQUIRED: "AUTH_REQUIRED",
  AUTH_EXPIRED: "AUTH_EXPIRED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  INVALID_STATE: "INVALID_STATE",
  DUPLICATE_REQUEST: "DUPLICATE_REQUEST",
  CONFLICT: "CONFLICT",
  RATE_LIMITED: "RATE_LIMITED",
  PROVIDER_ERROR: "PROVIDER_ERROR",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  OTP_EXPIRED: "OTP_EXPIRED",
  OTP_INVALID: "OTP_INVALID",
  OTP_MAX_ATTEMPTS: "OTP_MAX_ATTEMPTS",
  CHALLENGE_NOT_FOUND: "CHALLENGE_NOT_FOUND",
  SUBSCRIPTION_REQUIRED: "SUBSCRIPTION_REQUIRED",
  SUBSCRIPTION_EXPIRED: "SUBSCRIPTION_EXPIRED",
  PAYMENT_VERIFICATION_FAILED: "PAYMENT_VERIFICATION_FAILED",
  DUPLICATE_MEMBER: "DUPLICATE_MEMBER",
  DUPLICATE_COLLECTION: "DUPLICATE_COLLECTION",
  INVALID_AMOUNT: "INVALID_AMOUNT",
  AMOUNT_MISMATCH: "AMOUNT_MISMATCH",
  MEMBER_NOT_ELIGIBLE: "MEMBER_NOT_ELIGIBLE",
  WINNER_ALREADY_SELECTED: "WINNER_ALREADY_SELECTED",
  CYCLE_INVALID_STATE: "CYCLE_INVALID_STATE",
  LEDGER_UNBALANCED: "LEDGER_UNBALANCED",
  RULE_CONTRADICTION: "RULE_CONTRADICTION",
  WHATSAPP_PROVIDER_ERROR: "WHATSAPP_PROVIDER_ERROR",
};

const createError = {
  authRequired: (msg = "Access token required") =>
    new AppError("AUTH_REQUIRED", msg, 401),
  authExpired: (msg = "Access token expired") =>
    new AppError("AUTH_EXPIRED", msg, 401),
  forbidden: (msg = "Forbidden") => new AppError("FORBIDDEN", msg, 403),
  notFound: (resource = "Resource") =>
    new AppError("NOT_FOUND", `${resource} not found`, 404),
  validation: (msg, details = null) =>
    new AppError("VALIDATION_ERROR", msg, 400, details),
  invalidState: (msg) => new AppError("INVALID_STATE", msg, 409),
  conflict: (msg) => new AppError("CONFLICT", msg, 409),
  rateLimited: (msg = "Too many requests") =>
    new AppError("RATE_LIMITED", msg, 429, null, true),
  providerError: (msg, provider = "Provider") =>
    new AppError("PROVIDER_ERROR", `${provider}: ${msg}`, 502, null, true),
  internal: (msg = "Internal server error") =>
    new AppError("INTERNAL_ERROR", msg, 500, null, true),
  otpExpired: () =>
    new AppError("OTP_EXPIRED", "OTP has expired", 400),
  otpInvalid: () =>
    new AppError("OTP_INVALID", "Invalid OTP", 400),
  otpMaxAttempts: () =>
    new AppError("OTP_MAX_ATTEMPTS", "Maximum OTP attempts exceeded", 429),
  challengeNotFound: () =>
    new AppError("CHALLENGE_NOT_FOUND", "OTP challenge not found", 404),
  subscriptionRequired: () =>
    new AppError("SUBSCRIPTION_REQUIRED", "Active subscription required", 403),
  subscriptionExpired: () =>
    new AppError("SUBSCRIPTION_EXPIRED", "Subscription has expired", 403),
  paymentVerificationFailed: (msg) =>
    new AppError("PAYMENT_VERIFICATION_FAILED", msg, 400),
  duplicateMember: () =>
    new AppError("DUPLICATE_MEMBER", "Member already exists in this group", 409),
  duplicateCollection: () =>
    new AppError("DUPLICATE_COLLECTION", "Collection already recorded", 409),
  invalidAmount: (msg = "Invalid amount") =>
    new AppError("INVALID_AMOUNT", msg, 400),
  amountMismatch: (msg) =>
    new AppError("AMOUNT_MISMATCH", msg, 400),
  memberNotEligible: () =>
    new AppError("MEMBER_NOT_ELIGIBLE", "Member is not eligible for winner selection", 400),
  winnerAlreadySelected: () =>
    new AppError("WINNER_ALREADY_SELECTED", "Winner already selected for this cycle", 409),
  cycleInvalidState: (msg) =>
    new AppError("CYCLE_INVALID_STATE", msg, 409),
  ledgerUnbalanced: (msg) =>
    new AppError("LEDGER_UNBALANCED", msg, 409),
  ruleContradiction: (msg) =>
    new AppError("RULE_CONTRADICTION", msg, 400),
  whatsappProviderError: (msg) =>
    new AppError("WHATSAPP_PROVIDER_ERROR", msg, 502, null, true),
};

export { AppError, ErrorCodes, createError };