import { Hono } from "hono";
import { cors } from "hono/cors";
import { config } from "./config.js";
import { requestLogger } from "./middleware/logger.js";
import { jobsApp } from "./routes/jobs.js";
import { pollApp } from "./routes/poll.js";
import { scoreApp } from "./routes/score.js";
import { settingsApp } from "./routes/settings.js";
import { sourcesApp } from "./routes/sources.js";

/** Build the Hono app. */
export function createApp() {
  const app = new Hono();

  // Request logging (structured JSON logs with req_id)
  app.use("*", requestLogger);

  // CORS — allow the web frontend origin(s)
  app.use(
    "*",
    cors({
      origin: config.corsOrigins,
      credentials: true,
    }),
  );

  // Health check
  app.get("/health", (c) => c.json({ status: "ok" }));

  // Resource routes
  app.route("/jobs", jobsApp);
  app.route("/sources", sourcesApp);
  app.route("/poll", pollApp);
  app.route("/score", scoreApp);
  app.route("/settings", settingsApp);

  return app;
}
