// Cross-source dedup. Pure logic, unit-tested. The pipeline feeds it the current
// set of job rows and applies the resulting duplicate→canonical mapping.

export interface DedupRow {
  id: string;
  source: string;
  dedupKey: string;
  fetchedAt: Date;
}

/**
 * Given all job rows, return a map of duplicate id → canonical id. A `dedupKey`
 * that spans more than one distinct source collapses to a single canonical row
 * (earliest by fetchedAt, tie-broken by id); the rest point at it. Rows whose key
 * is unique, or that repeat only within one source, are left out of the map.
 */
export function markDuplicates(rows: DedupRow[]): Map<string, string> {
  const byKey = new Map<string, DedupRow[]>();
  for (const r of rows) {
    const list = byKey.get(r.dedupKey);
    if (list) list.push(r);
    else byKey.set(r.dedupKey, [r]);
  }

  const result = new Map<string, string>();
  for (const group of byKey.values()) {
    const distinctSources = new Set(group.map((r) => r.source));
    if (group.length < 2 || distinctSources.size < 2) continue;

    const [canonical, ...rest] = [...group].sort(
      (a, b) => a.fetchedAt.getTime() - b.fetchedAt.getTime() || a.id.localeCompare(b.id),
    );
    if (!canonical) continue;
    for (const dup of rest) result.set(dup.id, canonical.id);
  }
  return result;
}
