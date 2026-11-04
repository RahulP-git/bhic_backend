import { getDatabase } from "../db/mongo.js";

const collection = () => getDatabase().collection("distributions");
const items = () => getDatabase().collection("distribution_items");
export const findDistribution = (cycleId) => collection().findOne({ cycleId });
export const createDistribution = (item) => collection().insertOne(item);
export const updateDistribution = (cycleId, updates) => collection().findOneAndUpdate({ cycleId }, { $set: { ...updates, updatedAt: new Date() } }, { returnDocument: "after" });
export const createDistributionItems = (records) => items().insertMany(records, { ordered: true });
export const listDistributionItems = (distributionId) => items().find({ distributionId }).sort({ memberId: 1 }).toArray();
export const ensureDistributionIndexes = () => Promise.all([
  collection().createIndex({ cycleId: 1 }, { unique: true }),
  items().createIndex({ distributionId: 1, memberId: 1 }, { unique: true }),
]);
