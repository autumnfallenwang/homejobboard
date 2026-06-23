import { createSourceSchema, updateSourceSchema } from "@homejobboard/shared";
import { Hono } from "hono";
import { db } from "../db/index.js";
import { deleteSource, insertSource, listSources, updateSource } from "../db/queries.js";

export const sourcesApp = new Hono();

sourcesApp.get("/", async (c) => c.json(await listSources(db)));

// POST /sources { slug, kind, params? } — add a board (e.g. "greenhouse:figma") from the UI.
sourcesApp.post("/", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = createSourceSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "invalid", details: parsed.error.flatten() }, 400);
  }
  const row = await insertSource(db, parsed.data);
  if (!row) return c.json({ error: "slug already exists" }, 409);
  return c.json(row, 201);
});

sourcesApp.patch("/:id", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = updateSourceSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "invalid", details: parsed.error.flatten() }, 400);
  }
  const row = await updateSource(db, c.req.param("id"), parsed.data);
  if (!row) return c.json({ error: "not found" }, 404);
  return c.json(row);
});

sourcesApp.delete("/:id", async (c) => {
  const row = await deleteSource(db, c.req.param("id"));
  if (!row) return c.json({ error: "not found" }, 404);
  return c.json(row);
});
