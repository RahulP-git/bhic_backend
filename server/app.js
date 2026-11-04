import express from "express";
import cors from "cors";
import crypto from "node:crypto";
import { env } from "./config/env.js";
import { closeDatabase, connectDatabase } from "./db/mongo.js";
import { errorResponse, successResponse } from "./common/http.js";
import { AppError } from "./common/errors.js";
import { appRouter } from "./modules/app/app.routes.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { usersRouter } from "./modules/users/users.routes.js";
import { bhicRouter } from "./modules/bhic/bhic.routes.js";
import { subscriptionRouter } from "./modules/subscriptions/subscription.routes.js";
import { ensureUserIndexes } from "./models/users.model.js";
import { ensureChallengeIndexes } from "./models/auth-challenges.model.js";
import { ensureSessionIndexes } from "./models/sessions.model.js";
import { ensureSubscriptionIndexes, createPlanIfMissing } from "./models/subscriptions.model.js";

export const createApp = () => {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "1mb" }));
  app.use((req, res, next) => {
    const requestId = req.header("x-request-id") || crypto.randomUUID();
    req.requestId = requestId;
    res.setHeader("x-request-id", requestId);
    next();
  });

  app.get("/api/v1/health", async (req, res, next) => {
    try {
      await connectDatabase();
      successResponse(res, {
        service: "bhic-backend",
        database: env.databaseName,
        message: "Backend and MongoDB are connected",
      });
    } catch (error) {
      next(error);
    }
  });
  app.get("/api/health", async (req, res, next) => {
    try {
      await connectDatabase();
      successResponse(res, { service: "bhic-backend", database: env.databaseName });
    } catch (error) {
      next(error);
    }
  });

  app.use("/api/v1/app", appRouter);
  app.use("/api/v1/auth", authRouter);
  app.use("/api/v1/users", usersRouter);
  app.use("/api/v1/subscriptions", subscriptionRouter);
  app.use("/api/v1", bhicRouter);

  app.use((req, res) => {
    errorResponse(res, new AppError("NOT_FOUND", "API endpoint not found", 404));
  });
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    console.error(error);
    errorResponse(res, error);
  });
  return app;
};

export const startServer = async () => {
  await connectDatabase();
  await Promise.all([ensureUserIndexes(), ensureChallengeIndexes(), ensureSessionIndexes(), ensureSubscriptionIndexes(), createPlanIfMissing()]);
  const app = createApp();
  const server = app.listen(env.port, () => {
    console.log(`Server running at http://localhost:${env.port}`);
    console.log(`API bootstrap: http://localhost:${env.port}/api/v1/app/bootstrap`);
  });

  const shutdown = async (signal) => {
    console.log(`${signal} received, closing server`);
    server.close(async () => {
      await closeDatabase();
      process.exit(0);
    });
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
};
