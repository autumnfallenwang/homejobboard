// Structured logger (pino). Emits one JSON object per line to stdout — the
// cluster log pipeline tails container stdout into Loki and labels by pod, so
// apps only need to print JSON with consistent fields. Matches the
// homenews/homework/homecal setup so Grafana dashboards + Loki alerts are
// portable across the home apps.
//
// Convention: log.info({ event, req_id, latency_ms, ... }, "message").
// pino supplies time/level/msg; `base` adds service/version to every line.

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pino } from "pino";

const pkgPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as { name: string; version: string };

// Strip the `@homejobboard/` scope so Loki sees a flat label (`homejobboard-api`).
const service = pkg.name.replace(/^@[^/]+\//, "homejobboard-");

export const log = pino({
  level: process.env.LOG_LEVEL ?? "info",
  base: { service, version: pkg.version },
  timestamp: pino.stdTimeFunctions.isoTime,
});
