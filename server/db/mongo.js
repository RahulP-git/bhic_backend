import { MongoClient } from "mongodb";
import { env } from "../config/env.js";

const client = new MongoClient(env.mongodbUri);
let database;

export const connectDatabase = async () => {
  if (!database) {
    await client.connect();
    database = client.db(env.databaseName);
    await database.command({ ping: 1 });
  }
  return database;
};

export const getDatabase = () => {
  if (!database) throw new Error("Database is not connected");
  return database;
};

export const closeDatabase = async () => {
  await client.close();
  database = undefined;
};
