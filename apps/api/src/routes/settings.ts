import { Hono } from "hono";
import { db } from "../db/index.js";
import { settings } from "../db/schema.js";
import { getSetting, setSetting } from "../services/settings.js";

export const settingsApp = new Hono();

// GET /settings — all key/value rows.
settingsApp.get("/", async (c) => c.json(await db.select().from(settings)));

settingsApp.get("/:key", async (c) => {
  const value = await getSetting(db, c.req.param("key"));
  if (value === undefined) return c.json({ error: "not found" }, 404);
  return c.json({ key: c.req.param("key"), value });
});

// PUT /settings/:key  { value } — upsert (e.g. the fitness profile).
settingsApp.put("/:key", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { value?: unknown };
  if (typeof body.value !== "string") return c.json({ error: "value must be a string" }, 400);
  await setSetting(db, c.req.param("key"), body.value);
  return c.json({ key: c.req.param("key"), value: body.value });
});
