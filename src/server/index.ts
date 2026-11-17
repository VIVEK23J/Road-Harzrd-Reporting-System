import dotenv from "dotenv";
dotenv.config();

import { app } from "./app";
import { getDb } from "./db";

const PORT = process.env["PORT"] || 5000;

async function start() {
  try {
    await getDb();
    app.listen(PORT, () => {
      console.log(`[Server] API server running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("[Server] Failed to start:", err);
    process.exit(1);
  }
}

start();
