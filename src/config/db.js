import { MongoClient } from "mongodb";
import config from "../config/index.js";

let client = null;
let db = null;

const connectDb = async () => {
  if (db) return db;
  client = new MongoClient(config.mongodb.uri, {
    maxPoolSize: 10,
    minPoolSize: 2,
    maxIdleTimeMS: 30000,
    serverSelectionTimeoutMS: 5000,
  });
  await client.connect();
  db = client.db(config.mongodb.dbName);
  console.log(`[DB] Connected to MongoDB: ${config.mongodb.dbName}`);
  return db;
};

const getDb = () => {
  if (!db) {
    throw new Error("Database not connected. Call connectDb() first.");
  }
  return db;
};

const closeDb = async () => {
  if (client) {
    await client.close();
    client = null;
    db = null;
    console.log("[DB] Connection closed");
  }
};

// Helper to create a collection with indexes
const ensureIndexes = async (collectionName, indexes) => {
  const database = getDb();
  const collection = database.collection(collectionName);
  for (const index of indexes) {
    await collection.createIndex(index.key, index.options || {});
  }
};

export { connectDb, getDb, closeDb, ensureIndexes };