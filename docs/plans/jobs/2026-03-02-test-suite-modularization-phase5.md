---
title: "Test suite modularization phase 5"
created-date: 2026-03-02
modified-date: 2026-03-02
status: completed
agent: codex
---

## Goal

Complete Phase 5 from `docs/plans/plan-2026-03-02-test-suite-modularization-and-redundancy-reduction.md` by reducing controller-level duplication in `test/cli-path-inline.test.ts` while preserving the prompt wiring behaviors that still need end-to-end coverage.

## Scope

- `test/cli-path-inline.test.ts`
- `test/cli-path-inline-state.test.ts`
- `test/cli-path-sibling-preview.test.ts`
- `test/cli-path-suggestions.test.ts`

## Review Outcome

Controller-level tests still needed to own:

- raw-session lifecycle and teardown
- visible ghost-text rendering in the real prompt loop
- direct key wiring for right-arrow acceptance and Tab cycling
- parent-segment navigation
- one sibling-preview end-to-end flow
- late async suggestion completion not repainting after settle

Lower-level tests already owned:

- sibling-preview state transitions and wrap logic
- ghost suffix derivation rules
- suggestion ordering/filtering behavior
- sibling-preview candidate scope and hidden-entry behavior

## Implemented

- Refactored `test/cli-path-inline.test.ts` to use a shared `createPromptHarness(...)` helper and `nextRenderTick()` helper instead of repeating prompt/session setup in every test.
- Removed the controller-level `Backspace, Ctrl+U, and Enter` test because it added little unique value compared with the remaining raw-session submission test and did not own one of the explicit controller-only contracts kept in the active plan.
- Kept controller coverage for:
  - ghost text rendering
  - typed submission and raw-session restoration
  - direct right-arrow ghost acceptance
  - Tab completion cycling
  - left-arrow parent navigation
  - one sibling-preview end-to-end flow
  - escape abort teardown
  - async settle safety

## Result

- `test/cli-path-inline.test.ts` shrank from 437 lines to 272 lines.
- The controller spec now reads more clearly as a prompt-wiring test file instead of a mixed controller/state bucket.
- Full path-prompt coverage remains split across:
  - `test/cli-path-inline.test.ts`
  - `test/cli-path-inline-state.test.ts`
  - `test/cli-path-sibling-preview.test.ts`
  - `test/cli-path-suggestions.test.ts`

## Verification

- `bun test test/cli-path-inline.test.ts test/cli-path-inline-state.test.ts test/cli-path-sibling-preview.test.ts test/cli-path-suggestions.test.ts` ✅
- `bun test` ✅

## Related Plans

- `docs/plans/plan-2026-03-02-test-suite-modularization-and-redundancy-reduction.md`

## Related Research

- `docs/researches/research-2026-03-02-test-suite-audit.md`
