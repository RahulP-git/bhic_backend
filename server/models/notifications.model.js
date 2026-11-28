import { getDatabase } from "../db/mongo.js";

const collection = () => getDatabase().collection("notifications");
export const createNotification = (item) => collection().insertOne(item);
export const createNotificationIfMissing = async (item) => {
  const existing = await collection().findOne({ dedupeKey: item.dedupeKey });
  if (existing) return { notification: existing, created: false };
  const result = await collection().findOneAndUpdate(
    { dedupeKey: item.dedupeKey },
    { $setOnInsert: item },
    { upsert: true, returnDocument: "after" },
  );
  return { notification: result.value || result, created: true };
};
export const listNotifications = (userId, skip, limit) => collection().find({ recipientUserId: userId }).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray();
export const countNotifications = (userId) => collection().countDocuments({ recipientUserId: userId });
export const markNotificationRead = (id, userId) => collection().findOneAndUpdate({ _id: id, recipientUserId: userId }, { $set: { readAt: new Date() } }, { returnDocument: "after" });
export const markAllNotificationsRead = (userId) => collection().updateMany({ recipientUserId: userId, readAt: { $exists: false } }, { $set: { readAt: new Date() } });
export const ensureNotificationIndexes = () => Promise.all([
  collection().createIndex({ recipientUserId: 1, createdAt: -1 }),
  collection().createIndex({ dedupeKey: 1 }, { unique: true, sparse: true }),
]);
