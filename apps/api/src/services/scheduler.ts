import cron, { type ScheduledTask } from "node-cron";
import { config } from "../config.js";
import type { Database } from "../db/index.js";
import { log } from "../lib/logger.js";
import { runPoll } from "./ingest.js";

/**
 * Arm the auto-poll scheduler: run `runPoll` on `config.pollCron`. Each tick is
 * isolated (a failed poll logs and the schedule continues). Returns the task so
 * callers can stop it. Never armed under tests (see index.ts guard).
 */
export function startScheduler(db: Database): ScheduledTask {
  log.info({ event: "scheduler.start", cron: config.pollCron }, "auto-poll scheduler armed");
  return cron.schedule(config.pollCron, async () => {
    try {
      const summary = await runPoll(db);
      log.info({ event: "scheduler.tick", inserted: summary.inserted }, "scheduled poll complete");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log.error({ event: "scheduler.tick.failed", err: msg }, "scheduled poll failed");
    }
  });
}
