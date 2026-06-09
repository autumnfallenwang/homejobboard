import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { config } from "./config.js";
import { db } from "./db/index.js";
import { log } from "./lib/logger.js";
import { startScheduler } from "./services/scheduler.js";

const app = createApp();

serve({ fetch: app.fetch, port: config.apiPort }, (info) => {
  log.info({ event: "server.start", port: info.port }, "api server listening");
  // Arm the auto-poll scheduler (skip under tests so cron never fires there).
  if (process.env.NODE_ENV !== "test" && config.schedulerEnabled) {
    startScheduler(db);
  }
});
