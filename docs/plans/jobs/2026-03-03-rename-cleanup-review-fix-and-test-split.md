---
title: "Rename cleanup review fix and test split"
created-date: 2026-03-03
status: completed
agent: codex
---

## Summary

Applied the first review-driven cleanup pass for `rename cleanup`.

## What Changed

- fixed cleanup plan CSV metadata so `cleaned_stem` records the actual destination stem instead of always slugifying it
- kept preserve-style cleanup CSV rows aligned with the filename that would actually be written
- split the former `test/cli-actions-rename-cleanup.test.ts` monolith into narrower files:
  - `test/cli-actions-rename-cleanup-single.test.ts`
  - `test/cli-actions-rename-cleanup-directory.test.ts`
  - `test/cli-actions-rename-cleanup-validation.test.ts`
  - `test/cli-command-rename-cleanup.test.ts`
- preserved the existing single-file and directory conflict-strategy coverage during the split

## Verification

- `bunx tsc --noEmit`
- `bun test test/cli-actions-rename-cleanup-single.test.ts test/cli-actions-rename-cleanup-directory.test.ts test/cli-actions-rename-cleanup-validation.test.ts test/cli-command-rename-cleanup.test.ts test/cli-actions-rename-cleanup-matchers.test.ts test/cli-actions-rename-cleanup-uid.test.ts`
