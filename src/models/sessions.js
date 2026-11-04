import { getDb } from "../config/db.js";

const COLLECTION = "sessions";

const sessionRepo = {
  async create(data) {
    const db = getDb();
    const result = await db.collection(COLLECTION).insertOne({
      ...data,
      createdAt: new Date(),
    });
    return { _id: result.insertedId, ...data };
  },

  async findById(id) {
    const db = getDb();
    return db.collection(COLLECTION).findOne({ _id: id });
  },

  async findByRefreshTokenHash(hash) {
    const db = getDb();
    return db.collection(COLLECTION).findOne({ refreshTokenHash: hash });
  },

  async revoke(id) {
    const db = getDb();
    return db.collection(COLLECTION).updateOne(
      { _id: id },
      { $set: { revokedAt: new Date() } }
    );
  },

  async revokeByUser(userId) {
    const db = getDb();
    return db.collection(COLLECTION).updateMany(
      { userId, revokedAt: { $exists: false } },
      { $set: { revokedAt: new Date() } }
    );
  },

  async updateLastUsed(id) {
    const db = getDb();
    return db.collection(COLLECTION).updateOne(
      { _id: id },
      { $set: { lastUsedAt: new Date() } }
    );
  },
};

export default sessionRepo;