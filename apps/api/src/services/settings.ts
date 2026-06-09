import { eq } from "drizzle-orm";
import type { Database } from "../db/index.js";
import { settings } from "../db/schema.js";

// Default app settings. Seeded idempotently on boot; the user refines them later
// (e.g. the fitness profile) via setSetting or the M05 settings UI.
export const DEFAULT_SETTINGS: Record<string, string> = {
  fitness_profile:
    "Senior full-stack/backend software engineer (TypeScript/Node, Python). Wants remote or " +
    "US-based, mid-senior+ level, $150k+. Dealbreakers: crypto/web3, onsite-only, junior roles.",
  llm_model_fitness: "claude-haiku-4-5",
  llm_model_fitness_fallback: "gemma4:26b",
  score_batch_size: "50",
};

export async function getSetting(db: Database, key: string): Promise<string | undefined> {
  const [row] = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
  return row?.value;
}

/** getSetting with a fallback to the baked-in default, then the supplied default. */
export async function getSettingOr(db: Database, key: string, fallback?: string): Promise<string> {
  return (await getSetting(db, key)) ?? DEFAULT_SETTINGS[key] ?? fallback ?? "";
}

export async function setSetting(db: Database, key: string, value: string): Promise<void> {
  await db
    .insert(settings)
    .values({ key, value, updatedAt: new Date() })
    .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: new Date() } });
}

/** Idempotent: insert any missing default settings; existing rows untouched. */
export async function seedDefaultSettings(db: Database): Promise<void> {
  const rows = Object.entries(DEFAULT_SETTINGS).map(([key, value]) => ({ key, value }));
  await db.insert(settings).values(rows).onConflictDoNothing({ target: settings.key });
}
