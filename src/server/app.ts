import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { getDb, type UserDoc } from "./db";
import type { WithId } from "mongodb";

const JWT_SECRET = process.env["JWT_SECRET"] || "roadwatch-super-secret-jwt-key-2026-auth-token";
const ADMIN_EMAIL = (process.env["ADMIN_EMAIL"] || "vivek@gmail.com").toLowerCase().trim();

export const app = express();

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: "admin" | "user";
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

export interface HazardDoc {
  id: string;
  reporter_id: string;
  reporter_name: string;
  type: string;
  severity: string;
  status: string;
  description: string | null;
  address: string | null;
  photo_path: string | null;
  photo_url: string | null;
  latitude: number;
  longitude: number;
  vote_count: number;
  admin_note: string | null;
  created_at: string;
  updated_at: string;
}

export interface VoteDoc {
  id: string;
  hazard_id: string;
  user_id: string;
  created_at: string;
}

export interface CommentDoc {
  id: string;
  hazard_id: string;
  user_id: string;
  name: string;
  body: string;
  created_at: string;
}

export interface StatusEventDoc {
  id: string;
  hazard_id: string;
  status: string;
  note: string;
  created_at: string;
}

function getParam(req: Request, key: string): string {
  const val = req.params[key];
  if (Array.isArray(val)) return val[0] || "";
  return String(val || "");
}

// JWT Auth Middleware
export const authenticate = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
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
    const decoded = jwt.verify(token, JWT_SECRET) as unknown as AuthUser;
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired session token" });
    return;
  }
};

// Admin Only Middleware
export const requireAdmin = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user || req.user.role !== "admin") {
    res.status(403).json({ error: "Forbidden: Admin access only" });
    return;
  }
  next();
};

// -------------------------------------------------------------
// BASE & HEALTH ENDPOINTS
// -------------------------------------------------------------

app.get("/api", (_req: Request, res: Response): void => {
  res.json({
    status: "ok",
    name: "RoadWatch API",
    mode: "serverless",
    timestamp: new Date().toISOString(),
  });
});

app.get("/api/health", (_req: Request, res: Response): void => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
  });
});

// -------------------------------------------------------------
// AUTH ENDPOINTS
// -------------------------------------------------------------

// Sign Up
app.post("/api/auth/signup", async (req: Request, res: Response): Promise<void> => {
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

    const db = await getDb();
    const existing = await db.collection<UserDoc>("users").findOne({ email: cleanEmail });
    if (existing) {
      res.status(400).json({ error: "An account with this email already exists" });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const role: "admin" | "user" = cleanEmail === ADMIN_EMAIL ? "admin" : "user";
    const id = "usr-" + crypto.randomUUID();

    const newUser: UserDoc = {
      id,
      email: cleanEmail,
      name: String(name).trim(),
      password: hashedPassword,
      role,
      created_at: new Date().toISOString(),
    };

    await db.collection<UserDoc>("users").insertOne(newUser);

    const token = jwt.sign(
      { id: newUser.id, email: newUser.email, name: newUser.name, role: newUser.role },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(201).json({
      token,
      user: { id: newUser.id, email: newUser.email, name: newUser.name, role: newUser.role },
    });
  } catch (err: any) {
    console.error("[Auth API] Sign up error:", err);
    res.status(500).json({ error: err.message || "Failed to sign up" });
  }
});

// Sign In
app.post("/api/auth/signin", async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required" });
      return;
    }

    const cleanEmail = String(email).toLowerCase().trim();
    const db = await getDb();
    let user: WithId<UserDoc> | null = await db.collection<UserDoc>("users").findOne({ email: cleanEmail });

    // Fallback: If this is the real admin logging in and somehow not in DB yet, auto-create
    if (!user && cleanEmail === ADMIN_EMAIL && password === (process.env["ADMIN_PASSWORD"] || "Vivek@1234")) {
      const hashedPassword = await bcrypt.hash(password, 10);
      await db.collection<UserDoc>("users").insertOne({
        id: "admin-" + crypto.randomUUID(),
        email: cleanEmail,
        name: "Vivek (Admin)",
        password: hashedPassword,
        role: "admin",
        created_at: new Date().toISOString(),
      });
      user = await db.collection<UserDoc>("users").findOne({ email: cleanEmail });
    }

    if (!user) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const role: "admin" | "user" = user.role === "admin" || cleanEmail === ADMIN_EMAIL ? "admin" : "user";
    if (user.role !== role) {
      await db.collection<UserDoc>("users").updateOne({ email: cleanEmail }, { $set: { role } });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name, role },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name, role },
    });
  } catch (err: any) {
    console.error("[Auth API] Sign in error:", err);
    res.status(500).json({ error: err.message || "Failed to sign in" });
  }
});

// Current User Me
app.get("/api/auth/me", authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const db = await getDb();
    const user = await db.collection<UserDoc>("users").findOne({ id: req.user!.id }, { projection: { password: 0, _id: 0 } });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json({ user });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// HAZARDS ENDPOINTS
// -------------------------------------------------------------

// List All Hazards
app.get("/api/hazards", async (_req: Request, res: Response): Promise<void> => {
  try {
    const db = await getDb();
    const list = await db.collection<HazardDoc>("hazards")
      .find({})
      .sort({ created_at: -1 })
      .limit(500)
      .project({ _id: 0 })
      .toArray();
    res.json(list);
  } catch (err: any) {
    console.error("[Hazards API] List error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Get Single Hazard
app.get("/api/hazards/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const id = getParam(req, "id");
    const db = await getDb();
    const hazard = await db.collection<HazardDoc>("hazards").findOne({ id }, { projection: { _id: 0 } });
    if (!hazard) {
      res.status(404).json({ error: "Hazard not found" });
      return;
    }
    res.json(hazard);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create Hazard Report
app.post("/api/hazards", authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { type, severity, description, address, photo_url, latitude, longitude } = req.body;
    if (!type || !severity || latitude == null || longitude == null) {
      res.status(400).json({ error: "Missing required hazard fields" });
      return;
    }

    const db = await getDb();
    const id = crypto.randomUUID();
    const newHazard: HazardDoc = {
      id,
      reporter_id: req.user!.id,
      reporter_name: req.user!.name || "Anonymous Citizen",
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
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await db.collection<HazardDoc>("hazards").insertOne(newHazard);

    // Initial timeline event
    await db.collection<StatusEventDoc>("hazard_status_events").insertOne({
      id: crypto.randomUUID(),
      hazard_id: id,
      status: "pending",
      note: "Hazard report submitted",
      created_at: new Date().toISOString(),
    });

    res.status(201).json(newHazard);
  } catch (err: any) {
    console.error("[Hazards API] Create error:", err);
    res.status(500).json({ error: err.message });
  }
});

// My Hazards
app.get("/api/my-hazards", authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const db = await getDb();
    const list = await db.collection<HazardDoc>("hazards")
      .find({ reporter_id: req.user!.id })
      .sort({ created_at: -1 })
      .project({ _id: 0 })
      .toArray();
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Hazard Status Events (Timeline)
app.get("/api/hazards/:id/events", async (req: Request, res: Response): Promise<void> => {
  try {
    const hazardId = getParam(req, "id");
    const db = await getDb();
    const events = await db.collection<StatusEventDoc>("hazard_status_events")
      .find({ hazard_id: hazardId })
      .sort({ created_at: 1 })
      .project({ _id: 0 })
      .toArray();
    res.json(events);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Hazard Comments
app.get("/api/hazards/:id/comments", async (req: Request, res: Response): Promise<void> => {
  try {
    const hazardId = getParam(req, "id");
    const db = await getDb();
    const comments = await db.collection<CommentDoc>("hazard_comments")
      .find({ hazard_id: hazardId })
      .sort({ created_at: 1 })
      .project({ _id: 0 })
      .toArray();
    res.json(comments);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Post Comment
app.post("/api/hazards/:id/comments", authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const hazardId = getParam(req, "id");
    const { body } = req.body;
    if (!body || !String(body).trim()) {
      res.status(400).json({ error: "Comment text cannot be empty" });
      return;
    }

    const db = await getDb();
    const newComment: CommentDoc = {
      id: crypto.randomUUID(),
      hazard_id: hazardId,
      user_id: req.user!.id,
      name: req.user!.name || "Citizen",
      body: String(body).trim(),
      created_at: new Date().toISOString(),
    };

    await db.collection<CommentDoc>("hazard_comments").insertOne(newComment);
    res.status(201).json(newComment);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Toggle Vote
app.post("/api/hazards/:id/vote", authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const hazardId = getParam(req, "id");
    const db = await getDb();
    const userId = req.user!.id;

    const existingVote = await db.collection<VoteDoc>("votes").findOne({ hazard_id: hazardId, user_id: userId });
    let voted = false;

    if (existingVote) {
      await db.collection<VoteDoc>("votes").deleteOne({ hazard_id: hazardId, user_id: userId });
      await db.collection<HazardDoc>("hazards").updateOne({ id: hazardId }, { $inc: { vote_count: -1 } });
      voted = false;
    } else {
      await db.collection<VoteDoc>("votes").insertOne({
        id: crypto.randomUUID(),
        hazard_id: hazardId,
        user_id: userId,
        created_at: new Date().toISOString(),
      });
      await db.collection<HazardDoc>("hazards").updateOne({ id: hazardId }, { $inc: { vote_count: 1 } });
      voted = true;
    }

    const updated = await db.collection<HazardDoc>("hazards").findOne({ id: hazardId });
    res.json({ voted, vote_count: updated?.vote_count ?? 0 });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get My Vote Status
app.get("/api/hazards/:id/my-vote", authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const hazardId = getParam(req, "id");
    const db = await getDb();
    const existingVote = await db.collection<VoteDoc>("votes").findOne({ hazard_id: hazardId, user_id: req.user!.id });
    res.json({ voted: !!existingVote });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// ADMIN CONSOLE ENDPOINTS (Strictly Restricted to Admin Role)
// -------------------------------------------------------------

// Admin Hazards List
app.get("/api/admin/hazards", authenticate, requireAdmin, async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const db = await getDb();
    const list = await db.collection<HazardDoc>("hazards")
      .find({})
      .sort({ created_at: -1 })
      .project({ _id: 0 })
      .toArray();
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Admin Update Hazard Status & Note
app.patch("/api/admin/hazards/:id", authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const hazardId = getParam(req, "id");
    const { status, admin_note } = req.body;
    if (!status) {
      res.status(400).json({ error: "Status is required" });
      return;
    }

    const db = await getDb();

    const updateFields: any = {
      status,
      updated_at: new Date().toISOString(),
    };
    if (admin_note !== undefined) {
      updateFields.admin_note = admin_note || null;
    }

    const result = await db.collection<HazardDoc>("hazards").findOneAndUpdate(
      { id: hazardId },
      { $set: updateFields },
      { returnDocument: "after", projection: { _id: 0 } }
    );

    if (!result) {
      res.status(404).json({ error: "Hazard not found" });
      return;
    }

    // Record timeline status change
    await db.collection<StatusEventDoc>("hazard_status_events").insertOne({
      id: crypto.randomUUID(),
      hazard_id: hazardId,
      status,
      note: admin_note || `Status changed to ${status} by Administrator`,
      created_at: new Date().toISOString(),
    });

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Admin Delete Hazard
app.delete("/api/admin/hazards/:id", authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const hazardId = getParam(req, "id");
    const db = await getDb();

    await db.collection("hazards").deleteOne({ id: hazardId });
    await db.collection("hazard_status_events").deleteMany({ hazard_id: hazardId });
    await db.collection("hazard_comments").deleteMany({ hazard_id: hazardId });
    await db.collection("votes").deleteMany({ hazard_id: hazardId });

    res.json({ success: true, message: "Hazard deleted permanently" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
