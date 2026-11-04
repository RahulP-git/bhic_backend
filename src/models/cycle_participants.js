import { getDb } from "../config/db.js";

const COLLECTION = "cycle_participants";

const participantRepo = {
  async create(data) {
    const db = getDb();
    const result = await db.collection(COLLECTION).insertOne({
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return { _id: result.insertedId, ...data };
  },

  async findByCycle(cycleId) {
    const db = getDb();
    return db.collection(COLLECTION).find({ cycleId }).toArray();
  },

  async findByCycleAndMember(cycleId, memberId) {
    const db = getDb();
    return db.collection(COLLECTION).findOne({ cycleId, memberId });
  },

  async update(id, update) {
    const db = getDb();
    return db.collection(COLLECTION).updateOne(
      { _id: id },
      { $set: { ...update, updatedAt: new Date() } }
    );
  },
};

export default participantRepo;