import { getDb } from "../config/db.js";

const COLLECTION = "ledger_entries";

const ledgerRepo = {
  async create(data) {
    const db = getDb();
    const result = await db.collection(COLLECTION).insertOne({
      ...data,
      createdAt: new Date(),
    });
    return { _id: result.insertedId, ...data };
  },

  async findByGroup(groupId, filters = {}) {
    const db = getDb();
    return db.collection(COLLECTION).find({ groupId, ...filters }).sort({ createdAt: -1 }).toArray();
  },

  async sumDebitsCredits(groupId, cycleId = null) {
    const db = getDb();
    const match = { groupId };
    if (cycleId) match.cycleId = cycleId;
    const result = await db.collection(COLLECTION).aggregate([
      { $match: match },
      { $group: { _id: null, totalDebit: { $sum: "$debitAmount" }, totalCredit: { $sum: "$creditAmount" } } },
    ]).toArray();
    return result[0] || { totalDebit: 0, totalCredit: 0 };
  },
};

export default ledgerRepo;