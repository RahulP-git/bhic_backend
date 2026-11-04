import { getDb } from "../config/db.js";

const COLLECTION = "auth_challenges";

const challengeRepo = {
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

  async consume(id) {
    const db = getDb();
    return db.collection(COLLECTION).updateOne(
      { _id: id },
      { $set: { consumedAt: new Date() } }
    );
  },

  async incrementAttempts(id) {
    const db = getDb();
    return db.collection(COLLECTION).updateOne(
      { _id: id },
      { $inc: { attemptCount: 1 } }
    );
  },

  async deleteExpired() {
    const db = getDb();
    return db.collection(COLLECTION).deleteMany({
      expiresAt: { $lt: new Date() },
    });
  },
};

export default challengeRepo;