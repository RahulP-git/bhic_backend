import { Router } from "express";
import { successResponse } from "../../common/http.js";
import { env } from "../../config/env.js";

export const appRouter = Router();

appRouter.get("/bootstrap", (req, res) => {
  successResponse(res, {
    service: "bhic-backend",
    apiVersion: "v1",
    environment: env.nodeEnv,
    authentication: { managerOtp: true, debugOtp: env.debugOtpEnabled },
    serverTime: new Date().toISOString(),
  });
});
