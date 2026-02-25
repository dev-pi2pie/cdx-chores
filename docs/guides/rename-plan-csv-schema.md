---
title: "Rename Plan CSV Schema"
created-date: 2026-02-25
status: draft
agent: codex
---

## Goal

Define the CSV contract used by `rename batch --dry-run` / `rename file --dry-run` plan snapshots and `rename apply <csv>` replay in `cdx-chores`.

## Why This Exists

Dry-run and apply can drift if the plan is recomputed later (for example, Codex suggestions, mtimes, or collisions change).

This schema provides a stable snapshot so apply can replay the exact planned rename set.

## File Naming

Dry-run plan files are written under the current working directory (`cwd`) using:

- `rename-<timecode>-<uid>.csv`

Example:

- `rename-20260225-214012-a1b2c3d4.csv`

## CSV Columns (Current Contract)

Columns are stored as UTF-8 CSV with a header row.

- `old_name`
- `new_name`
- `cleaned_stem`
- `ai_new_name`
- `ai_provider`
- `ai_model`
- `changed_at`
- `old_path`
- `new_path`
- `plan_id`
- `planned_at`
- `applied_at`
- `status`
- `reason`

## Column Semantics

- `old_name`
  - basename of the source file at planning time
- `new_name`
  - basename of the planned destination filename
- `cleaned_stem`
  - normalized stem used in the filename (after slugging/cleanup)
- `ai_new_name`
  - Codex-assisted title before final filename assembly (empty if deterministic fallback used)
- `ai_provider`
  - provider label for AI-assisted naming (for current Codex mode: `codex`, else empty)
- `ai_model`
  - model label if known/recorded; may be `auto` or empty when not user-selected
- `changed_at`
  - row-level rename apply timestamp (ISO string) when applied; empty for planned-only rows
- `old_path`
  - source path relative to `cwd` (replay-safe path field)
- `new_path`
  - destination path relative to `cwd` (replay-safe path field)
- `plan_id`
  - identifier shared by rows produced in the same dry-run plan snapshot
- `planned_at`
  - plan creation timestamp (ISO string)
- `applied_at`
  - apply run timestamp (ISO string) if applied, else empty
- `status`
  - row state (`planned`, `skipped`, `applied`, potentially `failed` later)
- `reason`
  - explanatory note for skipped/fallback/failure states (for example `unchanged`)

## Replay Expectations (`rename apply <csv>`)

- Apply uses `old_path` -> `new_path` as the source of truth
- Apply should not recompute rename targets
- Safety checks should verify paths remain within allowed scope before renaming
- Unchanged rows may be retained in CSV with `status=skipped` / `reason=unchanged`

## Compatibility Notes

- Additional columns may be appended in future versions
- Replay should ignore unknown columns where possible
- Required replay fields should be validated strictly (`old_path`, `new_path`, `status` at minimum)

## Related Plans

- `docs/plans/plan-2026-02-25-image-rename-pattern-and-audit-workflow.md`
- `docs/plans/plan-2026-02-25-codex-assisted-image-rename-and-action-tool-integration.md`
