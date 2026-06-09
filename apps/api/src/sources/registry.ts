import type { Source, SourceConfig } from "@homejobboard/shared";
import { eq } from "drizzle-orm";
import type { Database } from "../db/index.js";
import { sources as sourcesTable } from "../db/schema.js";
import { greenhouseSource } from "./greenhouse.js";
import { leverSource } from "./lever.js";
import { linkedinSource } from "./linkedin.js";
import { remoteOkSource } from "./remoteok.js";
import { remotiveSource } from "./remotive.js";
import { wwrSource } from "./wwr.js";

/** Instantiate the adapter for a source config. Throws on an unimplemented kind. */
export function buildSource(config: SourceConfig): Source {
  switch (config.kind) {
    case "greenhouse":
      return greenhouseSource(config);
    case "lever":
      return leverSource(config);
    case "remoteok":
      return remoteOkSource(config);
    case "remotive":
      return remotiveSource(config);
    case "wwr":
      return wwrSource(config);
    case "linkedin":
      return linkedinSource(config);
    default:
      throw new Error(`No adapter implemented for source kind "${config.kind}" (${config.slug})`);
  }
}

/** Load enabled source configs from the DB (adapters are built per-source in the
 * pipeline, inside error isolation, so an unimplemented kind never aborts a poll). */
export async function enabledSourceConfigs(db: Database): Promise<SourceConfig[]> {
  const rows = await db.select().from(sourcesTable).where(eq(sourcesTable.enabled, true));
  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    kind: row.kind as SourceConfig["kind"],
    enabled: row.enabled,
    params: (row.params ?? {}) as Record<string, unknown>,
    lastPolledAt: row.lastPolledAt ? row.lastPolledAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  }));
}
