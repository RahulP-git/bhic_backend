import { Router } from "express";
import { asyncHandler, successResponse } from "../../common/http.js";
import { AppError } from "../../common/errors.js";
import { requireAuth } from "../../middleware/auth.js";
import { logout, refreshSession, requestOtp, verifyOtp } from "./auth.service.js";

export const authRouter = Router();

authRouter.post("/login/request-otp", asyncHandler(async (req, res) => {
  const data = await requestOtp({ ...req.body, requestId: req.requestId });
  successResponse(res, data, 201);
}));

authRouter.post("/login/verify-otp", asyncHandler(async (req, res) => {
  const data = await verifyOtp({ ...req.body, requestId: req.requestId });
  successResponse(res, data);
}));

authRouter.post("/refresh", asyncHandler(async (req, res) => {
  if (typeof req.body?.refreshToken !== "string") {
    throw new AppError("VALIDATION_ERROR", "refreshToken is required", 400);
  }
  const data = await refreshSession(req.body.refreshToken, req.requestId);
  successResponse(res, data);
}));

authRouter.post("/logout", requireAuth, asyncHandler(async (req, res) => {
  await logout(req.auth.accessToken, req.requestId, req.auth.user._id);
  successResponse(res, { loggedOut: true });
}));
