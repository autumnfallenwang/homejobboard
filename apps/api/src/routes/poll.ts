import { Hono } from "hono";
import { db } from "../db/index.js";
import { runPoll } from "../services/ingest.js";

export const pollApp = new Hono();

// POST /poll  body: { sources?: string[] } — manual ingestion trigger (the scheduler
// arrives in M03 part 2). Returns the per-source poll summary.
pollApp.post("/", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { sources?: unknown };
  const sources = Array.isArray(body?.sources) ? (body.sources as string[]) : undefined;
  const summary = await runPoll(db, { sources });
  return c.json(summary);
});
