import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  // Must match the `casing` option in src/db/index.ts so generated DDL + ON CONFLICT
  // targets resolve to the same snake_case column names.
  casing: "snake_case",
  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      "postgresql://homejobboard:homejobboard@localhost:5432/homejobboard_dev",
  },
});
