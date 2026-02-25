---
title: "Interactive path suggestion engine Phase 2"
created-date: 2026-02-25
status: completed
agent: codex
---

## Goal

Implement Phase 2 (logic-only) for interactive path autocomplete UX:

- add a terminal-independent filesystem path suggestion engine
- cover edge cases with unit tests
- add a small internal prompt runtime config shape for future autocomplete/fallback toggles

## Implemented

- Added `src/cli/prompts/path-suggestions.ts` with:
  - `resolvePathSuggestions(...)`
  - `shouldSuggestForPathInput(...)`
- Suggestion engine behavior includes:
  - relative and absolute path support
  - parsing input into parent-directory segment + basename fragment
  - directory/file filtering
  - optional file-extension filtering
  - hidden-file filtering (off by default)
  - directories-first sorting
  - result cap (`maxSuggestions`)
  - safe empty result on missing/unreadable parent directories
- Added `src/cli/prompts/path-config.ts` for future prompt UI/runtime toggles:
  - `PathPromptRuntimeConfig`
  - `resolvePathPromptRuntimeConfig(...)`
  - env-driven settings for mode + autocomplete defaults
- Wired prompt runtime config resolution into interactive path prompt calls in `src/cli/interactive.ts` (currently no behavior change; scaffolding only)

## Rename Prompt Impact (Important Distinction)

- This phase prepares `rename batch`, `rename file`, and `rename apply` path prompts to benefit from autocomplete suggestions in Phase 3.
- This phase does **not** add derived default-path hints to `rename` commands (those are a different UX pattern than optional output-path defaults used by conversion commands).

## Verification

- `bun test test/cli-path-suggestions.test.ts` (passed)
- `bunx tsc --noEmit` (passed)

## Notes

- The new suggestion engine is independent of terminal rendering/key handling, which remains Phase 3 work.
- Manual terminal compatibility validation remains tracked in the plan as Manual QA.

## Related Plans

- `docs/plans/plan-2026-02-25-interactive-path-hints-and-autocomplete-ux.md`
