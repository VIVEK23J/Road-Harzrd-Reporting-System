import type { Request, Response } from "express";
import { app } from "../src/server/app";

export default function handler(req: Request, res: Response) {
  // If req.url doesn't start with /api, ensure /api is prepended so Express routes match
  if (req.url && !req.url.startsWith("/api")) {
    req.url = `/api${req.url}`;
  }
  return app(req, res);
}
