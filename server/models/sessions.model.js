import { getDatabase } from "../db/mongo.js";

const collection = () => getDatabase().collection("sessions");

export const createSession = (session) => collection().insertOne(session);
export const findActiveSession = (accessTokenHash) => collection().findOne({
  accessTokenHash,
  revokedAt: { $exists: false },
  expiresAt: { $gt: new Date() },
});
export const findRefreshSession = async (refreshTokenHash, gracePeriodMs = 300000) => {
  const now = new Date();
  const graceStart = new Date(now.getTime() - gracePeriodMs);
  return collection().findOne({
    revokedAt: { $exists: false },
    $or: [
      {
        refreshTokenHash,
        refreshExpiresAt: { $gt: now },
      },
      {
        previousRefreshTokenHash: refreshTokenHash,
        previousRefreshExpiresAt: { $gt: graceStart },
      },
    ],
  });
};
export const rotateSession = (sessionId, updates) => {
  return collection().updateOne(
    { _id: sessionId },
    [
      { $set: {
        ...updates,
        previousRefreshTokenHash: "$refreshTokenHash",
        previousRefreshExpiresAt: "$refreshExpiresAt",
      }}
    ]
  );
};
export const revokeSession = (accessTokenHash) => collection().updateOne(
  { accessTokenHash, revokedAt: { $exists: false } },
  { $set: { revokedAt: new Date() } },
);

export const ensureSessionIndexes = () => Promise.all([
  collection().createIndex({ accessTokenHash: 1 }, { unique: true }),
  collection().createIndex({ refreshTokenHash: 1 }),
  collection().createIndex({ previousRefreshTokenHash: 1 }),
  collection().createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
  collection().createIndex({ userId: 1 }),
]);