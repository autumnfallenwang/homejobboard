import { Hono } from "hono";
import { db } from "../db/index.js";
import { feedStats } from "../db/queries.js";

export const statsApp = new Hono();

// GET /stats — triage counts, unscored backlog, last poll time (the web header strip).
statsApp.get("/", async (c) => c.json(await feedStats(db)));
