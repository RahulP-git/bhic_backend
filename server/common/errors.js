export class AppError extends Error {
  constructor(code, message, status = 500, details) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export const validationError = (message, details) =>
  new AppError("VALIDATION_ERROR", message, 400, details);
