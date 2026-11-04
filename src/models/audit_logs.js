import { getDb } from "../config/db.js";

const COLLECTION = "audit_logs";

const auditRepo = {
  async create(data) {
    const db = getDb();
    const result = await db.collection(COLLECTION).insertOne({
      ...data,
      createdAt: new Date(),
    });
    return { _id: result.insertedId, ...data };
  },

  async findByEntity(entityType, entityId) {
    const db = getDb();
    return db.collection(COLLECTION).find({ entityType, entityId }).sort({ createdAt: -1 }).toArray();
  },

  async findByActor(actorId) {
    const db = getDb();
    return db.collection(COLLECTION).find({ actorId }).sort({ createdAt: -1 }).limit(100).toArray();
  },
};

export default auditRepo;