import { getDatabase } from "../db/mongo.js";

const collection = () => getDatabase().collection("cycles");
export const createCycles = (cycles) => collection().insertMany(cycles, { ordered: true });
export const findCycle = (id) => collection().findOne({ _id: id });
export const listCycles = (groupId) => collection().find({ groupId }).sort({ bhicNumber: 1 }).toArray();
export const updateCycle = (id, updates) => collection().findOneAndUpdate({ _id: id }, { $set: { ...updates, updatedAt: new Date() } }, { returnDocument: "after" });
export const ensureCycleIndexes = () => Promise.all([
  collection().createIndex({ groupId: 1, bhicNumber: 1 }, { unique: true }),
  collection().createIndex({ groupId: 1, status: 1 }),
]);
