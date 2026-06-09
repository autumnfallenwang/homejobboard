import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { config } from "./config.js";
import { db } from "./db/index.js";
import { log } from "./lib/logger.js";
import { startScheduler } from "./services/scheduler.js";
import { seedDefaultSettings } from "./services/settings.js";

const app = createApp();

serve({ fetch: app.fetch, port: config.apiPort }, async (info) => {
  log.info({ event: "server.start", port: info.port }, "api server listening");
  // Ensure default settings exist (idempotent), then arm the scheduler.
  await seedDefaultSettings(db);
  if (process.env.NODE_ENV !== "test" && config.schedulerEnabled) {
    startScheduler(db);
  }
});
