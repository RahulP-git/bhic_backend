import { Router } from "express";
import { asyncHandler, successResponse } from "../../common/http.js";
import { requireAuth } from "../../middleware/auth.js";
import { validateProfileUpdate } from "../../common/validation.js";
import { updateUserProfile } from "../../models/users.model.js";

export const usersRouter = Router();
usersRouter.use(requireAuth);

usersRouter.get("/me", (req, res) => {
  const { user } = req.auth;
  successResponse(res, {
    id: user._id.toString(),
    managerName: user.managerName,
    fullName: user.managerName,
    mobileNumber: user.mobileNumber,
    email: user.email || null,
    emailVerifiedAt: user.emailVerifiedAt || null,
    address: user.address || null,
    mobileVerifiedAt: user.mobileVerifiedAt,
    role: user.role,
    status: user.status,
    preferences: user.preferences,
    createdAt: user.createdAt,
    onboardingCompleted: Boolean(user.email && user.emailVerifiedAt && user.address),
    nextStep: user.email && !user.emailVerifiedAt ? "EMAIL_OTP" : user.email ? (user.address ? "HOME" : "ADDRESS") : "EMAIL",
  });
});

usersRouter.patch("/me", asyncHandler(async (req, res) => {
  const updates = validateProfileUpdate(req.body);
  const user = await updateUserProfile(req.auth.user._id, updates);
  successResponse(res, {
    id: user._id.toString(),
    managerName: user.managerName,
    fullName: user.managerName,
    mobileNumber: user.mobileNumber,
    email: user.email || null,
    emailVerifiedAt: user.emailVerifiedAt || null,
    address: user.address || null,
    role: user.role,
    status: user.status,
    preferences: user.preferences,
    updatedAt: user.updatedAt,
    onboardingCompleted: Boolean(user.email && user.emailVerifiedAt && user.address),
    nextStep: user.email && !user.emailVerifiedAt ? "EMAIL_OTP" : user.email ? (user.address ? "HOME" : "ADDRESS") : "EMAIL",
  });
}));
