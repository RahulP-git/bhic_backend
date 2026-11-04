import { getDb } from "../config/db.js";

const COLLECTION = "whatsapp_messages";

const whatsappRepo = {
  async create(data) {
    const db = getDb();
    const result = await db.collection(COLLECTION).insertOne({
      ...data,
      createdAt: new Date(),
    });
    return { _id: result.insertedId, ...data };
  },

  async update(id, update) {
    const db = getDb();
    return db.collection(COLLECTION).updateOne(
      { _id: id },
      { $set: { ...update, updatedAt: new Date() } }
    );
  },

  async findByRecipient(memberId) {
    const db = getDb();
    return db.collection(COLLECTION).find({ memberId }).sort({ createdAt: -1 }).toArray();
  },
};

export default whatsappRepo;