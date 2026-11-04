import { getDatabase } from "../db/mongo.js";

const collection = () => getDatabase().collection("audit_logs");

export const writeAuditLog = (entry) =>
  collection().insertOne({ ...entry, createdAt: new Date() });
