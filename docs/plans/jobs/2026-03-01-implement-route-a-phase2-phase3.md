---
title: "Implement Route A Phase 2 and Phase 3"
created-date: 2026-03-01
status: completed
agent: codex
---

## Goal

Implement the Route A timestamp-format formatter/template changes and the minimal Phase 3 help-surface changes while preserving existing rename timestamp behavior.

## What Changed

- Updated `src/utils/datetime.ts`:
  - added local ISO formatter with numeric offset
  - added UTC/local compact 12-hour formatter helpers
- Updated `src/cli/fs-utils.ts`:
  - added Route A placeholder validation support
  - wired Route A placeholder rendering into the shared rename planner
- Updated `src/cli/rename-template.ts`:
  - expanded explicit timestamp detection to include Route A placeholders
- Updated `src/command.ts`:
  - extended `--pattern` help text with Route A placeholders
- Updated `src/cli/interactive.ts`:
  - extended custom-template prompt help text with Route A placeholders
  - kept Route A discovery in custom templates only for this phase
- Added and updated tests:
  - `test/utils-datetime.test.ts`
  - `test/cli-fs-utils-rename-template.test.ts`
  - `test/cli-rename-template.test.ts`

## Behavioral Summary

- Preserved existing behavior for:
  - `{timestamp}`
  - `{timestamp_local}`
  - `{timestamp_utc}`
- Added Route A rendering support for:
  - `{timestamp_utc_iso}`
  - `{timestamp_local_iso}`
  - `{timestamp_local_12h}`
  - `{timestamp_utc_12h}`
- Kept interactive timezone rewrite behavior unchanged:
  - legacy `{timestamp}` still participates in timezone selection
  - Route A placeholders are explicit and are not rewritten
- Did not add a new interactive Route A prompt branch in this phase.

## Verification

- `bunx tsc --noEmit`
- `bun test test/cli-fs-utils-rename-template.test.ts test/cli-rename-template.test.ts test/utils-datetime.test.ts`

## Related Plans

- `docs/plans/plan-2026-03-01-rename-timestamp-format-route-a-and-guides.md`

## Related Research

- `docs/researches/research-2026-03-01-rename-timestamp-format-and-template-ux.md`
