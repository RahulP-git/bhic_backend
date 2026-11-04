import { getDb } from "../config/db.js";

const COLLECTION = "group_members";

const memberRepo = {
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

  async findByGroup(groupId, filters = {}) {
    const db = getDb();
    return db.collection(COLLECTION).find({ groupId, ...filters }).toArray();
  },

  async update(id, update) {
    const db = getDb();
    return db.collection(COLLECTION).updateOne(
      { _id: id },
      { $set: { ...update, updatedAt: new Date() } }
    );
  },

  async checkDuplicate(groupId, primaryContactNumber) {
    const db = getDb();
    return db.collection(COLLECTION).findOne({
      groupId,
      primaryContactNumber,
      membershipStatus: { $ne: "Removed" },
    });
  },
};

export default memberRepo;