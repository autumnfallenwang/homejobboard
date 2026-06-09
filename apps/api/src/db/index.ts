import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

// Lazy postgres-js client (safe for DB-free unit tests, which never touch `db`).
// `casing: "snake_case"` lets the schema use camelCase column names that map to
// snake_case columns — must match drizzle.config.ts.
const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://homejobboard:homejobboard@localhost:5432/homejobboard_dev";

const client = postgres(databaseUrl);

export const db = drizzle(client, { schema, casing: "snake_case" });

export type Database = typeof db;

/** Close the underlying connection (integration-test teardown). */
export async function closeDb(): Promise<void> {
  await client.end();
}
