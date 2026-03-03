---
title: "Implement rename cleanup Phase 1 and Phase 2"
created-date: 2026-03-03
status: completed
agent: codex
---

## Goal

Land the first implementation-facing slice of `rename cleanup` by codifying the v1 contract and wiring the CLI entrypoint with option validation, without yet building the cleanup detection/transform engine.

## Scope

- `src/command.ts`
- `src/cli/actions/index.ts`
- `src/cli/actions/rename/index.ts`
- `src/cli/actions/rename/cleanup.ts`
- `test/cli-actions-rename-cleanup-validation.test.ts`
- `test/cli-command-rename-cleanup.test.ts`
- `docs/plans/plan-2026-03-03-rename-cleanup-v1-implementation.md`
- `docs/researches/research-2026-03-02-rename-cleanup-subcommand-and-pattern-hints.md`

## Implemented

- Added `rename cleanup <path>` to the CLI command surface in `src/command.ts`.
- Added parsed cleanup options for:
  - `--hint`
  - `--hints` alias
  - `--style`
  - `--timestamp-action`
  - directory-scoped traversal/filter flags
- Added `src/cli/actions/rename/cleanup.ts` as the Phase 2 action scaffold.
- Implemented path auto-detection for file vs directory cleanup targets.
- Implemented Phase 2 validation rules in the cleanup action:
  - requires at least one hint
  - accepts only v1 hint families: `date`, `timestamp`, `serial`
  - rejects directory-only flags for file targets
  - rejects `--timestamp-action` unless `--hint timestamp` is active
  - validates `--preview-skips`
  - keeps `--max-depth requires --recursive` behavior for directory targets
- Deferred the actual cleanup engine after validation through the existing deferred-feature error path.
- Exported the cleanup action/types through the rename action barrel and the top-level action barrel.
- Added focused tests covering action validation and CLI alias wiring.
- Updated the active plan to mark Phase 1 and Phase 2 items complete.

## Verification

- `bunx tsc --noEmit`
- `bun test test/cli-actions-rename-cleanup-validation.test.ts test/cli-command-rename-cleanup.test.ts`

## Notes

- This phase intentionally stops after validated dispatch. Actual hint detection, normalization, transformation, and plan/apply integration remain for later phases.
- `--hint uid` remains deferred from v1, so the current command validates only `date`, `timestamp`, and `serial`.

## Related Plans

- `docs/plans/plan-2026-03-03-rename-cleanup-v1-implementation.md`

## Related Research

- `docs/researches/research-2026-03-02-rename-cleanup-subcommand-and-pattern-hints.md`
