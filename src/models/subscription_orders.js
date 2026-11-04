import { getDb } from "../config/db.js";

const COLLECTION = "subscription_orders";

const orderRepo = {
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

  async findByRazorpayOrder(razorpayOrderId) {
    const db = getDb();
    return db.collection(COLLECTION).findOne({ razorpayOrderId });
  },

  async update(id, update) {
    const db = getDb();
    return db.collection(COLLECTION).updateOne(
      { _id: id },
      { $set: { ...update, updatedAt: new Date() } }
    );
  },

  async findByIdempotencyKey(userId, key) {
    const db = getDb();
    return db.collection(COLLECTION).findOne({ userId, idempotencyKey: key });
  },
};

export default orderRepo;