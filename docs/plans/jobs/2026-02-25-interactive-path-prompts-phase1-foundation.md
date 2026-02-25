---
title: "Interactive path prompts Phase 1 foundation"
created-date: 2026-02-25
status: completed
agent: codex
---

## Goal

Implement Phase 1 of the interactive path hints/autocomplete UX plan:

- extract reusable path prompt helpers from `src/cli/interactive.ts`
- unify derived output-path hint formatting behind a shared prompt helper API
- preserve existing interactive behavior (no autocomplete changes yet)

## Implemented

- Added `src/cli/prompts/path.ts` with reusable helpers:
  - `promptPath(...)`
  - `promptRequiredPath(...)`
  - `promptOptionalPathWithHint(...)`
  - `formatDefaultOutputPathHint(...)`
- Added prompt option typing (`PromptPathOptions`, `PathPromptKind`) to support future prompt variants and autocomplete integration
- Refactored `src/cli/interactive.ts` to use the new helper module for path prompts
- Replaced inline optional-output prompt message construction with `promptOptionalPathWithHint(...)` for:
  - `data json-to-csv`
  - `data csv-to-json`
  - `md to-docx`
  - `video gif`
- Kept action dispatch semantics unchanged (`undefined` still passed for blank optional output paths)

## Verification

- `bunx tsc --noEmit` (passed)

## Notes

- This job intentionally does not implement autocomplete or custom key handling yet.
- `PathPromptKind` is introduced now for prompt intent typing and future behavior branching in later phases.

## Related Plans

- `docs/plans/plan-2026-02-25-interactive-path-hints-and-autocomplete-ux.md`
