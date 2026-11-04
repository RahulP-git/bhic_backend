import { getDatabase } from "../db/mongo.js";

const collection = () => getDatabase().collection("groups");
export const createGroup = (group) => collection().insertOne(group);
export const findGroup = (id, managerId) => collection().findOne({ _id: id, managerId });
export const findGroupById = (id) => collection().findOne({ _id: id });
export const listGroups = (managerId, filter, skip, limit) => collection().find({ managerId, ...filter }).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray();
export const countGroups = (managerId, filter) => collection().countDocuments({ managerId, ...filter });
export const updateGroup = (id, updates) => collection().findOneAndUpdate({ _id: id }, { $set: { ...updates, updatedAt: new Date() } }, { returnDocument: "after" });
export const ensureGroupIndexes = () => Promise.all([
  collection().createIndex({ managerId: 1, status: 1 }),
  collection().createIndex({ managerId: 1, name: 1 }),
]);
