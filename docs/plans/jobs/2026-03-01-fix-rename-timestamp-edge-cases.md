---
title: "Fix rename timestamp edge cases"
created-date: 2026-03-01
status: completed
agent: codex
---

## Summary

- Fixed legacy `{timestamp}` detection and rewriting to also handle whitespace-tolerant placeholders such as `{ timestamp }`.
- Fixed `deriveTimestampTzMetadata` in `src/cli/actions/rename.ts` so mixed `{timestamp_local}` plus `{timestamp_utc}` templates record an empty `timestamp_tz` instead of incorrectly claiming a single timezone.

## What Changed

- `src/cli/rename-template.ts` — extracted regex patterns into named constants (`LEGACY_TIMESTAMP_PLACEHOLDER_PATTERN`, `EXPLICIT_TIMESTAMP_PLACEHOLDER_PATTERN`) and made them whitespace-tolerant (`/\{\s*timestamp\s*\}/`). `templateContainsLegacyTimestamp`, `templateContainsExplicitTimestamp`, and `rewriteTimestampPlaceholder` now use the shared constants.
- `src/cli/actions/rename.ts` — updated `deriveTimestampTzMetadata` to detect when both `{timestamp_local}` and `{timestamp_utc}` (or bare `{timestamp}`) are present in the same template and return `""` instead of picking one arbitrarily.
- `test/cli-rename-template.test.ts` — added assertions for whitespace-tolerant detection and rewriting.
- `test/cli-actions-rename-file.test.ts` — added integration test confirming `timestamp_tz` is empty for mixed explicit local+utc placeholders, and a test for spaced `{ timestamp }` rewriting via `actionRenameFile`.

## Verification

- `bun test test/cli-actions-rename-file.test.ts test/cli-rename-template.test.ts`
- `bun test` (full suite — 140 pass, 0 fail)
