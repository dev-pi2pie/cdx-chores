---
title: "Rename Plan CSV Schema"
created-date: 2026-02-25
modified-date: 2026-03-01
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

- `rename-plan-<utc-timestamp>Z-<uid>.csv`

Example:

- `rename-plan-20260301T091530Z-a1b2c3d4.csv`

Naming contract:

- `rename-plan-*.csv` is reserved for replayable rename plan artifacts
- `rename apply <csv>` treats this file type as executable input
- future inspect-preview flows should reuse this file as input rather than creating a second same-looking artifact
- if a future viewer persists derived output, it should use a different naming pattern so it is not confused with a replayable plan
- filenames remain UTC-based even if rename output content uses local timestamps

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
- `timestamp_tz`

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
  - explanatory note for skipped/fallback/failure states (for example `unchanged`, `symlink`, `codex_fallback_error`)
- `timestamp_tz`
  - effective timestamp timezone mode recorded at plan generation time when applicable; metadata only, not replay input

## Replay Expectations (`rename apply <csv>`)

- Apply uses `old_path` -> `new_path` as the source of truth
- Apply should not recompute rename targets
- Replay validation should complete before any rename executes
- Unchanged rows may be retained in CSV with `status=skipped` / `reason=unchanged`
- Skipped symlink rows may be included as audit-only rows with `status=skipped` / `reason=symlink`
- `rename apply <csv>` executes only rows with `status=planned` and ignores audit-only skipped rows

## Strict Replay Contract

`rename apply <csv>` should be strict only about the fields that control executable replay:

- `old_path`
- `new_path`
- `status`
- `plan_id`
- `planned_at`

Validation boundary:

- all rows must have non-empty `status`, `plan_id`, and `planned_at`
- executable rows (`status=planned`) must have valid cwd-relative `old_path` and `new_path`
- executable rows must fail preflight on duplicate `old_path` or duplicate `new_path`
- a single apply input must not mix `plan_id` values
- a single apply input must not mix `planned_at` values

Non-goals for this phase:

- enforcing `old_name === basename(old_path)`
- enforcing `new_name === basename(new_path)`
- validating `timestamp_tz`, `reason`, `changed_at`, `applied_at`, or AI metadata before replay
- rejecting additive unknown columns

## Inspect-Preview Boundary

- A future inspect-preview mode should rebuild preview sections from the existing plan CSV rows instead of recomputing rename plans.
- Preview rendering should treat the CSV as the source artifact and remain separate from replay/apply semantics.
- This keeps one artifact contract for rename dry-run output:
  - dry-run writes `rename-plan-*.csv`
  - apply replays `rename-plan-*.csv`
  - inspect-preview reads `rename-plan-*.csv`

## Compatibility Notes

- Additional columns may be appended in future versions
- Replay should ignore unknown columns where possible
- Required replay fields should be validated strictly:
  - `old_path`
  - `new_path`
  - `status`
  - `plan_id`
  - `planned_at`
- Reporting and audit metadata should remain non-blocking unless a future phase explicitly promotes a field into the strict replay contract

## Related Plans

- `docs/plans/plan-2026-02-25-image-rename-pattern-and-audit-workflow.md`
- `docs/plans/plan-2026-02-25-codex-assisted-image-rename-and-action-tool-integration.md`
