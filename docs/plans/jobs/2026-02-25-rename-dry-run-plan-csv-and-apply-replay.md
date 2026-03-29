---
title: "Implement rename dry-run plan CSV and apply replay workflow"
created-date: 2026-02-25
status: completed
agent: codex
---

## Goal

Make `rename batch --dry-run` produce a stable, replayable rename plan CSV and add a `rename apply <csv>` command so apply uses the exact dry-run snapshot instead of recomputing the rename plan.

## Implemented

- Added rename plan CSV helper module:
  - `src/cli/rename-plan-csv.ts`
- `rename batch --dry-run` now writes a plan CSV under `cwd`:
  - `rename-<timecode>-<uid>.csv`
- Added `rename apply <csv>` command in `src/command.ts`
- Added `actionRenameApply(...)` in `src/cli/actions/rename.ts`
- Interactive mode `rename batch` "Apply now?" path now uses the generated CSV plan via `actionRenameApply(...)`
- Added dedicated interactive command option for `rename apply`
- Added CSV schema guide:
  - `docs/guides/rename-plan-csv-schema.md`

## CSV Schema Notes

The current plan CSV includes replay-safe path fields (`old_path`, `new_path`) plus audit-friendly metadata fields including:

- `old_name`, `new_name`
- `cleaned_stem`
- `ai_new_name`, `ai_provider`, `ai_model`
- `changed_at`
- `plan_id`, `planned_at`, `applied_at`
- `status`, `reason`

## Verification

Automated checks:

- `bun test` ✅ (`23 pass`, `0 fail`)
- `bunx tsc --noEmit` ✅

Key tests added/updated:

- dry-run writes replayable CSV plan under `cwd`
- `rename apply` replays the CSV snapshot exactly (even if file mtime changes after dry-run)
- existing rename dry-run tests updated to clean generated plan CSV files

Manual CLI checks:

- `bun src/bin.ts rename apply --help` ✅

## Follow-up Jobs

- Job: add CLI-level tests for `rename apply <csv>` command wiring and output
- Job: enrich apply-time validations and row-level failure reporting (`status=failed`, `reason`)
- Job: add optional alias UX decision (`rename batch --rename-csv <path>` vs `rename apply <csv>` only)

## Related Plans

- `docs/plans/archive/plan-2026-02-25-image-rename-pattern-and-audit-workflow.md`
- `docs/plans/archive/plan-2026-02-25-codex-assisted-image-rename-and-action-tool-integration.md`

