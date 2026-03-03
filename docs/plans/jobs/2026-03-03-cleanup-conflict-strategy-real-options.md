---
title: "Cleanup conflict strategy real options"
created-date: 2026-03-03
status: completed
agent: codex
---

## Goal

Expand `rename cleanup` conflict handling from skip-only wiring into the real strategy set:

- `skip`
- `number`
- `uid-suffix`

## What Changed

- expanded cleanup conflict-strategy parsing and validation to accept `skip`, `number`, and `uid-suffix`
- implemented collision-only conflict resolution in the cleanup planner so conflict strategy activates only when the preferred cleaned target collides
- implemented deterministic numeric suffix handling such as `-1`, `-2`, `-3` for cleanup conflicts
- implemented deterministic `-uid-<token>` suffix handling for cleanup conflicts using the existing cleanup UID digest machinery
- applied conflict strategy to both directory cleanup collisions and single-file existing-target collisions
- updated the interactive cleanup flow so the conflict strategy prompt now has real choices instead of a one-option selector
- added targeted regression coverage for same-run directory conflicts and single-file existing-target conflicts under both `number` and `uid-suffix`

## Files

- `src/cli/actions/rename/cleanup.ts`
- `src/command.ts`
- `src/cli/interactive/rename.ts`
- `test/cli-actions-rename-cleanup.test.ts`
- `test/cli-interactive.test.ts`
- `docs/plans/plan-2026-03-03-interactive-rename-template-and-cleanup-flow-enhancements.md`

## Verification

- `bunx tsc --noEmit`
- `bun test test/cli-actions-rename-cleanup.test.ts test/cli-interactive.test.ts test/cli-actions-rename-cleanup-uid.test.ts`

## Follow-up

- manual smoke checks remain open for conflict-heavy fixtures such as `examples/playground/huge-logs`
- cleanup docs wording/status audit remains open in Phase 2.1e
