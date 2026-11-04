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
    mobileNumber: user.mobileNumber,
    mobileVerifiedAt: user.mobileVerifiedAt,
    role: user.role,
    status: user.status,
    preferences: user.preferences,
    createdAt: user.createdAt,
  });
});

usersRouter.patch("/me", asyncHandler(async (req, res) => {
  const updates = validateProfileUpdate(req.body);
  const user = await updateUserProfile(req.auth.user._id, updates);
  successResponse(res, {
    id: user._id.toString(),
    managerName: user.managerName,
    mobileNumber: user.mobileNumber,
    role: user.role,
    status: user.status,
    preferences: user.preferences,
    updatedAt: user.updatedAt,
  });
}));
