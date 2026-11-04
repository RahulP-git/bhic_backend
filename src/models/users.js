import { getDb } from "../config/db.js";

const COLLECTION = "users";

const userRepo = {
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

  async findByMobile(mobileNumber) {
    const db = getDb();
    return db.collection(COLLECTION).findOne({ mobileNumber });
  },

  async update(id, update) {
    const db = getDb();
    const result = await db.collection(COLLECTION).updateOne(
      { _id: id },
      { $set: { ...update, updatedAt: new Date() } }
    );
    return result.modifiedCount > 0;
  },

  async upsertByMobile(mobileNumber, data) {
    const db = getDb();
    const result = await db.collection(COLLECTION).updateOne(
      { mobileNumber },
      { $setOnInsert: { ...data, createdAt: new Date() }, $set: { ...data, updatedAt: new Date() } },
      { upsert: true }
    );
    return result;
  },
};

export default userRepo;
