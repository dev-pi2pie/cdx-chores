---
title: "Cleanup fragment-removal semantics hotfix"
created-date: 2026-03-03
status: completed
agent: codex
---

## Goal

Align `rename cleanup` with the intended fragment-removal contract for `serial` and `uid` without mixing in the planned Codex-assisted cleanup feature.

## What Changed

- revised serial cleanup so matched serial fragments are removed instead of normalized and re-emitted
- revised UID cleanup so matched `uid-<token>` fragments are removed while preserving surrounding prefix/suffix text
- removed cleanup `uid` style output behavior and kept cleanup output styling to `preserve` and `slug`
- updated the interactive cleanup flow and CLI help/error surface to match the reduced cleanup style contract
- updated cleanup docs/examples to describe fragment-removal semantics instead of whole-basename UID replacement
- added regression coverage for log-style serial cleanup and mixed-prefix/suffix UID cleanup

## Files

- `src/cli/actions/rename/cleanup-matchers.ts`
- `src/cli/actions/rename/cleanup.ts`
- `src/cli/interactive/rename.ts`
- `src/command.ts`
- `test/cli-actions-rename-cleanup-single.test.ts`
- `test/cli-actions-rename-cleanup-directory.test.ts`
- `test/cli-actions-rename-cleanup-matchers.test.ts`
- `README.md`
- `docs/guides/rename-common-usage.md`
- `docs/guides/rename-scope-and-codex-capability-guide.md`
- `docs/plans/plan-2026-03-03-interactive-rename-template-and-cleanup-flow-enhancements.md`

## Verification

- `bunx tsc --noEmit`
- `bun test test/cli-actions-rename-cleanup-single.test.ts test/cli-actions-rename-cleanup-directory.test.ts test/cli-actions-rename-cleanup-matchers.test.ts test/cli-interactive-rename.test.ts`
