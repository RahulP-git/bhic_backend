import { getDb } from "../config/db.js";

const COLLECTION = "cash_collections";

const collectionRepo = {
  async create(data) {
    const db = getDb();
    const result = await db.collection(COLLECTION).insertOne({
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return { _id: result.insertedId, ...data };
  },

  async findById(id) {
    const db = getDb();
    return db.collection(COLLECTION).findOne({ _id: id });
  },

  async findByCycle(cycleId) {
    const db = getDb();
    return db.collection(COLLECTION).find({ cycleId }).sort({ collectedAt: -1 }).toArray();
  },

  async update(id, update) {
    const db = getDb();
    return db.collection(COLLECTION).updateOne(
      { _id: id },
      { $set: { ...update, updatedAt: new Date() } }
    );
  },

  async checkDuplicate(cycleId, memberId, idempotencyKey) {
    const db = getDb();
    return db.collection(COLLECTION).findOne({
      cycleId,
      memberId,
      idempotencyKey,
    });
  },
};

export default collectionRepo;