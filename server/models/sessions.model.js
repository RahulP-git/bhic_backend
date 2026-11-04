import { getDatabase } from "../db/mongo.js";

const collection = () => getDatabase().collection("sessions");

export const createSession = (session) => collection().insertOne(session);
export const findActiveSession = (accessTokenHash) => collection().findOne({
  accessTokenHash,
  revokedAt: { $exists: false },
  expiresAt: { $gt: new Date() },
});
export const findRefreshSession = (refreshTokenHash) => collection().findOne({
  refreshTokenHash,
  revokedAt: { $exists: false },
  refreshExpiresAt: { $gt: new Date() },
});
export const rotateSession = (sessionId, updates) =>
  collection().updateOne({ _id: sessionId }, { $set: updates });
export const revokeSession = (accessTokenHash) => collection().updateOne(
  { accessTokenHash, revokedAt: { $exists: false } },
  { $set: { revokedAt: new Date() } },
);

export const ensureSessionIndexes = () => Promise.all([
  collection().createIndex({ accessTokenHash: 1 }, { unique: true }),
  collection().createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
  collection().createIndex({ userId: 1 }),
]);
