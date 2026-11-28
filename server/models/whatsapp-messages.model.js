import { getDatabase } from "../db/mongo.js";

const collection = () => getDatabase().collection("whatsapp_messages");
export const createWhatsAppMessage = (item) => collection().insertOne(item);
export const createWhatsAppMessageIfMissing = async (item) => {
  const result = await collection().findOneAndUpdate(
    { dedupeKey: item.dedupeKey },
    { $setOnInsert: item },
    { upsert: true, returnDocument: "after" },
  );
  return result.value || result;
};
export const ensureWhatsAppIndexes = () => Promise.all([
  collection().createIndex({ providerMessageId: 1 }),
  collection().createIndex({ groupId: 1, memberId: 1, messageType: 1, reminderKey: 1 }),
  collection().createIndex({ dedupeKey: 1 }, { unique: true, sparse: true }),
]);
