import { getDatabase } from "../db/mongo.js";

const collection = () => getDatabase().collection("winners");
export const findWinner = (cycleId) => collection().findOne({ cycleId, status: { $ne: "CORRECTED" } });
export const createWinner = (winner) => collection().insertOne(winner);
export const correctWinner = (cycleId, updates) => collection().findOneAndUpdate({ cycleId, status: { $ne: "CORRECTED" } }, { $set: { ...updates, status: "CORRECTED", correctedAt: new Date() } }, { returnDocument: "after" });
export const hasMemberWon = (groupId, memberId) => collection().findOne({ groupId, memberId, status: { $nin: ["CORRECTED", "CANCELLED"] } });
export const ensureWinnerIndexes = () => collection().createIndex({ cycleId: 1, status: 1 });
