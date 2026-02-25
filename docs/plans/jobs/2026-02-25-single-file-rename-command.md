---
title: "Implement rename file single-file workflow"
created-date: 2026-02-25
status: completed
agent: codex
---

## Goal

Add a dedicated single-file rename command (`rename file <path>`) that reuses the existing rename safety conventions and dry-run CSV replay workflow.

## What Changed

- Added `rename file <path>` command in `src/command.ts`
  - `--prefix`
  - `--dry-run`
- Added `actionRenameFile` in `src/cli/actions/rename.ts`
  - prints a single-file preview
  - supports dry-run CSV snapshot generation
  - applies rename directly when not in dry-run
- Added `planSingleRename` in `src/cli/fs-utils.ts`
  - preserves deterministic naming format and collision suffix handling
  - checks collisions against occupied names in the file's directory
  - rejects symlink inputs explicitly for direct-path safety
- Exported the new action/types from `src/cli/actions/index.ts`

## Tests Added

- `test/cli-actions-data-rename.test.ts`
  - dry-run CSV snapshot for single-file rename
  - apply behavior with collision suffix (`-01`, `-02`, ...)
  - symlink input rejection (non-Windows)

## Verification

- `bun test test/cli-actions-data-rename.test.ts`
- `bun test`
- `bunx tsc --noEmit`

## Related Plans

- `docs/plans/plan-2026-02-25-image-rename-pattern-and-audit-workflow.md`
