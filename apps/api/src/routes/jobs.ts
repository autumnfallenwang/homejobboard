import { jobStatusSchema } from "@homejobboard/shared";
import { Hono } from "hono";
import { db } from "../db/index.js";
import { getJob, getScore, listDuplicatesOf, listFeed, setJobStatus } from "../db/queries.js";

export const jobsApp = new Hono();

// GET /jobs?sort=recent|rank&status=new|applied|dismissed&q&source&minScore&limit&offset
//   The web feed: non-duplicate jobs (status default 'new') each with their score attached.
jobsApp.get("/", async (c) => {
  const limit = Math.min(Number(c.req.query("limit") ?? 50) || 50, 200);
  const offset = Number(c.req.query("offset") ?? 0) || 0;
  const sort = c.req.query("sort") === "rank" ? "rank" : "recent";
  const status = jobStatusSchema.catch("new").parse(c.req.query("status"));
  const q = c.req.query("q")?.trim() || undefined;
  const source = c.req.query("source")?.trim() || undefined;
  const minScoreRaw = Number(c.req.query("minScore"));
  const minScore = Number.isFinite(minScoreRaw) && minScoreRaw > 0 ? minScoreRaw : undefined;
  return c.json(await listFeed(db, { sort, status, q, source, minScore, limit, offset }));
});

jobsApp.get("/:id", async (c) => {
  const id = c.req.param("id");
  const row = await getJob(db, id);
  if (!row) return c.json({ error: "not found" }, 404);
  const [score, alsoSeenOn] = await Promise.all([getScore(db, id), listDuplicatesOf(db, id)]);
  return c.json({ ...row, score: score ?? null, alsoSeenOn });
});

// PATCH /jobs/:id  { status } — triage from the UI (apply / dismiss / reset to new).
jobsApp.patch("/:id", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = jobStatusSchema.safeParse((body as { status?: unknown }).status);
  if (!parsed.success) return c.json({ error: "invalid status" }, 400);
  const row = await setJobStatus(db, c.req.param("id"), parsed.data);
  if (!row) return c.json({ error: "not found" }, 404);
  return c.json(row);
});
