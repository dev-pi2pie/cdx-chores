---
title: "Fix Route A timestamp_tz metadata"
created-date: 2026-03-02
status: completed
agent: codex
---

## Goal

Restore correct rename-plan CSV `timestamp_tz` metadata after adding the Route A explicit timestamp placeholders.

## What Changed

- Updated `src/cli/actions/rename.ts` so `deriveTimestampTzMetadata()` recognizes:
  - `{timestamp_local_iso}`
  - `{timestamp_utc_iso}`
  - `{timestamp_local_12h}`
  - `{timestamp_utc_12h}`
- Kept legacy `{timestamp}` behavior unchanged.
- Preserved mixed local/UTC detection so mixed explicit patterns still emit an empty `timestamp_tz`.
- Added regression coverage in:
  - `test/cli-actions-rename-batch-core.test.ts`
  - `test/cli-actions-rename-file.test.ts`

## Why

The formatter and planner already accepted the new placeholders, but the CSV metadata path still only understood the original local/UTC tokens. That caused valid Route A patterns to record missing or incorrect `timestamp_tz` values in dry-run plan snapshots.

## Verification

- `bun test test/cli-actions-rename-batch-core.test.ts test/cli-actions-rename-file.test.ts`

## Related Plans

- `docs/plans/plan-2026-03-01-rename-timestamp-format-route-a-and-guides.md`
