import { getDatabase } from "../db/mongo.js";

const collection = () => getDatabase().collection("users");

export const findUserByMobile = (mobileNumber) => collection().findOne({ mobileNumber });
export const findUserById = (userId) => collection().findOne({ _id: userId });

export const createUser = async ({ managerName, mobileNumber }) => {
  const now = new Date();
  const user = {
    managerName,
    mobileNumber,
    mobileVerifiedAt: now,
    role: "MANAGER",
    status: "ACTIVE",
    preferences: {},
    createdAt: now,
    updatedAt: now,
    lastLoginAt: now,
  };
  const result = await collection().insertOne(user);
  return { ...user, _id: result.insertedId };
};

export const updateUserAfterLogin = async (userId, managerName) => {
  const now = new Date();
  await collection().updateOne(
    { _id: userId },
    { $set: { managerName, mobileVerifiedAt: now, lastLoginAt: now, updatedAt: now } },
  );
  return collection().findOne({ _id: userId });
};

export const updateUserProfile = async (userId, updates) => {
  await collection().updateOne(
    { _id: userId },
    { $set: { ...updates, updatedAt: new Date() } },
  );
  return collection().findOne({ _id: userId });
};

export const ensureUserIndexes = () =>
  collection().createIndex({ mobileNumber: 1 }, { unique: true });
