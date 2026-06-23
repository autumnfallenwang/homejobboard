---
name: drizzle-date-in-raw-sql
description: A JS Date interpolated into a raw drizzle sql`` template fails to bind via postgres-js — use a column-value set.
metadata:
  type: reference
---

Interpolating a JS `Date` into a raw drizzle `sql` template — e.g.
`set({ appliedAt: sql\`coalesce(${jobs.appliedAt}, ${at})\` })` — fails at runtime under
postgres-js: `TypeError: The "string" argument must be of type string or an instance of
Buffer or ArrayBuffer. Received an instance of Date`. postgres-js binds the `Date` as a raw
parameter with no column-type context, so it can't serialize it.

**Why:** bit us in M10 `setJobStatus` (`coalesce(applied_at, $date)` to stamp `appliedAt` only on
first entry to `applied`).

**How to apply:** Don't put `Date` values inside raw `sql` templates. Either:
- set the column the normal drizzle way — `.set({ col: dateValue })` — which serializes the Date
  correctly (do conditional logic in JS: fetch-then-set), or
- if you truly need raw SQL, cast an ISO string: `sql\`${d.toISOString()}::timestamptz\``.

Non-Date raw expressions (e.g. `sql\`${jobs.followUpCount} + 1\``) are fine.
