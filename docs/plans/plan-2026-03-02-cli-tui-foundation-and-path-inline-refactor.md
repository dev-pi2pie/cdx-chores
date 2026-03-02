---
title: "CLI TUI foundation and path inline refactor"
created-date: 2026-03-02
modified-date: 2026-03-02
status: completed
agent: codex
---

## Goal

Refactor the current raw-terminal prompt implementation so reusable TUI primitives live under `src/cli/tui/`, while preserving the current path prompt behavior and establishing a clean foundation for future scrollable table and preview surfaces.

## Why This Plan

The current advanced path prompt stack is split between:

- `src/cli/prompts/path.ts` as the public prompt API
- `src/cli/prompts/path-inline.ts` as the raw-TTY prompt engine
- `src/cli/prompts/path-inline-state.ts`, `src/cli/prompts/path-suggestions.ts`, and `src/cli/prompts/path-sibling-preview.ts` as focused helpers

That split is directionally correct, but `src/cli/prompts/path-inline.ts` is now carrying too many concerns in one file:

- raw-mode terminal session lifecycle
- cursor visibility and line clearing
- escape-sequence buffering and key handling
- render scheduling
- path-specific prompt state transitions
- path-specific completion and sibling-preview behavior

This concentration makes the file harder to extend and test, and it creates an obvious blocker for the next likely UI feature track:

- scrollable tabular preview for `data preview`

That future table surface should be able to reuse generic terminal mechanics without importing path-specific logic. This plan creates that boundary.

## Reviewed Decisions

1. `src/cli/tui/` should exist, but only for genuinely reusable terminal mechanics.
2. Path prompt domain logic should remain under `src/cli/prompts/`, not move wholesale into `src/cli/tui/`.
3. The first refactor goal is modularity and reuse, not user-visible UX change.
4. A future table view should reuse the same low-level raw-TTY/session primitives instead of introducing a framework shift by default.
5. Unused-variable warnings should remain enabled during this refactor; the plan should not weaken `.oxlintrc.json` to compensate for transitional code shape.

## User Experience Targets

- The current inline path prompt should behave the same after the refactor.
- Fallback simple prompt behavior should remain unchanged.
- Keyboard behavior for ghost hints, `Tab`, `Left` / `Right`, and sibling preview should not regress.
- Future TUI surfaces should be able to reuse terminal primitives without depending on path-prompt internals.

## In Scope

### TUI foundation extraction

- introduce a new `src/cli/tui/` directory
- move reusable raw-terminal lifecycle logic into dedicated modules
- move reusable key/escape normalization into dedicated modules
- move reusable rendering helpers into dedicated modules

### Path prompt refactor

- keep `src/cli/prompts/path.ts` as the public prompt entrypoint
- keep path-specific suggestion/state/domain logic under `src/cli/prompts/`
- reduce the size and responsibility of `src/cli/prompts/path-inline.ts`
- preserve current behavior through tests

### Future-facing viewport boundary

- document the desired viewport/window boundary for future table work without forcing an immediate implementation in this refactor

### Test and lint discipline

- add or update focused tests around extracted modules where behavior is non-trivial
- keep `oxlint` strictness unchanged unless a concrete repo-wide false-positive pattern is proven

## Out of Scope

- changing the current path prompt UX
- adding a full table viewer in this plan
- adopting Ink or another full-screen terminal UI framework
- moving all interactive flows into `src/cli/tui/`
- broad command/menu refactors outside the path prompt engine
- weakening unused-var linting globally in `.oxlintrc.json`

## Target Module Shape

Recommended initial structure:

```text
src/cli/tui/
  index.ts
  raw-session.ts
  keys.ts
  screen.ts

src/cli/prompts/
  path.ts
  path-config.ts
  path-inline.ts
  path-inline-state.ts
  path-suggestions.ts
  path-sibling-preview.ts
```

Recommended responsibilities:

- `src/cli/tui/raw-session.ts`
  - enter/exit raw mode
  - call `emitKeypressEvents(stdin)` during session setup
  - hide/show cursor
  - stdin listener setup/cleanup
  - support prompt-local teardown hooks that run alongside terminal cleanup
  - optional alternate-screen support if added later
- `src/cli/tui/keys.ts`
  - provide an explicit stateful escape/key parser
  - centralize escape-sequence buffering and arrow-key decoding
  - emit normalized prompt-consumable key events from raw `keypress` input
- `src/cli/tui/screen.ts`
  - clear current line
  - beep
  - dim/styling helpers
  - move cursor left/right
  - basic repaint helpers
- `src/cli/prompts/path-inline.ts`
  - path-prompt controller that composes TUI primitives with path suggestion/state logic

## Phases

## Phase 1: Extract terminal session lifecycle

### Task Items

- [x] identify the exact raw-session responsibilities currently embedded in `src/cli/prompts/path-inline.ts`
- [x] extract cursor hide/show, raw-mode enable/disable, stdin resume/pause, and cleanup sequencing into `src/cli/tui/raw-session.ts`
- [x] make `raw-session.ts` own `emitKeypressEvents(stdin)` as part of session setup
- [x] support prompt-local teardown hooks so path-inline-specific timers/buffers can still be cleaned up without moving prompt state into `src/cli/tui/`
- [x] preserve current prompt cleanup guarantees on success, abort, and thrown error paths
- [x] keep the extracted API small and synchronous where possible

### Phase Deliverable

- [x] `path-inline.ts` no longer owns low-level raw-session lifecycle directly

## Phase 2: Extract key normalization and escape handling

### Task Items

- [x] identify the current escape-sequence buffering logic and arrow-key decoding in `src/cli/prompts/path-inline.ts`
- [x] extract that logic into `src/cli/tui/keys.ts` as an explicit stateful escape/key parser rather than vague stateless helpers
- [x] provide a normalized key event shape that the path prompt controller can consume
- [x] preserve existing support for `Tab`, `Enter`, `Backspace`, `Ctrl+C`, `Ctrl+U`, arrows, and `Esc`

### Phase Deliverable

- [x] key interpretation is reusable, stateful where necessary, and path-inline-specific branching is reduced

## Phase 3: Extract render helpers and shrink path-inline controller scope

### Task Items

- [x] move generic line-clearing, cursor-movement, `beep`, and dim/styling helpers into `src/cli/tui/screen.ts`
- [x] keep prompt-line composition either in `path-inline.ts` or a path-specific helper, depending on whether it remains path-specific
- [x] leave `path-inline.ts` responsible mainly for:
  - prompt-local state
  - invoking path suggestion helpers
  - mapping normalized keys to prompt actions
  - scheduling rerenders
- [x] confirm the file becomes materially smaller and easier to scan

### Phase Deliverable

- [x] `path-inline.ts` is reduced to a focused controller instead of a mixed engine/controller file

## Phase 4: Record future viewport boundary without forcing implementation

### Task Items

- [x] document the desired row-window concerns for a future table viewer:
  - visible count
  - offset clamping
  - page up/down movement
  - home/end movement
- [x] explicitly defer `src/cli/tui/viewport.ts` implementation until a real table/preview consumer exists, unless the extraction work reveals an immediate generic use case

### Phase Deliverable

- [x] the future table/preview plan has a clearer boundary without forcing premature API design in this refactor

## Phase 5: Tests, docs, and lint posture

### Task Items

- [x] add focused unit coverage for extracted helpers where behavior is deterministic and non-trivial
- [x] rerun the current path prompt tests to confirm no behavior regression
- [x] add a short architecture note or plan follow-up note if file placement needs explanation for later agents
- [x] keep `.oxlintrc.json` unchanged unless a concrete false-positive case proves a narrowly scoped exception is necessary

### Phase Deliverable

- [x] the TUI foundation refactor lands without UX regression or lint-quality backsliding

## Technical Design Notes

- Prefer extracting stable low-level mechanics before inventing new abstractions.
- Avoid a premature “framework inside the repo” design. `src/cli/tui/` should stay small and practical.
- Do not move path-domain helpers such as sibling preview resolution into `src/cli/tui/`; that would blur the boundary again.
- Keep the public prompt entrypoint stable so existing interactive flows do not need broad call-site churn.
- If an extracted helper is only used once and stays path-specific, keep it in `src/cli/prompts/`.
- Treat alternate-screen support as optional follow-up capability for future table views, not a requirement for the first refactor pass.
- `raw-session.ts` should own generic terminal session setup, including `emitKeypressEvents(stdin)`, while still allowing prompt-local teardown hooks for timers, escape buffers, or controller-specific listener cleanup.
- `keys.ts` should model the current behavior as a stateful parser/session object, because the existing escape handling is not just pure input normalization.
- `keys.ts` remains callback-based for bare-escape abort rather than returning a separate `escape-abort` event; the API should not mix both models.
- `screen.ts` should justify its existence by owning reusable terminal output helpers such as `clearLine`, `beep`, `dim`, and cursor movement helpers.
- Keep unused-variable lint warnings enabled. During refactor work, remove dead bindings instead of normalizing them away through looser config.

## Verification Plan

### Functional checks

- [x] current advanced path prompt still supports ghost suffix rendering
- [x] `Tab` completion/cycling behavior remains intact
- [x] `Right Arrow` still accepts ghost text
- [x] `Left Arrow` still navigates to the parent segment
- [x] sibling preview with `Up` / `Down` still works
- [x] `Ctrl+U`, `Backspace`, `Enter`, and `Esc` behavior remain intact
- [x] simple fallback prompt still activates correctly when advanced mode is unavailable
- [x] add at least one controller-level integration test for `promptPathInlineGhost()` using mock stdin/stdout so the refactor is not validated only through helper-module tests and manual QA

### Structural checks

- [x] `src/cli/tui/` contains only reusable terminal primitives
- [x] `src/cli/prompts/path-inline.ts` is materially smaller than before
- [x] no path-specific filesystem suggestion code is moved into `src/cli/tui/`
- [x] no forced `viewport.ts` lands unless a real extracted consumer appears during the refactor

### Quality checks

- [x] `bunx oxlint --tsconfig tsconfig.json src test scripts`
- [x] focused prompt-related tests pass
- [x] `bunx tsc --noEmit`

## Risks and Mitigations

- Risk: extraction changes key-handling timing and breaks current prompt behavior.
  - Mitigation: preserve behavior through focused tests and phase the extraction so key normalization is isolated after raw-session extraction.
- Risk: `src/cli/tui/` becomes a dumping ground for unrelated interactive code.
  - Mitigation: keep a strict rule that only reusable terminal mechanics belong there.
- Risk: viewport helpers are overdesigned before a real table implementation exists.
  - Mitigation: defer `viewport.ts` implementation until a real consumer exists, and only document the intended boundary in this plan.
- Risk: refactor churn creates temporary unused bindings and pressures the lint config.
  - Mitigation: keep unused-var linting enabled and remove dead code as the refactor proceeds.
- Risk: controller behavior regresses because helper-module tests do not exercise the full raw-prompt flow.
  - Mitigation: add at least one lightweight controller-level integration test for `promptPathInlineGhost()`.

## Deliverables

- `src/cli/tui/` with reusable raw-terminal primitives
- slimmer `src/cli/prompts/path-inline.ts`
- preserved path prompt behavior
- clearer documented boundary for future table/preview viewport work without premature implementation
- no global relaxation of unused-var linting

## Related Guides

- `docs/guides/cli-tui-architecture.md`

## Follow-up Jobs (After Plan Approval)

- [x] Job: extract raw-session and screen primitives from `src/cli/prompts/path-inline.ts`
- [x] Job: extract the stateful escape/key parser to `src/cli/tui/keys.ts`
- [x] Job: add controller-level integration coverage for `promptPathInlineGhost()`
- [x] Job: run prompt regression tests and lint/type checks

## Related Research

- `docs/researches/research-2026-02-25-interactive-path-hints-and-autocomplete-ux.md`
- `docs/researches/research-2026-02-28-interactive-path-ghost-hint-and-sibling-navigation-ux.md`
- `docs/researches/research-2026-02-28-interactive-large-rename-preview-ux-research.md`
- `docs/researches/research-2026-03-02-tabular-data-preview-and-query-scope.md`

## Related Plans

- `docs/plans/plan-2026-02-25-interactive-path-hints-and-autocomplete-ux.md`
- `docs/plans/plan-2026-02-26-interactive-two-layer-command-menu-refactor.md`
- `docs/plans/plan-2026-03-02-interactive-path-sibling-navigation-and-ghost-preview.md`
