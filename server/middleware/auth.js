import { findUserById } from "../models/users.model.js";
import { findActiveSession } from "../models/sessions.model.js";
import { hashValue } from "../common/security.js";
import { AppError } from "../common/errors.js";

export const requireAuth = async (req, res, next) => {
  try {
    const authorization = req.header("authorization") || "";
    const [scheme, token] = authorization.split(" ");
    if (scheme !== "Bearer" || !token) {
      throw new AppError("AUTH_REQUIRED", "A Bearer access token is required", 401);
    }

    const session = await findActiveSession(hashValue(token));
    if (!session) {
      throw new AppError("AUTH_EXPIRED", "Access token is invalid or expired", 401);
    }

    const user = await findUserById(session.userId);
    if (!user || user.status !== "ACTIVE" || user.role !== "MANAGER") {
      throw new AppError("FORBIDDEN", "Manager access is required", 403);
    }

    req.auth = { session, user, accessToken: token };
    next();
  } catch (error) {
    next(error);
  }
};
