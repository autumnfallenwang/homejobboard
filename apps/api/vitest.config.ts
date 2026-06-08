import { defineConfig } from "vitest/config";

// Load apps/api/.env so integration tests get DATABASE_URL without a manual
// --env-file (mirrors the house pattern). Guarded: absent .env is fine
// (test:fast is DB-free; integration tests self-skip when DATABASE_URL is unset).
try {
  process.loadEnvFile(new URL(".env", import.meta.url));
} catch {
  // no .env — fine for DB-free runs
}

export default defineConfig({
  test: {
    globals: true,
    include: ["src/**/*.test.ts"],
    // Integration test files share one Postgres and truncate in beforeEach;
    // serialize file execution so they don't clobber each other's rows.
    fileParallelism: false,
  },
});
