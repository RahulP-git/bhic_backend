import { getDb } from "../config/db.js";

const COLLECTION = "subscription_payments";

const paymentRepo = {
  async create(data) {
    const db = getDb();
    const result = await db.collection(COLLECTION).insertOne({
      ...data,
      createdAt: new Date(),
    });
    return { _id: result.insertedId, ...data };
  },

  async findByRazorpayPaymentId(paymentId) {
    const db = getDb();
    return db.collection(COLLECTION).findOne({ razorpayPaymentId: paymentId });
  },

  async update(id, update) {
    const db = getDb();
    return db.collection(COLLECTION).updateOne(
      { _id: id },
      { $set: { ...update, updatedAt: new Date() } }
    );
  },
};

export default paymentRepo;