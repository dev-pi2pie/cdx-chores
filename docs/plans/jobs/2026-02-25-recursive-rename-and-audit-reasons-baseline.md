---
title: "Implement recursive batch rename and audit reason baseline"
created-date: 2026-02-25
status: completed
agent: codex
---

## Goal

Implement Phase 4 traversal/symlink policy behavior and a Phase 5 audit baseline for `rename batch`, including recursive traversal, explicit symlink skip logging, and richer dry-run CSV reason fields.

## What Changed

- Added recursive traversal support to `rename batch` / `batch-rename`
  - CLI flag: `--recursive`
  - CLI flag: `--max-depth <n>` (root depth = `0`)
  - interactive prompt: "Traverse subdirectories recursively?"
  - interactive optional max depth prompt when recursive mode is enabled
- Updated batch planner (`src/cli/fs-utils.ts`)
  - traverses subdirectories when recursive mode is enabled
  - preserves in-place renames within each file's current directory
  - skips symlink files/directories explicitly
  - returns skipped entries with reasons for action/audit use
- Updated rename action (`src/cli/actions/rename.ts`)
  - logs skipped symlink entries in preview output
  - includes skipped entries in dry-run CSV rows (`status=skipped`, `reason=symlink`)
  - records richer Codex-related row reasons in dry-run CSV (fallback/ineligible cases)
  - updates Codex summary denominator to count image candidates (including ineligible ones)
- Extended CSV row creation (`src/cli/rename-plan-csv.ts`)
  - supports appended audit-only skipped rows
  - supports explicit per-source `reason` overrides

## Tests Added/Updated

- `test/cli-actions-data-rename.test.ts`
  - recursive traversal includes nested files
  - symlink skip logging and CSV `reason=symlink`
  - single-file Codex fallback CSV reason
  - batch Codex ineligible reason rows (`codex_skipped_non_static`, `codex_skipped_too_large`)

## Verification

- `bun test test/cli-actions-data-rename.test.ts`
- `bun test`
- `bunx tsc --noEmit`

## Related Plans

- `docs/plans/plan-2026-02-25-image-rename-pattern-and-audit-workflow.md`
