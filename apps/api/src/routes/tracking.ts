import { Hono } from "hono";
import { db } from "../db/index.js";
import { listTracking } from "../db/queries.js";

export const trackingApp = new Hono();

// GET /tracking — the engaged application pipeline (applied → offer), each annotated
// with its follow-up cadence, overdue first.
trackingApp.get("/", async (c) => c.json(await listTracking(db)));
