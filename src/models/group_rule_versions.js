import { getDb } from "../config/db.js";

const COLLECTION = "group_rule_versions";

const ruleRepo = {
  async create(data) {
    const db = getDb();
    const result = await db.collection(COLLECTION).insertOne({
      ...data,
      createdAt: new Date(),
    });
    return { _id: result.insertedId, ...data };
  },

  async findByGroup(groupId) {
    const db = getDb();
    return db.collection(COLLECTION).find({ groupId }).sort({ versionNumber: -1 }).toArray();
  },

  async findActiveByGroup(groupId) {
    const db = getDb();
    return db.collection(COLLECTION).findOne({ groupId, isActive: true }, { sort: { versionNumber: -1 } });
  },
};

export default ruleRepo;