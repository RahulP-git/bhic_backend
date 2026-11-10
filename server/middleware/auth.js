import { findUserById } from "../models/users.model.js";
import { findActiveSession } from "../models/sessions.model.js";
import { hashValue } from "../common/security.js";
import { AppError } from "../common/errors.js";

const log = (message, meta = {}) => {
  console.log(`[AUTH_MW] ${message} ${JSON.stringify(meta)}`);
};

export const requireAuth = async (req, res, next) => {
  try {
    const authorization = req.header("authorization") || "";
    const [scheme, token] = authorization.split(" ");
    if (scheme !== "Bearer" || !token) {
      log("AUTH_REQUIRED", { path: req.path, reason: "missing_or_invalid_authorization_header" });
      throw new AppError("AUTH_REQUIRED", "A Bearer access token is required", 401);
    }

    const hashedToken = hashValue(token);
    const session = await findActiveSession(hashedToken);
    if (!session) {
      log("AUTH_EXPIRED", { path: req.path, reason: "session_not_found_or_expired", tokenPrefix: hashedToken.substring(0, 16) });
      throw new AppError("AUTH_EXPIRED", "Access token is invalid or expired", 401);
    }

    const user = await findUserById(session.userId);
    if (!user || user.status !== "ACTIVE" || user.role !== "MANAGER") {
      log("FORBIDDEN", { path: req.path, userId: session.userId.toString(), status: user?.status, role: user?.role });
      throw new AppError("FORBIDDEN", "Manager access is required", 403);
    }

    log("AUTH_OK", { path: req.path, userId: user._id.toString() });
    req.auth = { session, user, accessToken: token };
    next();
  } catch (error) {
    next(error);
  }
};
