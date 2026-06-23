---
name: turbo-verification-commands
description: Run verification via turbo (pnpm typecheck/test:fast/build), not the devkit skills' generic tsc/vitest.
metadata:
  type: feedback
---

Verify this repo with the **turbo** scripts — `pnpm typecheck`, `pnpm test:fast`
(or `pnpm test`), `pnpm lint`, `pnpm build` — not the `devkit-typecheck` /
`devkit-test` skills' generic `pnpm tsc --noEmit` / `pnpm vitest run`.

**Why:** This is a pnpm + turbo monorepo (`apps/api`, `apps/web`, `packages/shared`),
each workspace with its own tsconfig/vitest config. Running tsc/vitest from the root
ignores those:
- Root `pnpm tsc --noEmit` typechecks `apps/web` (Next.js) without its jsx/DOM/path-alias
  config → a flood of **spurious** errors (`Cannot use JSX unless '--jsx'`, `Cannot find
  name 'window'`, `Cannot find module '@/lib/...'`). These are config noise, not real bugs.
- Root `pnpm vitest run` fails outright — `vitest` is not installed at the repo root
  (`ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL ... "vitest" not found`); it lives per-workspace.

**How to apply:** In `devkit-task`'s check loop (and any manual verify), substitute the
turbo equivalents: lint → `pnpm lint`, typecheck → `pnpm typecheck`, fast tests →
`pnpm test:fast`, build → `pnpm build`. Biome lint (`pnpm biome check .`) does work from
root. Per-workspace test binaries can be reached with `pnpm --filter @homejobboard/api exec tsx <script>`.
