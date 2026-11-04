import { getDb } from "../config/db.js";

const COLLECTION = "idempotency_keys";

const idempotencyRepo = {
  async create(data) {
    const db = getDb();
    const result = await db.collection(COLLECTION).insertOne({
      ...data,
      createdAt: new Date(),
    });
    return { _id: result.insertedId, ...data };
  },

  async findByKey(userId, key) {
    const db = getDb();
    return db.collection(COLLECTION).findOne({ userId, key });
  },

  async deleteExpired() {
    const db = getDb();
    return db.collection(COLLECTION).deleteMany({
      expiresAt: { $lt: new Date() },
    });
  },
};

export default idempotencyRepo;