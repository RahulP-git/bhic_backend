import { getDb } from "../config/db.js";

const COLLECTION = "distribution_items";

const itemRepo = {
  async create(data) {
    const db = getDb();
    const result = await db.collection(COLLECTION).insertOne({
      ...data,
      createdAt: new Date(),
    });
    return { _id: result.insertedId, ...data };
  },

  async findByDistribution(distributionId) {
    const db = getDb();
    return db.collection(COLLECTION).find({ distributionId }).toArray();
  },

  async update(id, update) {
    const db = getDb();
    return db.collection(COLLECTION).updateOne(
      { _id: id },
      { $set: { ...update, updatedAt: new Date() } }
    );
  },
};

export default itemRepo;