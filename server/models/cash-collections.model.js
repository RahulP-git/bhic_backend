import { getDatabase } from "../db/mongo.js";

const collection = () => getDatabase().collection("cash_collections");
export const createCollection = (item) => collection().insertOne(item);
export const findCollection = (id, cycleId) => collection().findOne({ _id: id, cycleId });
export const listCollections = (cycleId) => collection().find({ cycleId, status: { $ne: "CORRECTED" } }).sort({ collectedAt: 1 }).toArray();
export const correctCollection = (id, cycleId, updates) => collection().findOneAndUpdate({ _id: id, cycleId }, { $set: { ...updates, updatedAt: new Date() } }, { returnDocument: "after" });
export const ensureCollectionIndexes = () => collection().createIndex({ cycleId: 1, memberId: 1, reference: 1 });
