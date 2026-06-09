import { Hono } from "hono";
import { db } from "../db/index.js";
import { scoreUnscoredJobs } from "../services/score.js";

export const scoreApp = new Hono();

// POST /score  body: { limit?: number } — score unscored, non-duplicate jobs via llmgw.
// Decoupled from polling (the scheduler also runs this after each poll).
scoreApp.post("/", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { limit?: unknown };
  const limit = typeof body?.limit === "number" ? body.limit : undefined;
  return c.json(await scoreUnscoredJobs(db, limit));
});
