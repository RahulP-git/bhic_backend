import crypto from "node:crypto";
import { Router } from "express";
import { asyncHandler, successResponse } from "../../common/http.js";
import { AppError } from "../../common/errors.js";
import { toObjectId } from "../../common/mongo.js";
import { requireAuth } from "../../middleware/auth.js";
import { env } from "../../config/env.js";
import { getDatabase } from "../../db/mongo.js";
import { createPlanIfMissing, createOrder, findManagerSubscription, findOrder, findPlan, updateOrder, upsertManagerSubscription } from "../../models/subscriptions.model.js";

export const subscriptionRouter = Router();
subscriptionRouter.use(requireAuth);

subscriptionRouter.post("/orders", asyncHandler(async (req, res) => {
  const planId = req.body?.planId || "monthly-999";
  const idempotencyKey = req.header("idempotency-key") || req.body?.idempotencyKey;
  if (!idempotencyKey || typeof idempotencyKey !== "string") throw new AppError("VALIDATION_ERROR", "idempotencyKey is required", 400);
  await createPlanIfMissing();
  const plan = await findPlan(planId);
  if (!plan) throw new AppError("NOT_FOUND", "Subscription plan not found", 404);
  const existing = await getDatabase().collection("subscription_orders").findOne({ managerId: req.auth.user._id, idempotencyKey });
  if (existing) return successResponse(res, { localOrderId: existing._id.toString(), providerOrderId: existing.providerOrderId, amount: existing.amount / 100, currency: existing.currency, status: existing.status });
  if (!env.paymentDebugMode && (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET)) throw new AppError("PROVIDER_ERROR", "Razorpay credentials are not configured", 502);
  const localOrderId = crypto.randomUUID();
  const providerOrderId = env.paymentDebugMode ? `debug_order_${crypto.randomUUID()}` : `razorpay_order_${crypto.randomUUID()}`;
  const order = { managerId: req.auth.user._id, planId: plan.planId, amount: plan.amount, currency: plan.currency, providerOrderId, status: "CREATED", idempotencyKey, createdAt: new Date(), updatedAt: new Date(), localOrderId };
  const result = await createOrder(order);
  successResponse(res, { localOrderId: result.insertedId.toString(), providerOrderId, amount: plan.amount / 100, currency: plan.currency, status: order.status, debugMode: env.paymentDebugMode }, 201);
}));

subscriptionRouter.post("/payments/verify", asyncHandler(async (req, res) => {
  const localOrderId = req.body?.localOrderId;
  if (!localOrderId) throw new AppError("VALIDATION_ERROR", "localOrderId is required", 400);
  const order = await findOrder(toObjectId(localOrderId, "localOrderId"), req.auth.user._id);
  if (!order) throw new AppError("NOT_FOUND", "Subscription order not found", 404);
  if (order.status === "PAID") return successResponse(res, await findManagerSubscription(req.auth.user._id));
  if (!env.paymentDebugMode) throw new AppError("PROVIDER_ERROR", "Production payment verification requires Razorpay integration", 502);
  if (!req.body.paymentId || !req.body.signature) throw new AppError("VALIDATION_ERROR", "paymentId and signature are required", 400);
  const updatedOrder = await updateOrder(order._id, { status: "PAID", providerPaymentId: req.body.paymentId, signatureVerified: true, paidAt: new Date() });
  const expiresAt = new Date();
  expiresAt.setUTCMonth(expiresAt.getUTCMonth() + 1);
  const subscription = await upsertManagerSubscription(req.auth.user._id, { planId: order.planId, status: "ACTIVE", startedAt: new Date(), expiresAt, lastPaymentId: req.body.paymentId });
  successResponse(res, { order: updatedOrder.value || updatedOrder, subscription: subscription.value || subscription });
}));

subscriptionRouter.get("/me", asyncHandler(async (req, res) => successResponse(res, await findManagerSubscription(req.auth.user._id))));

subscriptionRouter.post("/webhooks/razorpay", asyncHandler(async (req, res) => {
  if (!env.paymentDebugMode) throw new AppError("PROVIDER_ERROR", "Razorpay webhook integration is not configured", 502);
  successResponse(res, { received: true, mode: "debug" });
}));
