import { jobStatusSchema, materialKindSchema } from "@homejobboard/shared";
import { Hono } from "hono";
import { db } from "../db/index.js";
import { getJob, getScore, listDuplicatesOf, listFeed, setJobStatus } from "../db/queries.js";
import { log } from "../lib/logger.js";
import { generateMaterial } from "../materials/generate.js";
import { getSettingOr } from "../services/settings.js";

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

// POST /jobs/:id/materials  { kind: "cv" | "cover" } — generate a job-tailored CV or
// cover letter as markdown (the web renders + prints it). Never auto-submits.
jobsApp.post("/:id/materials", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = materialKindSchema.safeParse((body as { kind?: unknown }).kind);
  if (!parsed.success) return c.json({ error: "invalid kind (cv|cover)" }, 400);

  const row = await getJob(db, c.req.param("id"));
  if (!row) return c.json({ error: "not found" }, 404);

  const cv = await getSettingOr(db, "cv");
  if (!cv.trim()) return c.json({ error: "no CV set — add your CV in settings first" }, 400);

  try {
    const result = await generateMaterial(db, row, parsed.data);
    return c.json({ kind: parsed.data, ...result });
  } catch (err) {
    log.error(
      {
        event: "materials.failed",
        jobId: row.id,
        kind: parsed.data,
        err: err instanceof Error ? err.message : err,
      },
      "material generation failed",
    );
    return c.json({ error: "generation failed" }, 502);
  }
});
