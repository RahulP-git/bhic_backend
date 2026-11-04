import { getDatabase } from "../db/mongo.js";

const collection = () => getDatabase().collection("group_members");
export const createMember = (member) => collection().insertOne(member);
export const findMember = (id, groupId) => collection().findOne({ _id: id, groupId });
export const listMembers = (groupId, filter, skip, limit) => collection().find({ groupId, ...filter }).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray();
export const countMembers = (groupId, filter) => collection().countDocuments({ groupId, ...filter });
export const countActiveMembers = (groupId) => collection().countDocuments({ groupId, membershipStatus: "ACTIVE" });
export const updateMember = (id, updates) => collection().findOneAndUpdate({ _id: id }, { $set: { ...updates, updatedAt: new Date() } }, { returnDocument: "after" });
export const ensureMemberIndexes = () => Promise.all([
  collection().createIndex({ groupId: 1, membershipStatus: 1 }),
  collection().createIndex({ groupId: 1, normalizedPrimaryContact: 1 }, { unique: true }),
]);
