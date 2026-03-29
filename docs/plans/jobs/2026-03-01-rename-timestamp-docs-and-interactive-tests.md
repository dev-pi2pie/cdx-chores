---
title: "Rename timestamp documentation and interactive-flow tests"
created-date: 2026-03-01
status: completed
agent: codex, copilot
---

## Summary

- Updated all user-facing documentation to cover the new `{timestamp_local}` and `{timestamp_utc}` placeholders, the `--timestamp-timezone` flag, and the UTC-based plan CSV filename shape.
- Extracted the interactive timestamp-timezone decision logic into pure testable helpers (`shouldPromptTimestampTimezone`, `resolveTimestampPatternForInteractive`) and added decision-table tests.
- Ran final verification: tsc clean, 158 tests (0 failures), focused dry-run smoke checks in `examples/playground/`.

## What Changed

### Documentation (Phase 6)

- `README.md`
  - updated `rename apply` example filename to `rename-plan-20260225T214012Z-a1b2c3d4.csv`
  - expanded placeholder list with `{timestamp_local}` and `{timestamp_utc}`
  - added "Timestamp placeholders" notes section with migration guidance
- `docs/guides/rename-common-usage.md`
  - updated `rename apply` example filename
  - expanded placeholder list with type annotations for all timestamp variants
  - added "Timestamp Timezone Selection" subsection (precedence rules, flag usage, migration guidance)
  - added "Plan CSV Naming" subsection documenting the UTC timecode filename shape
  - added cross-reference to `docs/guides/rename-plan-csv-schema.md`
  - updated `modified-date` to `2026-03-01`
- `docs/guides/rename-scope-and-codex-capability-guide.md`
  - expanded placeholder list with `{timestamp_local}` and `{timestamp_utc}` and annotations
  - added "Timestamp notes" subsection
  - updated `modified-date` to `2026-03-01`

### Interactive-Flow Tests (Phase 7)

- `src/cli/rename-template.ts`
  - added `shouldPromptTimestampTimezone(pattern)` — pure alias exposing the prompt-trigger decision
  - added `resolveTimestampPatternForInteractive(pattern, selectedTimezone)` — conditional rewrite combining detection and replacement
- `src/cli/interactive.ts`
  - refactored conditional timestamp-timezone block to use the new pure helpers instead of inline `templateContainsLegacyTimestamp` + `rewriteTimestampPlaceholder`
- `test/cli-rename-template.test.ts`
  - added `interactive timestamp timezone flow` describe block with 6 tests covering:
    - `shouldPromptTimestampTimezone` for legacy, explicit, none, and mixed patterns
    - `resolveTimestampPatternForInteractive` for utc/local selection, undefined selection, explicit patterns (no-op), no-timestamp patterns (no-op), and multiple legacy occurrences

### Verification (Phase 7)

- `bunx tsc --noEmit` — clean
- `bun test` — 158 pass, 0 fail, 802 expect() calls across 18 files
- Dry-run smoke checks in `examples/playground/`:
  - `{timestamp}` → UTC output
  - `{timestamp_local}` → local output
  - `{timestamp_utc}` → UTC output
  - `{timestamp}` + `--timestamp-timezone local` → local output
  - Plan CSV filenames consistently use `…T…Z-…` shape

## Related Plans

- `docs/plans/archive/plan-2026-03-01-rename-timestamp-timezone-and-plan-csv-naming.md` — Phase 6 and Phase 7
