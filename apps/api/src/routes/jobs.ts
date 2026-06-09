import { Hono } from "hono";
import { db } from "../db/index.js";
import { getJob, listJobs } from "../db/queries.js";

export const jobsApp = new Hono();

// GET /jobs?limit&offset&source&includeDuplicates — newest-first, dedup-collapsed by default.
jobsApp.get("/", async (c) => {
  const limit = Math.min(Number(c.req.query("limit") ?? 50) || 50, 200);
  const offset = Number(c.req.query("offset") ?? 0) || 0;
  const source = c.req.query("source") || undefined;
  const includeDuplicates = c.req.query("includeDuplicates") === "true";
  return c.json(await listJobs(db, { limit, offset, source, includeDuplicates }));
});

jobsApp.get("/:id", async (c) => {
  const row = await getJob(db, c.req.param("id"));
  if (!row) return c.json({ error: "not found" }, 404);
  return c.json(row);
});
