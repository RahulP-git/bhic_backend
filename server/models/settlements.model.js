import { getDatabase } from "../db/mongo.js";

const collection = () => getDatabase().collection("settlements");
export const findSettlement = (cycleId) => collection().findOne({ cycleId, status: "SETTLED" });
export const createSettlement = (item) => collection().insertOne(item);
export const ensureSettlementIndexes = () => collection().createIndex({ cycleId: 1 }, { unique: true });
