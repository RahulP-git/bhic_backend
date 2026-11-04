import { getDb } from "../config/db.js";

const COLLECTION = "device_sessions";

const deviceRepo = {
  async create(data) {
    const db = getDb();
    const result = await db.collection(COLLECTION).insertOne({
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return { _id: result.insertedId, ...data };
  },

  async upsert(userId, deviceId, data) {
    const db = getDb();
    return db.collection(COLLECTION).updateOne(
      { userId, deviceId },
      { $set: { ...data, updatedAt: new Date() } },
      { upsert: true }
    );
  },
};

export default deviceRepo;