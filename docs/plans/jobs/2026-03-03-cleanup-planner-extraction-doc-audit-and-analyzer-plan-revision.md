---
title: "Cleanup planner extraction, doc audit, and analyzer plan revision"
created-date: 2026-03-03
status: completed
agent: codex
---

## Summary

Completed the next three follow-up tasks after the cleanup review pass.

## What Changed

- extracted the internal cleanup planning/candidate/CSV helper layer out of `src/cli/actions/rename/cleanup.ts`
- added:
  - `src/cli/actions/rename/cleanup-contract.ts`
  - `src/cli/actions/rename/cleanup-planner.ts`
- kept the public cleanup action contract stable while reducing the weight of `cleanup.ts`
- audited job records for stale references to the removed monolithic cleanup and interactive test files
- updated those records to point at the current split test files
- revised `docs/plans/plan-2026-03-03-codex-analyzer-assisted-rename-cleanup.md` into an active next-step plan with:
  - settled Phase 1 contract items checked
  - explicit first implementation slice
  - likely touchpoints

## Verification

- `bunx tsc --noEmit`
- `bun test test/cli-actions-rename-cleanup-single.test.ts test/cli-actions-rename-cleanup-directory.test.ts test/cli-actions-rename-cleanup-validation.test.ts test/cli-command-rename-cleanup.test.ts test/cli-actions-rename-cleanup-matchers.test.ts test/cli-actions-rename-cleanup-uid.test.ts test/cli-interactive-routing.test.ts test/cli-interactive-rename.test.ts`
