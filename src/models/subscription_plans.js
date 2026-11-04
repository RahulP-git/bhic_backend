import { getDb } from "../config/db.js";

const COLLECTION = "subscription_plans";

const planRepo = {
  async create(data) {
    const db = getDb();
    const result = await db.collection(COLLECTION).insertOne({
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return { _id: result.insertedId, ...data };
  },

  async findActive() {
    const db = getDb();
    return db.collection(COLLECTION).find({ isActive: true }).toArray();
  },

  async findById(id) {
    const db = getDb();
    return db.collection(COLLECTION).findOne({ _id: id });
  },

  async getDefault() {
    const db = getDb();
    return db.collection(COLLECTION).findOne({ isActive: true, isDefault: true });
  },
};

export default planRepo;