import { fileURLToPath } from "node:url";
import { log } from "../lib/logger.js";
import type { Database } from "./index.js";
import { sources } from "./schema.js";

// Starter sources. The zero-config feeds work as-is. The ATS entries are a curated
// starter list of well-known tech companies per ATS (see
// knowledge/ats-company-slug-sourcing.md) — a stale/renamed token fails soft (the
// poll isolates per-source errors and logs), and any board can be disabled or added
// from the settings UI. slug = the stable adapter id.
const STARTER_SOURCES: Array<{
  slug: string;
  kind: string;
  params: Record<string, unknown>;
}> = [
  // Clean feeds (whole-board, zero config)
  { slug: "remoteok", kind: "remoteok", params: {} },
  { slug: "remotive", kind: "remotive", params: {} },
  { slug: "wwr", kind: "wwr", params: {} },
  { slug: "hn", kind: "hn", params: {} },
  // Greenhouse boards (stripe + gitlab live-validated 2026-06-08)
  { slug: "greenhouse:stripe", kind: "greenhouse", params: { companyToken: "stripe" } },
  { slug: "greenhouse:gitlab", kind: "greenhouse", params: { companyToken: "gitlab" } },
  { slug: "greenhouse:anthropic", kind: "greenhouse", params: { companyToken: "anthropic" } },
  { slug: "greenhouse:databricks", kind: "greenhouse", params: { companyToken: "databricks" } },
  { slug: "greenhouse:cloudflare", kind: "greenhouse", params: { companyToken: "cloudflare" } },
  // Lever boards (all three live-validated 2026-06-10)
  { slug: "lever:spotify", kind: "lever", params: { companyToken: "spotify" } },
  { slug: "lever:palantir", kind: "lever", params: { companyToken: "palantir" } },
  { slug: "lever:zoox", kind: "lever", params: { companyToken: "zoox" } },
  // Ashby boards (openai + ramp live-validated 2026-06-08)
  { slug: "ashby:openai", kind: "ashby", params: { companyToken: "openai" } },
  { slug: "ashby:ramp", kind: "ashby", params: { companyToken: "ramp" } },
  { slug: "ashby:linear", kind: "ashby", params: { companyToken: "linear" } },
  // M07 ATS kinds (workday/smartrecruiters/recruitee live-validated 2026-06-22; a
  // stale/renamed token fails soft via per-source error isolation). Workday needs
  // tenant + instance + site (derive from a `*.myworkdayjobs.com/<locale>/<site>`
  // URL via detectWorkday); the others take a single careers slug. SmartRecruiters
  // identifiers are case-sensitive (companyToken keeps original case). Workable's
  // public jobs.md feed currently returns header-only for the tenants checked, so
  // workable:deel ingests 0 until that feed populates — kept as a wiring example.
  {
    slug: "workday:nvidia",
    kind: "workday",
    params: {
      tenant: "nvidia",
      instance: "wd5",
      site: "NVIDIAExternalCareerSite",
      company: "NVIDIA",
    },
  },
  {
    slug: "smartrecruiters:visa",
    kind: "smartrecruiters",
    params: { companyToken: "Visa", company: "Visa" },
  },
  {
    slug: "recruitee:bunq",
    kind: "recruitee",
    params: { companyToken: "bunq", company: "bunq" },
  },
  {
    slug: "workable:deel",
    kind: "workable",
    params: { companyToken: "deel", company: "Deel" },
  },
  // Guest scrape (server-side keyword/location/window via params or job_filters)
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
  const { seedDefaultSettings } = await import("../services/settings.js");
  await seedSources(db);
  await seedDefaultSettings(db);
  log.info(
    { event: "seed.done", sources: STARTER_SOURCES.length },
    "starter sources + default settings seeded (existing rows untouched)",
  );
  await closeDb();
  process.exit(0);
}
