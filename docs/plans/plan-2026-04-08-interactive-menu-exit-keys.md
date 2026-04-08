---
title: "Interactive menu exit keys"
created-date: 2026-04-08
modified-date: 2026-04-08
status: completed
agent: codex
---

## Goal

Add consistent interactive-mode exit shortcuts so the root and submenu command menus support `Esc` and `q` for quitting the interactive session, while preserving the current behavior of free-text and path-entry prompts.

## Why This Plan

The related research established a clear near-term direction:

- `Esc` should mean "exit interactive mode"
- `q` should ship in the same slice with the same meaning
- free-text and path-entry prompts should keep their current behavior so literal `q` input still works
- layered `Back` navigation is out of scope

The remaining work is no longer deciding product semantics. It is implementing that contract without letting prompt types blur together.

This needs a dedicated plan because the change cuts across interactive prompt boundaries:

- root and submenu command menus
- prompt tests and integration coverage

## Version-Scoping Note

- this plan is scoped to the small pre-release follow-up currently being discussed around `v0.1.1-canary.1`
- it should not be treated as a larger milestone track

## Current State

- root interactive command selection lives in `src/cli/interactive/menu.ts`
- many other interactive selection steps still call `@inquirer/prompts` directly from flow-local modules
- custom inline prompts already support standalone `Esc` abort behavior through:
  - `src/cli/tui/keys.ts`
  - `src/cli/prompts/path-inline.ts`
  - `src/cli/prompts/text-inline.ts`
- current help and tip wording still emphasizes `Ctrl+C`, but that copy review is intentionally out of scope for this slice

## Scope

### Frozen rollout boundary

Adopt `Esc` and `q` exit behavior only for the interactive command menus:

- root command menu
- submenu command menu

Preserve current behavior for free-entry prompts:

- path prompts
- text prompts
- any prompt where literal character entry is the primary interaction

### Explicit exclusions

Do not include these in the first pass:

- submenu-level `Esc` as `Back`
- prompt-history restoration
- generic wizard navigation
- in-flow `select(...)`, `confirm(...)`, or `checkbox(...)` prompts outside the root/submenu command menus
- help, tip, README, or guide wording updates
- CLI flag-mode changes outside interactive mode

## Design Contract

### Interactive command menus exit the interactive session

Freeze this product rule:

- on the root command menu, `Esc` exits interactive mode
- on the root command menu, `q` exits interactive mode
- on the submenu command menu, `Esc` exits interactive mode
- on the submenu command menu, `q` exits interactive mode
- `Ctrl+C` remains the hard abort path everywhere

This slice should not introduce broader prompt-type changes beyond those two command menus.

### Free-entry prompts preserve current behavior

Do not reinterpret typed `q` as quit when the user is entering text.

Preserve the current contract for:

- `promptPathInlineGhost(...)`
- `promptTextInlineGhost(...)`
- simple `input(...)` prompts

Why:

- users need to be able to type literal `q`
- changing free-entry behavior would create a broader prompt-system contract than this slice intends to own

### Exit semantics should be shared across the two command menus

The implementation should avoid duplicating quit handling between the root and submenu command menus.

Preferred direction:

- introduce a small shared helper or wrapper for the interactive command menus
- keep the wrapper boundary narrow and practical
- do not turn this into a general prompt-system abstraction for unrelated prompt types

### This slice is about exit, not navigation

Do not leave half-implemented room for "Back" semantics inside this plan.

The shipped behavior from this slice should stay simple:

- root or submenu command menu => `Esc` or `q` exits the session
- free-entry prompt => current behavior remains

## Non-Goals

- adding a shared "Back" action to selection prompts
- making `q` a universal quit key in free-entry prompts
- rewriting interactive flow copy to mention the new keys
- reworking inline prompt `Esc` behavior
- changing non-interactive command behavior

## Risks and Mitigations

- Risk: the implementation quietly expands from command menus into unrelated interactive prompt types.
  Mitigation: freeze the rollout boundary to the root and submenu command menus and treat any wider prompt adoption as a separate follow-up.

- Risk: the implementation introduces duplicated wrapper logic between the root and submenu command menus.
  Mitigation: require one shared helper boundary for those two menus before wiring behavior changes.

- Risk: `q` leaks into free-entry prompts and breaks literal text entry.
  Mitigation: keep path/text prompt implementations out of scope and add focused regression coverage that `q` remains ordinary input there.

- Risk: runtime wording temporarily lags shipped behavior.
  Mitigation: accept that mismatch for this slice and record it as a later follow-up rather than expanding scope here.

## Implementation Touchpoints

- interactive command menus in `src/cli/interactive/menu.ts`
- any minimal shared helper extracted specifically for those command menus
- test coverage under `test/`

## Implementation Notes

- the first-pass helper is intentionally limited to the root command menu and submenu command menu
- in-flow `select(...)`, `confirm(...)`, and `checkbox(...)` prompts remain explicitly out of scope for this plan
- free-entry prompts remain unchanged in this slice:
  - `promptPathInlineGhost(...)`
  - `promptTextInlineGhost(...)`
  - simple `input(...)` prompts

## Phase Checklist

### Phase 1: Freeze the exact prompt boundary

- [x] freeze the first-pass rollout boundary to the root command menu and submenu command menu only
- [x] record in the implementation notes that in-flow `select(...)`, `confirm(...)`, and `checkbox(...)` prompts are explicitly excluded from this plan
- [x] record that free-entry prompts remain unchanged in this slice
- [x] treat any request to widen beyond those boundaries as a separate follow-up rather than incidental implementation drift

### Phase 2: Introduce a shared menu-exit helper

- [x] choose a narrow helper boundary that is used only by the root and submenu command menus
- [x] ensure the helper enforces both `Esc` and `q` exit behavior consistently for those two menus
- [x] keep the helper focused on session exit semantics rather than broader navigation, history, or prompt-type generalization
- [x] preserve normal `@inquirer/prompts` behavior when `Esc` or `q` are not invoked
- [x] define "Phase 2 done" as one shared command-menu contract that both menus can call without adding new behavior to unrelated prompt types

### Phase 3: Apply the helper across the command menus

- [x] update the root command menu in `src/cli/interactive/menu.ts`
- [x] update submenu command selection in `src/cli/interactive/menu.ts`
- [x] verify that exiting from either command menu cleanly leaves interactive mode instead of falling into partial prompt cleanup states

### Phase 4: Protect free-entry prompt behavior

- [x] verify that inline path prompts still treat typed `q` as literal input
- [x] verify that inline text prompts still treat typed `q` as literal input
- [x] verify that current inline `Esc` behavior is preserved
- [x] confirm that no shared menu helper leaks into free-entry prompt code paths

### Phase 5: Tests and closing evidence

- [x] add focused tests for `Esc` exit on the root and submenu command menus
- [x] add focused tests for `q` exit on the root and submenu command menus
- [x] add regression coverage that free-entry prompts still accept literal `q`
- [x] run the relevant interactive test subset
- [x] record implementation evidence in a related completed job or plan doc before marking the related research doc `completed`

## Verification Plan

### Functional checks

- [x] root interactive menu exits on `Esc`
- [x] root interactive menu exits on `q`
- [x] submenu interactive menu exits on `Esc`
- [x] submenu interactive menu exits on `q`
- [x] free-entry prompts still accept literal `q`

### Quality checks

- [x] relevant interactive tests pass
- [x] `bunx tsc --noEmit`

## Related Research

- `docs/researches/research-2026-04-08-interactive-exit-key-semantics.md`

## Related Jobs

- `docs/plans/jobs/2026-04-08-interactive-menu-exit-keys.md`
