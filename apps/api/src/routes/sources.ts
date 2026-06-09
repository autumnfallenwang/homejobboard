import { updateSourceSchema } from "@homejobboard/shared";
import { Hono } from "hono";
import { db } from "../db/index.js";
import { listSources, updateSource } from "../db/queries.js";

export const sourcesApp = new Hono();

sourcesApp.get("/", async (c) => c.json(await listSources(db)));

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
