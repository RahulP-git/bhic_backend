import { getDatabase } from "../db/mongo.js";

const collection = () => getDatabase().collection("notifications");
export const createNotification = (item) => collection().insertOne(item);
export const listNotifications = (userId, skip, limit) => collection().find({ recipientUserId: userId }).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray();
export const countNotifications = (userId) => collection().countDocuments({ recipientUserId: userId });
export const markNotificationRead = (id, userId) => collection().findOneAndUpdate({ _id: id, recipientUserId: userId }, { $set: { readAt: new Date() } }, { returnDocument: "after" });
export const markAllNotificationsRead = (userId) => collection().updateMany({ recipientUserId: userId, readAt: { $exists: false } }, { $set: { readAt: new Date() } });
export const ensureNotificationIndexes = () => collection().createIndex({ recipientUserId: 1, createdAt: -1 });
