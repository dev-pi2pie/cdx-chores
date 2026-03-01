---
title: "Harden rename apply CSV validation"
created-date: 2026-03-01
modified-date: 2026-03-01
status: completed
agent: codex
---

## Summary

- Hardened `rename apply <csv>` so replay input is validated as executable input before any filesystem rename runs.
- Narrowed strict validation to replay-driving fields and kept reporting or additive metadata non-blocking.
- Separated read-time validation (lenient: header presence, valid `status`) from apply-time validation (strict: non-empty `plan_id`/`planned_at`, path checks, cross-row consistency).
- Added malformed-plan regression coverage for missing replay fields, invalid status, duplicate executable paths, inconsistent replay metadata, cwd escape checks, and additive unknown columns.

## What Changed

- `src/cli/rename-plan-csv.ts`
  - added required replay header validation for `old_path`, `new_path`, `status`, `plan_id`, and `planned_at`
  - removed the permissive `status` fallback to `planned`
  - `readRenamePlanCsv` validates headers and `status` but keeps `plan_id`/`planned_at` lenient (trimmed, allowed empty)
  - `validateExecutableApplyRows` (apply-only) enforces non-empty `plan_id`/`planned_at` per row, cross-row consistency, path safety, and duplicate detection
  - kept unknown columns ignored and left reporting fields such as `old_name`, `new_name`, `reason`, `timestamp_tz`, and AI metadata non-blocking
- `test/cli-actions-rename-apply.test.ts`
  - added malformed apply-plan tests covering missing replay columns, blank `status`, missing `plan_id`, missing `planned_at`, invalid `status`, duplicate executable source and target paths, cwd escape rejection, inconsistent replay metadata, and additive unknown columns with basename mismatch tolerance
  - added direct `readRenamePlanCsv` coverage proving inspection-style reads stay lenient for empty `plan_id` / `planned_at` while keeping `status` strict
- `docs/guides/rename-plan-csv-schema.md`
  - documented the read vs apply validation boundary (previously committed in `85af345`; refined in this change to clarify the two-layer contract)
- `docs/plans/plan-2026-03-01-rename-timestamp-timezone-and-plan-csv-naming.md`
  - marked Phase 5 complete and updated related checklist items based on implemented validation and verification

## Verification

- `bun test test/cli-actions-rename-apply.test.ts`
- `bunx tsc --noEmit`
- `bun test`
