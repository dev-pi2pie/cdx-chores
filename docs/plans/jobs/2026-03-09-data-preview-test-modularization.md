---
title: "Data preview test modularization"
created-date: 2026-03-09
modified-date: 2026-03-09
status: completed
agent: codex
---

## Goal

Split `test/cli-actions-data-preview.test.ts` into smaller focused modules without changing the covered behavior.

## Scope

- `test/cli-actions-data-preview.test.ts`
- `test/cli-actions-data-preview/helpers.ts`
- `test/cli-actions-data-preview/rendering.test.ts`
- `test/cli-actions-data-preview/highlighting.test.ts`
- `test/cli-actions-data-preview/failures.test.ts`

## What Changed

- Replaced the single monolithic data preview test file with a folder-based suite split by concern: rendering, TTY/highlighting behavior, and failure modes.
- Added `test/cli-actions-data-preview/helpers.ts` to centralize repeated fixture creation, runtime setup, preview invocation, TTY toggling, and ANSI assertions.
- Kept the existing assertions and scenario coverage intact while removing repeated temp-directory and input-file boilerplate from each individual test.
- Narrowed the shared `runDataPreview` helper type to only require `runtime` and `input`, so failure-mode tests can destructure assertion helpers without triggering TypeScript assignability errors.

## Verification

- `bun test test/cli-actions-data-preview`
- `bunx oxlint --tsconfig tsconfig.json test/cli-actions-data-preview`
- `bunx tsc --noEmit`

## Related Plans

- `docs/plans/plan-2026-03-02-test-suite-modularization-and-redundancy-reduction.md`

## Related Research

- `docs/researches/research-2026-03-02-test-suite-audit.md`
