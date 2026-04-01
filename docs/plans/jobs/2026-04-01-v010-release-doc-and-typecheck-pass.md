---
title: "0.1.0 Release Doc And Typecheck Pass"
created-date: 2026-04-01
status: completed
agent: codex
---

## Goal

Prepare the repository for the `0.1.0` stable release by refreshing release-facing wording, restoring a clean TypeScript verification pass, and recording the next documentation archive scope.

## What Changed

- updated `README.md` and public guides to describe the stable release as `v0.1.0` instead of anchoring the wording on `v0.0.9`
- replaced several “first-pass” / draft-style guide phrases with stable-contract wording where the behavior is already shipped
- promoted stable public guides to `completed` where the documented contract is already implemented:
  - `docs/guides/md-frontmatter-to-json-output-contract.md`
  - `docs/guides/rename-plan-csv-schema.md`
  - `docs/guides/rename-timestamp-format-matrix.md`
- added `test/version-embedded-sync.test.ts` to guard embedded CLI version drift against `package.json` and the build script contract
- fixed TypeScript `--noEmit` failures in:
  - `src/cli/data-query/codex.ts`
  - `src/cli/duckdb/query/introspection.ts`
  - `src/cli/duckdb/query/prepare-source/sql.ts`
  - `src/cli/duckdb/query/prepare-workspace.ts`
  - `src/cli/interactive/data-query/source-selection.ts`
  - `test/helpers/interactive-harness/mocks/data-query.ts`
- drafted the next archive-scope plan in `docs/plans/plan-2026-04-01-v010-release-doc-and-archive-scope.md`

## Verification

- `bun run build`
- `bunx tsc --noEmit`
- `bun test test/cli-path-inline.test.ts`
- `bun test`

## Follow-Up

- execute the archive plan in a separate pass after status normalization for stale top-level plans and research docs
- investigate the path-inline test if it shows up as flaky again under full-suite parallel timing, even though the focused rerun passed cleanly during this pass

## Related Plans

- `docs/plans/plan-2026-04-01-v010-release-doc-and-archive-scope.md`
