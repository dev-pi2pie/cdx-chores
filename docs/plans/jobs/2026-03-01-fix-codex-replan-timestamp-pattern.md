---
title: "Fix Codex replan timestamp pattern reuse"
created-date: 2026-03-01
status: completed
agent: codex
---

## Summary

- Fixed Codex-assisted batch and single-file replanning to preserve the already-resolved timestamp pattern instead of falling back to the original CLI pattern.
- Added regression coverage proving semantic title overrides keep the selected timestamp basis.

## What Changed

- `src/cli/actions/rename.ts`
  - reused `effectivePattern` for Codex-driven batch replanning
  - reused `effectivePattern` for Codex-driven single-file replanning
- `test/cli-actions-rename-batch-core.test.ts`
  - added a regression test proving Codex document title overrides keep the selected local timestamp basis
- `test/cli-actions-rename-file.test.ts`
  - added the same Codex replan regression for single-file rename

## Verification

- `bun test test/cli-rename-template.test.ts test/cli-actions-rename-batch-core.test.ts test/cli-actions-rename-file.test.ts`
