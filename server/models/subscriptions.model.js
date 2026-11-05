import { getDatabase } from "../db/mongo.js";

const plans = () => getDatabase().collection("subscription_plans");
const orders = () => getDatabase().collection("subscription_orders");
const subscriptions = () => getDatabase().collection("manager_subscriptions");

export const findPlan = (planId) => plans().findOne({ planId, active: true });
export const createPlanIfMissing = () => plans().updateOne({ planId: "monthly-999" }, { $setOnInsert: { planId: "monthly-999", name: "BHIC Manager Monthly", amount: 999, currency: "INR", billingPeriod: "MONTH", active: true, entitlements: ["GROUP_MANAGEMENT"] } }, { upsert: true });
export const createOrder = (order) => orders().insertOne(order);
export const findOrder = (id, managerId) => orders().findOne({ _id: id, managerId });
export const updateOrder = (id, updates) => orders().findOneAndUpdate({ _id: id }, { $set: { ...updates, updatedAt: new Date() } }, { returnDocument: "after" });
export const findManagerSubscription = (managerId) => subscriptions().findOne({ managerId }, { sort: { updatedAt: -1 } });
export const upsertManagerSubscription = (managerId, value) => subscriptions().findOneAndUpdate({ managerId }, { $set: { ...value, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } }, { upsert: true, returnDocument: "after" });
export const ensureSubscriptionIndexes = () => Promise.all([
  orders().createIndex({ managerId: 1, idempotencyKey: 1 }, { unique: true }),
  orders().createIndex({ providerOrderId: 1 }),
  subscriptions().createIndex({ managerId: 1 }, { unique: true }),
]);
