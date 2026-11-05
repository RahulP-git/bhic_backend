import { closeDatabase, connectDatabase } from "../server/db/mongo.js";

const fieldsByCollection = {
  groups: ["contributionAmount", "totalBhicAmount", "controlledAmount"],
  cycles: ["expectedTotal", "totalCollected", "totalOutstanding", "winnerAmount", "receivedAmount", "remainingAmount"],
  cycle_participants: ["expectedContribution", "collectedAmount", "outstandingAmount"],
  cash_collections: ["amount"],
  winners: ["winnerAmount", "receivedAmount", "remainingAmount"],
  settlements: ["expectedAmount", "actualAmount"],
  distributions: ["sourceAmount", "totalCalculatedAmount", "roundingAdjustment"],
  distribution_items: ["baseAmount", "interestAmount", "finalAmount"],
  ledger_entries: ["debitAmount", "creditAmount"],
  subscription_plans: ["amount"],
  subscription_orders: ["amount"],
};

const apply = process.argv.includes("--apply");

const migrate = async () => {
  const database = await connectDatabase();
  console.log(apply ? "Applying paise-to-rupees migration" : "Dry run only; use --apply to modify data");

  for (const [collectionName, fields] of Object.entries(fieldsByCollection)) {
    const collection = database.collection(collectionName);
    const existing = await collection.countDocuments();
    if (!existing) continue;

    if (!apply) {
      console.log(`${collectionName}: ${existing} documents would be checked`);
      continue;
    }

    const set = Object.fromEntries(fields.map((field) => [field, { $divide: [`$${field}`, 100] }]));
    const result = await collection.updateMany({}, [{ $set: set }]);
    console.log(`${collectionName}: converted ${result.modifiedCount} documents`);
  }
};

try {
  await migrate();
} finally {
  await closeDatabase();
}
