---
title: "Interactive path sibling preview phase 2 and phase 3 navigation"
created-date: 2026-03-02
status: completed
agent: codex
---

## Goal

Implement cached sibling candidate resolution and wire preview-first keyboard navigation into the inline path prompt.

## What Changed

- Added `src/cli/prompts/path-sibling-preview.ts` to:
  - derive a stable segment-scope cache key
  - resolve sibling preview candidates for the current segment
  - support empty-fragment browsing such as `./docs/`
- Updated `src/cli/prompts/path-suggestions.ts` so explicit dot-prefix input can reveal hidden matches even when hidden suggestions are globally disabled.
- Extended `src/cli/prompts/path-inline-state.ts` with wrap-around sibling preview navigation helpers.
- Updated `src/cli/prompts/path-inline.ts` to:
  - cache sibling candidates by segment scope
  - use `Up` / `Down` for sibling preview navigation
  - abandon legacy `Tab` cycle mode when entering sibling preview mode
  - make `Tab` accept active sibling preview before falling back to legacy cycle behavior
  - keep `Right Arrow` accepting the visible preview/ghost
- Added tests in:
  - `test/cli-path-inline-state.test.ts`
  - `test/cli-path-sibling-preview.test.ts`
  - `test/cli-path-suggestions.test.ts`
- Updated `docs/guides/interactive-path-prompt-ux.md` so the guide matches the new arrow-key and hidden-entry behavior.

## Why

Phase 1 separated legacy `Tab` cycle state from sibling preview state, but the prompt still had no real sibling navigation. These changes complete the next UX step by resolving a stable same-segment candidate set, moving within that set with wrap-around semantics, and keeping preview acceptance explicit so arrow navigation remains non-destructive.

## Verification

- `bun test test/cli-path-inline-state.test.ts test/cli-path-sibling-preview.test.ts test/cli-path-suggestions.test.ts`
- `bunx tsc --noEmit`
- `bunx oxlint --tsconfig tsconfig.json src/cli/prompts/path-inline.ts src/cli/prompts/path-inline-state.ts src/cli/prompts/path-sibling-preview.ts src/cli/prompts/path-suggestions.ts test/cli-path-inline-state.test.ts test/cli-path-sibling-preview.test.ts test/cli-path-suggestions.test.ts`
