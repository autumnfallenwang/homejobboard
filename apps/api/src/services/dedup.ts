// Cross-source dedup. Pure logic, unit-tested. The pipeline feeds it the current
// set of job rows and applies the resulting duplicate→canonical mapping.

import { roleFuzzyMatch } from "./role-match.js";

export interface DedupRow {
  id: string;
  source: string;
  dedupKey: string;
  title: string;
  fetchedAt: Date;
}

/**
 * Given all job rows, return a map of duplicate id → canonical id. Rows collapse
 * when they share the exact `dedupKey` (`company|title|location`), OR — within the
 * same company+location — when their titles `roleFuzzyMatch` (so "Senior Data
 * Platform Engineer" and "Data Platform Engineer" fold together). A cluster
 * collapses only when it spans more than one distinct source; the earliest by
 * fetchedAt (tie-broken by id) is canonical and the rest point at it. Rows whose
 * key is unique, or that repeat only within one source, are left out of the map.
 */
export function markDuplicates(rows: DedupRow[]): Map<string, string> {
  const byKey = new Map<string, DedupRow[]>();
  for (const r of rows) {
    const list = byKey.get(r.dedupKey);
    if (list) list.push(r);
    else byKey.set(r.dedupKey, [r]);
  }

  const result = new Map<string, string>();
  for (const group of clusterByRole([...byKey.values()])) {
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

/** The company+location segments of a dedupKey — the bucket fuzzy matching runs within. */
function bucketKey(dedupKey: string): string {
  const [company = "", , location = ""] = dedupKey.split("|");
  return `${company}|${location}`;
}

/**
 * Merge exact-key groups whose representative titles describe the same opening,
 * but only within one company+location bucket. Returns clusters of rows; a group
 * that matches nothing else stays its own cluster (so exact behavior is preserved
 * and fuzzy matching only ever ADDS collapses).
 */
function clusterByRole(groups: DedupRow[][]): DedupRow[][] {
  const buckets = new Map<string, number[]>();
  groups.forEach((g, i) => {
    const key = g[0] ? bucketKey(g[0].dedupKey) : String(i);
    const arr = buckets.get(key);
    if (arr) arr.push(i);
    else buckets.set(key, [i]);
  });

  const parent = groups.map((_, i) => i);
  const find = (x: number): number => {
    let root = x;
    while (parent[root] !== root) root = parent[root] as number;
    return root;
  };
  const union = (a: number, b: number): void => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  };

  for (const idxs of buckets.values()) {
    for (let a = 0; a < idxs.length; a++) {
      for (let b = a + 1; b < idxs.length; b++) {
        const ga = groups[idxs[a] as number];
        const gb = groups[idxs[b] as number];
        if (roleFuzzyMatch(ga?.[0]?.title ?? "", gb?.[0]?.title ?? "")) {
          union(idxs[a] as number, idxs[b] as number);
        }
      }
    }
  }

  const merged = new Map<number, DedupRow[]>();
  groups.forEach((g, i) => {
    const root = find(i);
    const arr = merged.get(root);
    if (arr) arr.push(...g);
    else merged.set(root, [...g]);
  });
  return [...merged.values()];
}
