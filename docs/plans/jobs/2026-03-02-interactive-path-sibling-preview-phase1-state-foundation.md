---
title: "Interactive path sibling preview phase 1 state foundation"
created-date: 2026-03-02
status: completed
agent: codex
---

## Goal

Establish the Phase 1 prompt-state foundation for sibling preview navigation without changing the current visible `Up` / `Down` behavior yet.

## What Changed

- Added `src/cli/prompts/path-inline-state.ts` to hold pure interaction-state helpers for:
  - legacy `Tab` cycle state
  - sibling-preview state
  - preview ghost-suffix derivation
  - sibling-preview acceptance
- Updated `src/cli/prompts/path-inline.ts` to use the shared interaction state instead of a local `cycleState` variable.
- Wired prompt resets so typing, backspace, `Ctrl+U`, parent-segment navigation, and ghost acceptance all clear transient preview/cycle state consistently.
- Added `test/cli-path-inline-state.test.ts` to cover:
  - abandoning `Tab` cycle state when entering sibling-preview mode
  - clearing sibling preview when starting a new `Tab` cycle
  - accepting sibling preview values
  - ghost-suffix derivation from previewed replacements

## Why

The existing inline prompt had only one transient interaction mode: `Tab` cycling, which mutates the committed input directly. Sibling navigation needs a separate preview-first state that keeps the committed input unchanged until explicit acceptance. Extracting that state model first gives later phases a stable seam for adding cached sibling lists and `Up` / `Down` navigation without overloading the existing `Tab` cycle logic.

## Verification

- `bun test test/cli-path-inline-state.test.ts test/cli-path-suggestions.test.ts`
- `bunx tsc --noEmit`
- `bunx oxlint --tsconfig tsconfig.json src/cli/prompts/path-inline.ts src/cli/prompts/path-inline-state.ts test/cli-path-inline-state.test.ts`
