import { getDatabase } from "../db/mongo.js";

const collection = () => getDatabase().collection("auth_challenges");

export const createChallenge = (challenge) => collection().insertOne(challenge);
export const findChallenge = (challengeId) => collection().findOne({ challengeId });
export const updateChallenge = (challengeId, updates) =>
  collection().updateOne({ challengeId }, { $set: updates });

export const ensureChallengeIndexes = () => Promise.all([
  collection().createIndex({ challengeId: 1 }, { unique: true }),
  collection().createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
]);
