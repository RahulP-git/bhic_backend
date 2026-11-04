import { getDb } from "../config/db.js";

const COLLECTION = "manager_subscriptions";

const managerSubRepo = {
  async create(data) {
    const db = getDb();
    const result = await db.collection(COLLECTION).insertOne({
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return { _id: result.insertedId, ...data };
  },

  async findByUser(userId) {
    const db = getDb();
    return db.collection(COLLECTION).find({ userId }).sort({ createdAt: -1 }).toArray();
  },

  async findActiveByUser(userId) {
    const db = getDb();
    return db.collection(COLLECTION).findOne({
      userId,
      status: "Active",
      expiresAt: { $gt: new Date() },
    });
  },

  async update(id, update) {
    const db = getDb();
    return db.collection(COLLECTION).updateOne(
      { _id: id },
      { $set: { ...update, updatedAt: new Date() } }
    );
  },
};

export default managerSubRepo;