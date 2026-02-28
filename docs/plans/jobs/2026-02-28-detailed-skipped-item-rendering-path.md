---
title: "Add detailed skipped-item rendering path"
created-date: 2026-02-28
status: completed
agent: codex
---

## Goal

Complete Phase 3 of the large rename preview plan by adding an explicit Option B-style path for detailed skipped-item dry-run output while preserving the compact Option C default.

## Implemented

- Added `--preview-skips <summary|detailed>` to `rename batch` and `batch-rename`
- Added the same skipped-preview choice to interactive `rename batch` dry-run flow
- Extended `src/cli/rename-preview.ts` with:
  - detailed skipped-item preview budgeting
  - bounded skipped-item detail composition
- Updated `src/cli/actions/rename.ts` so detailed skipped-item output:
  - keeps the default skipped summary section
  - adds a separate bounded skipped-detail section when explicitly requested
  - preserves the compact default behavior when not requested
- Updated usage/help coverage and docs for the new preview mode

## Verification

- `bun test test/cli-rename-preview.test.ts test/cli-actions-rename-batch-core.test.ts`
- `bun test test/cli-ux.test.ts`
- `bunx tsc --noEmit`
