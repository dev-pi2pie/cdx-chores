---
title: "Implement rename filename template support with validation"
created-date: 2026-02-25
status: completed
agent: codex
---

## Goal

Implement custom rename filename templates for `rename file` and `rename batch` while preserving deterministic collision suffix handling and existing safety behavior.

## What Changed

- Added `--pattern <template>` support to:
  - `rename file`
  - `rename batch`
  - `batch-rename` (alias)
- Added template support to interactive mode for:
  - `rename file`
  - `rename batch`
- Implemented planner-level template rendering in `src/cli/fs-utils.ts` so batch and single-file flows share behavior.
- Added template validation:
  - allowed placeholders: `{prefix}`, `{timestamp}`, `{stem}`
  - rejects unknown placeholders
  - rejects malformed brace syntax
- Preserved extension handling and collision suffix behavior (`-01`, `-02`, ...) after template rendering.

## Tests Added/Updated

- `test/cli-actions-data-rename.test.ts`
  - custom template in batch dry-run preview
  - custom template collision suffix behavior in single-file rename
  - invalid template placeholder validation

## Verification

- `bun test test/cli-actions-data-rename.test.ts`
- `bun test`
- `bunx tsc --noEmit`

## Related Plans

- `docs/plans/archive/plan-2026-02-25-image-rename-pattern-and-audit-workflow.md`
