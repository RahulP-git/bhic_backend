import { getDatabase } from "../db/mongo.js";

const collection = () => getDatabase().collection("whatsapp_messages");
export const createWhatsAppMessage = (item) => collection().insertOne(item);
export const ensureWhatsAppIndexes = () => Promise.all([
  collection().createIndex({ providerMessageId: 1 }),
  collection().createIndex({ groupId: 1, memberId: 1, messageType: 1, reminderKey: 1 }),
]);
