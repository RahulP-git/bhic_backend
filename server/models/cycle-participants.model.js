import { getDatabase } from "../db/mongo.js";

const collection = () => getDatabase().collection("cycle_participants");
export const createParticipants = (items) => collection().insertMany(items, { ordered: true });
export const listParticipants = (cycleId) => collection().find({ cycleId }).toArray();
export const findParticipant = (cycleId, memberId) => collection().findOne({ cycleId, memberId });
export const updateParticipant = (cycleId, memberId, updates) => collection().findOneAndUpdate({ cycleId, memberId }, { $set: { ...updates, updatedAt: new Date() } }, { returnDocument: "after" });
export const ensureParticipantIndexes = () => collection().createIndex({ cycleId: 1, memberId: 1 }, { unique: true });
