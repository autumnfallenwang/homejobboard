import { fileURLToPath } from "node:url";
import { log } from "../lib/logger.js";
import type { Database } from "./index.js";
import { sources } from "./schema.js";

// Starter sources. The zero-config feeds work as-is; the ATS entries are EXAMPLE
// company tokens (the real curated list is a standing open question — see
// knowledge/ats-company-slug-sourcing.md). slug = the stable adapter id.
const STARTER_SOURCES: Array<{
  slug: string;
  kind: string;
  params: Record<string, unknown>;
}> = [
  { slug: "remoteok", kind: "remoteok", params: {} },
  { slug: "remotive", kind: "remotive", params: {} },
  { slug: "wwr", kind: "wwr", params: {} },
  { slug: "greenhouse:stripe", kind: "greenhouse", params: { companyToken: "stripe" } },
  { slug: "lever:spotify", kind: "lever", params: { companyToken: "spotify" } },
  {
    slug: "linkedin",
    kind: "linkedin",
    params: { keywords: "software engineer", location: "United States", tpr: "r86400" },
  },
];

/** Idempotent: existing slugs are left untouched. */
export async function seedSources(db: Database): Promise<void> {
  await db.insert(sources).values(STARTER_SOURCES).onConflictDoNothing({ target: sources.slug });
}

// CLI entry: `tsx --env-file=.env src/db/seed.ts`
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { db, closeDb } = await import("./index.js");
  await seedSources(db);
  log.info(
    { event: "seed.sources.done", count: STARTER_SOURCES.length },
    "starter sources seeded (existing rows untouched)",
  );
  await closeDb();
  process.exit(0);
}
