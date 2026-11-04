import { getDb } from "../config/db.js";

const COLLECTION = "notifications";

const notificationRepo = {
  async create(data) {
    const db = getDb();
    const result = await db.collection(COLLECTION).insertOne({
      ...data,
      createdAt: new Date(),
    });
    return { _id: result.insertedId, ...data };
  },

  async findByRecipient(userId, filters = {}) {
    const db = getDb();
    return db.collection(COLLECTION).find({ recipientId: userId, ...filters }).sort({ createdAt: -1 }).toArray();
  },

  async markRead(id) {
    const db = getDb();
    return db.collection(COLLECTION).updateOne(
      { _id: id },
      { $set: { readAt: new Date() } }
    );
  },

  async markAllRead(userId) {
    const db = getDb();
    return db.collection(COLLECTION).updateMany(
      { recipientId: userId, readAt: { $exists: false } },
      { $set: { readAt: new Date() } }
    );
  },
};

export default notificationRepo;