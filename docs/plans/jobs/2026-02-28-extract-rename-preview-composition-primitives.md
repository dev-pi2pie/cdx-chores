---
title: "Extract rename preview composition primitives"
created-date: 2026-02-28
status: completed
agent: codex
---

## Goal

Start Phase 1 of the large rename preview implementation plan by extracting testable preview composition primitives out of `src/cli/actions/rename.ts` without changing the visible rename preview behavior yet.

## Implemented

- Added `src/cli/rename-preview.ts`
- Extracted reusable helpers for:
  - planned rename line formatting
  - skipped rename line formatting
  - skipped-reason summaries
  - head/tail slice composition
  - batch preview data composition
- Updated `src/cli/actions/rename.ts` to use the extracted preview composition helper for batch preview lines
- Kept the current visible preview ordering stable for this first job
- Added focused tests in `test/cli-rename-preview.test.ts`

## Verification

- `bun test test/cli-rename-preview.test.ts`
- `bun test test/cli-actions-rename-batch-core.test.ts`
- `bun test test/cli-actions-rename-file.test.ts`
