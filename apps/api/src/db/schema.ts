import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

// A configured source. `slug` is the stable adapter id ("greenhouse:stripe",
// "remoteok"); `params` carries per-kind config (ATS company token, RemoteOK tag).
export const sources = pgTable("sources", {
  id: uuid().primaryKey().defaultRandom(),
  slug: text().notNull().unique(),
  kind: text().notNull(),
  enabled: boolean().notNull().default(true),
  params: jsonb().notNull().default({}),
  lastPolledAt: timestamp({ withTimezone: true }),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

// The normalized job (ADR 0003). `dedupKey` collapses the same job across sources;
// `duplicateOfId` points a duplicate at the canonical row it folds into.
export const jobs = pgTable(
  "jobs",
  {
    id: uuid().primaryKey().defaultRandom(),
    source: text().notNull(),
    sourceJobId: text().notNull(),
    url: text().notNull(),
    applyUrl: text(),
    title: text().notNull(),
    company: text().notNull(),
    location: text(),
    workplaceType: text(),
    postedAt: timestamp({ withTimezone: true }),
    description: text(),
    salaryMin: integer(),
    salaryMax: integer(),
    employmentType: text(),
    seniority: text(),
    tags: text().array(),
    fetchedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    dedupKey: text().notNull(),
    duplicateOfId: uuid(),
  },
  (table) => [
    unique("jobs_source_source_job_id_unique").on(table.source, table.sourceJobId),
    index("jobs_dedup_key_idx").on(table.dedupKey),
    index("jobs_posted_at_idx").on(table.postedAt),
  ],
);

// Key/value app settings (fitness profile, LLM model choices, batch sizes).
export const settings = pgTable("settings", {
  key: text().primaryKey(),
  value: text().notNull(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

// LLM fitness score, 1:1 with a job (unique jobId, cascade on delete).
export const jobScores = pgTable("job_scores", {
  id: uuid().primaryKey().defaultRandom(),
  jobId: uuid()
    .notNull()
    .references(() => jobs.id, { onDelete: "cascade" })
    .unique(),
  fitness: integer().notNull(),
  reasons: text().array(),
  model: text().notNull(),
  composite: doublePrecision().notNull(),
  scoredAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});
