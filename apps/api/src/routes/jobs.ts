import { Hono } from "hono";
import { db } from "../db/index.js";
import { getJob, getScore, listJobs, listRankedJobs } from "../db/queries.js";

export const jobsApp = new Hono();

// GET /jobs?limit&offset&source&includeDuplicates&sort
//   sort=rank → fitness×freshness ranked (scored jobs only); default → newest-first.
jobsApp.get("/", async (c) => {
  const limit = Math.min(Number(c.req.query("limit") ?? 50) || 50, 200);
  const offset = Number(c.req.query("offset") ?? 0) || 0;

  if (c.req.query("sort") === "rank") {
    return c.json(await listRankedJobs(db, { limit, offset }));
  }

  const source = c.req.query("source") || undefined;
  const includeDuplicates = c.req.query("includeDuplicates") === "true";
  return c.json(await listJobs(db, { limit, offset, source, includeDuplicates }));
});

jobsApp.get("/:id", async (c) => {
  const id = c.req.param("id");
  const row = await getJob(db, id);
  if (!row) return c.json({ error: "not found" }, 404);
  const score = await getScore(db, id);
  return c.json({ ...row, score: score ?? null });
});
