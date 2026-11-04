import { getDb } from "../config/db.js";

const COLLECTION = "cycles";

const cycleRepo = {
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

  async findByGroup(groupId) {
    const db = getDb();
    return db.collection(COLLECTION).find({ groupId }).sort({ bhicNumber: 1 }).toArray();
  },

  async findLatestByGroup(groupId) {
    const db = getDb();
    return db.collection(COLLECTION).find({ groupId }).sort({ bhicNumber: -1 }).limit(1).toArray();
  },

  async update(id, update) {
    const db = getDb();
    return db.collection(COLLECTION).updateOne(
      { _id: id },
      { $set: { ...update, updatedAt: new Date() } }
    );
  },

  async checkDuplicateBhicNumber(groupId, bhicNumber) {
    const db = getDb();
    return db.collection(COLLECTION).findOne({ groupId, bhicNumber });
  },
};

export default cycleRepo;