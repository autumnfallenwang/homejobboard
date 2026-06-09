/**
 * Centralized environment configuration.
 *
 * Dev reads `apps/api/.env` via `tsx --env-file`; prod relies on env vars
 * injected by the container runtime (Helm chart in M06). Same code, different
 * values at runtime.
 */
export const config = {
  /** Postgres connection string. Optional until M02 wires the DB client. */
  databaseUrl: process.env.DATABASE_URL,
  /** HTTP server port. */
  apiPort: Number(process.env.API_PORT ?? 3001),
  /** LLM gateway base URL (cluster llmgw, OpenAI-compatible). `/v1` is appended by the client. */
  llmGatewayUrl: process.env.LLM_GATEWAY_URL ?? "http://llmgw.arch.local",
  /** Cron expression for the auto-poll scheduler (default: every 30 minutes). */
  pollCron: process.env.POLL_CRON ?? "*/30 * * * *",
  /** Whether the scheduler arms on boot (off under tests / when set to "0"|"false"). */
  schedulerEnabled: !["0", "false"].includes(
    (process.env.SCHEDULER_ENABLED ?? "true").toLowerCase(),
  ),
  /** Log verbosity. */
  logLevel: process.env.LOG_LEVEL ?? "info",
  /** Origins allowed by CORS. */
  corsOrigins: (process.env.CORS_ORIGINS ?? "http://localhost:3000")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
} as const;
