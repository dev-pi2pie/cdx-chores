---
title: "Implement rename cleanup Phase 3 detectors and transforms"
created-date: 2026-03-03
modified-date: 2026-03-03
status: completed
agent: codex
---

## Goal

Complete the Phase 3 cleanup engine slice for `rename cleanup` by implementing the planned v1 detectors and output transforms across `timestamp`, `date`, `serial`, and `uid`.

## Scope

- `src/cli/actions/rename/cleanup.ts`
- `src/cli/actions/rename/cleanup-uid.ts`
- `test/cli-actions-rename-cleanup.test.ts`
- `test/cli-actions-rename-cleanup-uid.test.ts`
- `docs/plans/plan-2026-03-03-rename-cleanup-v1-implementation.md`

## Implemented

- Added macOS timestamp detection for fragments like:
  - `2026-03-02 at 4.53.04 PM`
- Added date-only cleanup detection for fragments like:
  - `2026-03-02`
- Kept `date` and `timestamp` disjoint:
  - `date` does not match inside the supported macOS timestamp pattern
  - when both hints are present, timestamp matching is attempted first
- Added the v1 `serial` matcher family:
  - parenthesized trailing counters such as `(12)`
  - trailing separated zero-padded counters such as `_003` and `-01`
  - camera-style stems such as `IMG_1234` are excluded in v1
- Added `uid` fragment cleanup detection for existing `uid-<token>` segments using case-insensitive matching.
- Implemented cleanup output styles for the current v1 surface:
  - `preserve`
  - `slug`
  - `uid`
- Added deterministic `uid-<token>` generation:
  - `SHA-256("rename-cleanup-uid-v1\\0" + normalized real source path)`
  - lowercase Crockford-style base32
  - default token length `10`
  - deterministic widening fallbacks `13` and `16`
- Reused the same single-file and directory cleanup planning/reporting flow already added in earlier phases.
- Kept plan/apply safety behavior explicit for:
  - no hint match
  - unchanged results
  - target conflicts
- Added focused directory coverage for:
  - recursive traversal with `--max-depth`
  - filter interaction through `--match-regex`, `--skip-regex`, and `--ext`
  - conflict skips against both same-run duplicate targets and existing on-disk targets

## Verification

- `bunx tsc --noEmit`
- `bun test test/cli-actions-rename-cleanup.test.ts test/cli-actions-rename-cleanup-uid.test.ts`

## Notes

- This job record consolidates the earlier timestamp and date Phase 3 slice notes into one Phase 3 implementation record.
- Remaining cleanup work is outside this Phase 3 scope:
  - user-facing docs in `README.md` and rename guides

## Related Plans

- `docs/plans/plan-2026-03-03-rename-cleanup-v1-implementation.md`

## Related Research

- `docs/researches/research-2026-03-02-rename-cleanup-subcommand-and-pattern-hints.md`
