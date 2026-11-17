// src/server/app.ts
import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import bcrypt2 from "bcryptjs";
import crypto2 from "crypto";

// src/server/db.ts
import { MongoClient } from "mongodb";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import dotenv from "dotenv";
dotenv.config();
var MONGODB_URI = process.env["MONGODB_URI"] || "mongodb+srv://rohitsisodiya2145_db_user:Jfh5VrdqsFC7QWv3@cluster0.sja0mea.mongodb.net/roadwatch?retryWrites=true&w=majority";
var DB_NAME = "roadwatch";
var client = null;
var db = null;
var connectPromise = null;
async function getDb() {
  if (db) return db;
  if (!connectPromise) {
    connectPromise = (async () => {
      if (!client) {
        client = new MongoClient(MONGODB_URI, {
          maxPoolSize: 10,
          serverSelectionTimeoutMS: 5e3
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
async function initDb(database) {
  try {
    const users = database.collection("users");
    const hazards = database.collection("hazards");
    const votes = database.collection("votes");
    await users.createIndex({ email: 1 }, { unique: true }).catch(() => {
    });
    await hazards.createIndex({ id: 1 }, { unique: true }).catch(() => {
    });
    await hazards.createIndex({ reporter_id: 1 }).catch(() => {
    });
    await hazards.createIndex({ created_at: -1 }).catch(() => {
    });
    await votes.createIndex({ hazard_id: 1, user_id: 1 }, { unique: true }).catch(() => {
    });
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
        created_at: (/* @__PURE__ */ new Date()).toISOString()
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

// src/server/app.ts
var JWT_SECRET = process.env["JWT_SECRET"] || "roadwatch-super-secret-jwt-key-2026-auth-token";
var ADMIN_EMAIL = (process.env["ADMIN_EMAIL"] || "vivek@gmail.com").toLowerCase().trim();
var app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use((req, _res, next) => {
  const matched = req.headers["x-matched-path"] || req.headers["x-forwarded-uri"];
  if (matched && matched.startsWith("/api") && req.url !== matched) {
    req.url = matched;
  } else if (req.url && !req.url.startsWith("/api")) {
    req.url = `/api${req.url}`;
  }
  next();
});
function getParam(req, key) {
  const val = req.params[key];
  if (Array.isArray(val)) return val[0] || "";
  return String(val || "");
}
var authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const token = authHeader.split(" ")[1];
  if (!token) {
    res.status(401).json({ error: "Token missing" });
    return;
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired session token" });
    return;
  }
};
var requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== "admin") {
    res.status(403).json({ error: "Forbidden: Admin access only" });
    return;
  }
  next();
};
app.get("/api", (_req, res) => {
  res.json({
    status: "ok",
    name: "RoadWatch API",
    mode: "serverless",
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
});
app.get("/api/health", (_req, res) => {
  res.json({
    status: "healthy",
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
});
app.post("/api/auth/signup", async (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password || !name) {
      res.status(400).json({ error: "All fields are required" });
      return;
    }
    const cleanEmail = String(email).toLowerCase().trim();
    if (password.length < 6) {
      res.status(400).json({ error: "Password must be at least 6 characters" });
      return;
    }
    const db2 = await getDb();
    const existing = await db2.collection("users").findOne({ email: cleanEmail });
    if (existing) {
      res.status(400).json({ error: "An account with this email already exists" });
      return;
    }
    const hashedPassword = await bcrypt2.hash(password, 10);
    const role = cleanEmail === ADMIN_EMAIL ? "admin" : "user";
    const id = "usr-" + crypto2.randomUUID();
    const newUser = {
      id,
      email: cleanEmail,
      name: String(name).trim(),
      password: hashedPassword,
      role,
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    await db2.collection("users").insertOne(newUser);
    const token = jwt.sign(
      { id: newUser.id, email: newUser.email, name: newUser.name, role: newUser.role },
      JWT_SECRET,
      { expiresIn: "7d" }
    );
    res.status(201).json({
      token,
      user: { id: newUser.id, email: newUser.email, name: newUser.name, role: newUser.role }
    });
  } catch (err) {
    console.error("[Auth API] Sign up error:", err);
    res.status(500).json({ error: err.message || "Failed to sign up" });
  }
});
app.post("/api/auth/signin", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required" });
      return;
    }
    const cleanEmail = String(email).toLowerCase().trim();
    const db2 = await getDb();
    let user = await db2.collection("users").findOne({ email: cleanEmail });
    if (!user && cleanEmail === ADMIN_EMAIL && password === (process.env["ADMIN_PASSWORD"] || "Vivek@1234")) {
      const hashedPassword = await bcrypt2.hash(password, 10);
      await db2.collection("users").insertOne({
        id: "admin-" + crypto2.randomUUID(),
        email: cleanEmail,
        name: "Vivek (Admin)",
        password: hashedPassword,
        role: "admin",
        created_at: (/* @__PURE__ */ new Date()).toISOString()
      });
      user = await db2.collection("users").findOne({ email: cleanEmail });
    }
    if (!user) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }
    const passwordMatch = await bcrypt2.compare(password, user.password);
    if (!passwordMatch) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }
    const role = user.role === "admin" || cleanEmail === ADMIN_EMAIL ? "admin" : "user";
    if (user.role !== role) {
      await db2.collection("users").updateOne({ email: cleanEmail }, { $set: { role } });
    }
    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name, role },
      JWT_SECRET,
      { expiresIn: "7d" }
    );
    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name, role }
    });
  } catch (err) {
    console.error("[Auth API] Sign in error:", err);
    res.status(500).json({ error: err.message || "Failed to sign in" });
  }
});
app.get("/api/auth/me", authenticate, async (req, res) => {
  try {
    const db2 = await getDb();
    const user = await db2.collection("users").findOne({ id: req.user.id }, { projection: { password: 0, _id: 0 } });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get("/api/hazards", async (_req, res) => {
  try {
    const db2 = await getDb();
    const list = await db2.collection("hazards").find({}).sort({ created_at: -1 }).limit(500).project({ _id: 0 }).toArray();
    res.json(list);
  } catch (err) {
    console.error("[Hazards API] List error:", err);
    res.status(500).json({ error: err.message });
  }
});
app.get("/api/hazards/:id", async (req, res) => {
  try {
    const id = getParam(req, "id");
    const db2 = await getDb();
    const hazard = await db2.collection("hazards").findOne({ id }, { projection: { _id: 0 } });
    if (!hazard) {
      res.status(404).json({ error: "Hazard not found" });
      return;
    }
    res.json(hazard);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.post("/api/hazards", authenticate, async (req, res) => {
  try {
    const { type, severity, description, address, photo_url, latitude, longitude } = req.body;
    if (!type || !severity || latitude == null || longitude == null) {
      res.status(400).json({ error: "Missing required hazard fields" });
      return;
    }
    const db2 = await getDb();
    const id = crypto2.randomUUID();
    const newHazard = {
      id,
      reporter_id: req.user.id,
      reporter_name: req.user.name || "Anonymous Citizen",
      type: String(type),
      severity: String(severity),
      status: "pending",
      description: description ? String(description).trim() : null,
      address: address ? String(address).trim() : null,
      photo_path: photo_url || null,
      photo_url: photo_url || null,
      latitude: Number(latitude),
      longitude: Number(longitude),
      vote_count: 0,
      admin_note: null,
      created_at: (/* @__PURE__ */ new Date()).toISOString(),
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    await db2.collection("hazards").insertOne(newHazard);
    await db2.collection("hazard_status_events").insertOne({
      id: crypto2.randomUUID(),
      hazard_id: id,
      status: "pending",
      note: "Hazard report submitted",
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    });
    res.status(201).json(newHazard);
  } catch (err) {
    console.error("[Hazards API] Create error:", err);
    res.status(500).json({ error: err.message });
  }
});
app.get("/api/my-hazards", authenticate, async (req, res) => {
  try {
    const db2 = await getDb();
    const list = await db2.collection("hazards").find({ reporter_id: req.user.id }).sort({ created_at: -1 }).project({ _id: 0 }).toArray();
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get("/api/hazards/:id/events", async (req, res) => {
  try {
    const hazardId = getParam(req, "id");
    const db2 = await getDb();
    const events = await db2.collection("hazard_status_events").find({ hazard_id: hazardId }).sort({ created_at: 1 }).project({ _id: 0 }).toArray();
    res.json(events);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get("/api/hazards/:id/comments", async (req, res) => {
  try {
    const hazardId = getParam(req, "id");
    const db2 = await getDb();
    const comments = await db2.collection("hazard_comments").find({ hazard_id: hazardId }).sort({ created_at: 1 }).project({ _id: 0 }).toArray();
    res.json(comments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.post("/api/hazards/:id/comments", authenticate, async (req, res) => {
  try {
    const hazardId = getParam(req, "id");
    const { body } = req.body;
    if (!body || !String(body).trim()) {
      res.status(400).json({ error: "Comment text cannot be empty" });
      return;
    }
    const db2 = await getDb();
    const newComment = {
      id: crypto2.randomUUID(),
      hazard_id: hazardId,
      user_id: req.user.id,
      name: req.user.name || "Citizen",
      body: String(body).trim(),
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    await db2.collection("hazard_comments").insertOne(newComment);
    res.status(201).json(newComment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.post("/api/hazards/:id/vote", authenticate, async (req, res) => {
  try {
    const hazardId = getParam(req, "id");
    const db2 = await getDb();
    const userId = req.user.id;
    const existingVote = await db2.collection("votes").findOne({ hazard_id: hazardId, user_id: userId });
    let voted = false;
    if (existingVote) {
      await db2.collection("votes").deleteOne({ hazard_id: hazardId, user_id: userId });
      await db2.collection("hazards").updateOne({ id: hazardId }, { $inc: { vote_count: -1 } });
      voted = false;
    } else {
      await db2.collection("votes").insertOne({
        id: crypto2.randomUUID(),
        hazard_id: hazardId,
        user_id: userId,
        created_at: (/* @__PURE__ */ new Date()).toISOString()
      });
      await db2.collection("hazards").updateOne({ id: hazardId }, { $inc: { vote_count: 1 } });
      voted = true;
    }
    const updated = await db2.collection("hazards").findOne({ id: hazardId });
    res.json({ voted, vote_count: updated?.vote_count ?? 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get("/api/hazards/:id/my-vote", authenticate, async (req, res) => {
  try {
    const hazardId = getParam(req, "id");
    const db2 = await getDb();
    const existingVote = await db2.collection("votes").findOne({ hazard_id: hazardId, user_id: req.user.id });
    res.json({ voted: !!existingVote });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get("/api/admin/hazards", authenticate, requireAdmin, async (_req, res) => {
  try {
    const db2 = await getDb();
    const list = await db2.collection("hazards").find({}).sort({ created_at: -1 }).project({ _id: 0 }).toArray();
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.patch("/api/admin/hazards/:id", authenticate, requireAdmin, async (req, res) => {
  try {
    const hazardId = getParam(req, "id");
    const { status, admin_note } = req.body;
    if (!status) {
      res.status(400).json({ error: "Status is required" });
      return;
    }
    const db2 = await getDb();
    const updateFields = {
      status,
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    if (admin_note !== void 0) {
      updateFields.admin_note = admin_note || null;
    }
    const result = await db2.collection("hazards").findOneAndUpdate(
      { id: hazardId },
      { $set: updateFields },
      { returnDocument: "after", projection: { _id: 0 } }
    );
    if (!result) {
      res.status(404).json({ error: "Hazard not found" });
      return;
    }
    await db2.collection("hazard_status_events").insertOne({
      id: crypto2.randomUUID(),
      hazard_id: hazardId,
      status,
      note: admin_note || `Status changed to ${status} by Administrator`,
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.delete("/api/admin/hazards/:id", authenticate, requireAdmin, async (req, res) => {
  try {
    const hazardId = getParam(req, "id");
    const db2 = await getDb();
    await db2.collection("hazards").deleteOne({ id: hazardId });
    await db2.collection("hazard_status_events").deleteMany({ hazard_id: hazardId });
    await db2.collection("hazard_comments").deleteMany({ hazard_id: hazardId });
    await db2.collection("votes").deleteMany({ hazard_id: hazardId });
    res.json({ success: true, message: "Hazard deleted permanently" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
var app_default = app;
export {
  app,
  authenticate,
  app_default as default,
  requireAdmin
};
