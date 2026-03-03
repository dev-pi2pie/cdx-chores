---
title: "Fix rename cleanup review findings"
created-date: 2026-03-03
status: completed
agent: codex
---

## Goal

Address the final code review findings for `rename cleanup`, focusing on multi-hint behavior, date-vs-timestamp matching boundaries, directory dry-run artifact pollution, and the matcher test seam.

## Scope

- `src/cli/actions/rename/cleanup.ts`
- `src/cli/actions/rename/cleanup-matchers.ts`
- `test/cli-actions-rename-cleanup-single.test.ts`
- `test/cli-actions-rename-cleanup-directory.test.ts`
- `test/cli-actions-rename-cleanup-matchers.test.ts`
- `README.md`
- `docs/guides/rename-common-usage.md`

## Implemented

- Changed cleanup matching so multiple selected hint families are applied sequentially instead of stopping after the first successful family match.
- Preserved the v1 precedence order:
  - `timestamp`
  - `date`
  - `serial`
  - `uid`
- Tightened `date` matching so standalone date fragments can still be detected even when a macOS timestamp appears elsewhere in the same filename.
- Excluded generated `rename-plan-*.csv` dry-run artifacts from directory cleanup candidate scans.
- Moved matcher logic into `src/cli/actions/rename/cleanup-matchers.ts` so tests no longer depend on a `__testOnly...` export from the main cleanup action module.
- Added regression coverage for:
  - sequential multi-hint cleanup
  - standalone date matching alongside timestamp fragments
  - dry-run plan CSV exclusion during directory scans

## Verification

- `bunx tsc --noEmit`
- `bun test test/cli-actions-rename-cleanup-single.test.ts test/cli-actions-rename-cleanup-directory.test.ts test/cli-actions-rename-cleanup-validation.test.ts test/cli-actions-rename-cleanup-uid.test.ts test/cli-actions-rename-cleanup-matchers.test.ts`

## Related Plans

- `docs/plans/plan-2026-03-03-rename-cleanup-v1-implementation.md`

## Related Research

- `docs/researches/research-2026-03-02-rename-cleanup-subcommand-and-pattern-hints.md`
