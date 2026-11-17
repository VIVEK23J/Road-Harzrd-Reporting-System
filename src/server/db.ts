import { MongoClient, Db } from "mongodb";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";

dotenv.config();

const MONGODB_URI =
  process.env["MONGODB_URI"] ||
  "mongodb+srv://rohitsisodiya2145_db_user:Jfh5VrdqsFC7QWv3@cluster0.sja0mea.mongodb.net/roadwatch?retryWrites=true&w=majority";
const DB_NAME = "roadwatch";

let client: MongoClient | null = null;
let db: Db | null = null;
let connectPromise: Promise<Db> | null = null;

export interface UserDoc {
  id: string;
  email: string;
  password: string;
  name: string;
  role: "admin" | "user";
  created_at: string;
}

export async function getDb(): Promise<Db> {
  if (db) return db;
  if (!connectPromise) {
    connectPromise = (async () => {
      if (!client) {
        client = new MongoClient(MONGODB_URI, {
          maxPoolSize: 10,
          serverSelectionTimeoutMS: 5000,
        });
        await client.connect();
        console.log("[MongoDB] Connected to database:", DB_NAME);
      }
      const database = client.db(DB_NAME);
      await initDb(database);
      db = database;
      return database;
    })();
  }
  return connectPromise;
}

// Ensure indexes and seed default admin user
async function initDb(database: Db) {
  try {
    const users = database.collection<UserDoc>("users");
    const hazards = database.collection("hazards");
    const votes = database.collection("votes");

    // Indexes
    await users.createIndex({ email: 1 }, { unique: true }).catch(() => {});
    await hazards.createIndex({ id: 1 }, { unique: true }).catch(() => {});
    await hazards.createIndex({ reporter_id: 1 }).catch(() => {});
    await hazards.createIndex({ created_at: -1 }).catch(() => {});
    await votes.createIndex({ hazard_id: 1, user_id: 1 }, { unique: true }).catch(() => {});

    // Ensure Real Admin account exists: vivek@gmail.com / Vivek@1234
    const adminEmail = (process.env["ADMIN_EMAIL"] || "vivek@gmail.com").toLowerCase().trim();
    const adminPassword = process.env["ADMIN_PASSWORD"] || "Vivek@1234";

    const existingAdmin = await users.findOne({ email: adminEmail });
    if (!existingAdmin) {
      const hashedPassword = await bcrypt.hash(adminPassword, 10);
      await users.insertOne({
        id: "admin-" + crypto.randomUUID(),
        email: adminEmail,
        password: hashedPassword,
        name: "Vivek (Admin)",
        role: "admin",
        created_at: new Date().toISOString(),
      });
      console.log(`[MongoDB] Created default admin account: ${adminEmail}`);
    } else if (existingAdmin.role !== "admin") {
      await users.updateOne({ email: adminEmail }, { $set: { role: "admin" } });
      console.log(`[MongoDB] Updated existing user ${adminEmail} to admin role`);
    }
  } catch (err) {
    console.error("[MongoDB] Init error:", err);
  }
}
