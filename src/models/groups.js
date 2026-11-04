import { getDb } from "../config/db.js";

const COLLECTION = "groups";

const groupRepo = {
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

  async findByManager(userId, filters = {}) {
    const db = getDb();
    const query = { userId, ...filters };
    return db.collection(COLLECTION).find(query).toArray();
  },

  async update(id, update) {
    const db = getDb();
    return db.collection(COLLECTION).updateOne(
      { _id: id },
      { $set: { ...update, updatedAt: new Date() } }
    );
  },

  async updateStatus(id, status) {
    const db = getDb();
    const update = { status, updatedAt: new Date() };
    if (status === "Closed") update.closedAt = new Date();
    return db.collection(COLLECTION).updateOne({ _id: id }, { $set: update });
  },
};

export default groupRepo;