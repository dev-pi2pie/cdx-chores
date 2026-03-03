---
title: "Complete rename cleanup docs and smoke checks"
created-date: 2026-03-03
status: completed
agent: codex
---

## Goal

Finish the remaining user-facing documentation and manual verification items for `rename cleanup` v1.

## Scope

- `README.md`
- `docs/guides/rename-common-usage.md`
- `docs/guides/rename-scope-and-codex-capability-guide.md`
- `docs/plans/plan-2026-03-03-rename-cleanup-v1-implementation.md`
- `docs/plans/jobs/2026-03-03-rename-cleanup-phase3.md`
- `examples/playground/rename-cleanup-smoke/`
- `src/cli/actions/rename/cleanup.ts`
- `test/cli-actions-rename-cleanup-single.test.ts`
- `test/cli-actions-rename-cleanup-directory.test.ts`

## Implemented

- Added `rename cleanup` examples and v1 contract notes to `README.md`.
- Expanded `docs/guides/rename-common-usage.md` with a dedicated cleanup section covering:
  - canonical `--hint`
  - accepted `--hints` alias
  - supported v1 hint families
  - default `--style preserve`
  - `uid-<token>` output format
  - file-vs-directory behavior
  - recursive traversal note
  - `date` vs `timestamp` disjointness
  - serial matcher scope
- Updated `docs/guides/rename-scope-and-codex-capability-guide.md` to state that `rename cleanup` is deterministic-only in v1 and does not use Codex analyzers.
- Added a dedicated manual smoke fixture directory under `examples/playground/rename-cleanup-smoke/`.
- During the manual smoke pass, found and fixed a serial false positive where trailing date fragments such as `2026-03-02` could be misread as serial counters.
- Added a regression test for that serial/date boundary in the cleanup action test suite, now split across `test/cli-actions-rename-cleanup-single.test.ts` and `test/cli-actions-rename-cleanup-directory.test.ts`.

## Manual Smoke Checks

Executed from `examples/playground/rename-cleanup-smoke/`:

```bash
bun ../../../src/bin.ts rename cleanup 'Screenshot 2026-03-02 at 4.53.04 PM.png' --hint timestamp --style slug --dry-run
bun ../../../src/bin.ts rename cleanup . --hint date,uid --recursive --max-depth 1 --dry-run
bun ../../../src/bin.ts rename cleanup . --hint serial --style slug --recursive --max-depth 1 --dry-run
```

Observed results:

- Timestamp single-file dry run previewed:
  - `Screenshot 2026-03-02 at 4.53.04 PM.png -> screenshot-20260302-165304.png`
- Recursive `date,uid` directory dry run reported:
  - `Files found: 4`
  - `Files to rename: 2`
  - `Entries skipped: 2`
- Recursive `serial` directory dry run reported:
  - `Files found: 4`
  - `Files to rename: 1`
  - `Entries skipped: 3`
- Generated plan CSV files were removed between manual runs so the smoke fixture stayed stable and later runs did not count prior dry-run artifacts.

## Verification

- `bunx tsc --noEmit`
- `bun test test/cli-actions-rename-cleanup-single.test.ts test/cli-actions-rename-cleanup-directory.test.ts test/cli-actions-rename-cleanup-uid.test.ts`
- manual dry-run smoke checks listed above

## Related Plans

- `docs/plans/plan-2026-03-03-rename-cleanup-v1-implementation.md`

## Related Research

- `docs/researches/research-2026-03-02-rename-cleanup-subcommand-and-pattern-hints.md`
