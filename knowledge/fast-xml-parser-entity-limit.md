---
name: fast-xml-parser-entity-limit
description: fast-xml-parser errors "Entity expansion limit exceeded" on large RSS feeds — fix with processEntities:false
metadata:
  type: reference
---

`fast-xml-parser` throws **"Entity expansion limit exceeded: N > 1000"** when a document
expands more than ~1000 HTML/XML entities. Real-world RSS feeds hit this easily — the full
We Work Remotely feed (`weworkremotely.com/remote-jobs.rss`) has 100 items whose escaped-HTML
descriptions (`&lt;p&gt;…`) blow past the limit, even though a small fixture parses fine.

**Fix:** construct the parser with `processEntities: false` and decode entities yourself on the
fields you actually use (the WWR adapter uses `apps/api/src/sources/html.ts` → `decodeEntities`):

```ts
new XMLParser({ ignoreAttributes: true, trimValues: true, processEntities: false });
```

This skips the parser's entity counting entirely and — handily — leaves RSS `<description>`
values as their already-escaped HTML, so one `decodeEntities()` pass un-escapes them into real
HTML for storage. Used by `apps/api/src/sources/wwr.ts`.
