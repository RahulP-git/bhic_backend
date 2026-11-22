import { Router } from "express";
import { asyncHandler, successResponse } from "../../common/http.js";
import { requireAuth } from "../../middleware/auth.js";
import { validateProfileUpdate } from "../../common/validation.js";
import { updateUserProfile } from "../../models/users.model.js";
import { publicUser } from "../auth/auth.service.js";

export const usersRouter = Router();
usersRouter.use(requireAuth);

usersRouter.get("/me", async (req, res) => successResponse(res, await publicUser(req.auth.user)));

usersRouter.patch("/me", asyncHandler(async (req, res) => {
  const updates = validateProfileUpdate(req.body);
  const user = await updateUserProfile(req.auth.user._id, updates);
  successResponse(res, await publicUser(user));
}));
