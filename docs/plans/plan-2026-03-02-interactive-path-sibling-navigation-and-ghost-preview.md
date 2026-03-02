---
title: "Interactive path sibling navigation and ghost preview implementation plan"
created-date: 2026-03-02
modified-date: 2026-03-02
status: completed
agent: codex
---

## Goal

Implement the next iteration of the interactive path prompt so users can browse same-level filesystem siblings with `Up` / `Down` while preserving the current input-first ghost-hint model.

## Why This Plan

The current inline prompt in `src/cli/prompts/path-inline.ts` already supports:

- typed input as the primary interaction
- inline ghost suffix rendering
- `Tab` cycling/acceptance
- `Right Arrow` ghost acceptance
- `Left Arrow` parent-segment navigation

What is missing is a clear same-level navigation model. The research in `docs/researches/research-2026-02-28-interactive-path-ghost-hint-and-sibling-navigation-ux.md` identified the UX space; this plan converts those findings into an implementation sequence with explicit state rules so the prompt remains predictable.

## Locked Decisions

- `Up Arrow` and `Down Arrow` perform sibling navigation, not history navigation.
- Sibling navigation wraps at the ends of the sibling list.
- Sibling navigation works when the current segment prefix is empty, including root-level cases such as `./`.
- Arrow-key sibling selection is previewed as ghost state first; it is not immediately committed into the typed input.
- Directory siblings sort before files, then alphabetically within each group.
- `Tab` accepts the currently previewed sibling selection.

## Proposed Hidden-Entry Policy

Recommended ship behavior:

- keep hidden entries excluded from sibling browsing when hidden suggestions are globally disabled
- continue using the existing `CDX_CHORES_PATH_AUTOCOMPLETE_INCLUDE_HIDDEN` runtime flag as the primary toggle
- add one intentional exception: if the current segment fragment starts with `.`, allow hidden matches for that fragment even when the global hidden toggle is off

This keeps empty-prefix browsing like `./` or `./docs/` from flooding the cycle with dotfiles, while still allowing intentional access to hidden entries through explicit typing such as `./.g`.

## User Experience Targets

- `Up` / `Down` should feel local to the current path segment, never like command history
- arrow-based sibling browsing should not overwrite typed input until the user accepts it
- preview and acceptance should stay consistent with the existing ghost-hint mental model
- `Tab` should remain the explicit commit action for the current previewed sibling
- `Right Arrow` should continue to accept the currently shown ghost preview
- `Left Arrow`, typing, backspace, and clear actions should reset sibling preview state cleanly

## In Scope

### Prompt state model

- introduce explicit sibling-preview state separate from the committed input string
- track the current sibling candidate set, active preview index, and preview replacement
- ensure preview state invalidates whenever the editable segment changes

### Sibling candidate resolution

- resolve siblings from the current editable segment scope only
- support empty fragment navigation for paths such as `./`, `../`, and `<dir>/`
- reuse the existing path suggestion engine in `src/cli/prompts/path-suggestions.ts` where practical
- keep directory-first ordering for sibling navigation

### Keyboard behavior

- map `Up Arrow` to previous sibling preview
- map `Down Arrow` to next sibling preview
- make navigation wrap instead of stopping at the list ends
- make `Tab` accept the active preview when present, otherwise preserve existing completion behavior
- keep `Right Arrow` aligned with ghost acceptance

### Rendering

- render the sibling preview as ghost text derived from the active preview replacement
- preserve the existing typed value until the user accepts the preview
- ensure empty-prefix root-level preview still renders clearly

### Documentation and tests

- update the interactive path prompt guide to describe the new arrow-key behavior
- add unit coverage for sibling candidate ordering and hidden-entry handling
- add manual QA notes for wrap-around behavior, root-level navigation, and preview acceptance

## Out of Scope

- full cursor movement within the input line
- fuzzy sibling matching beyond current prefix behavior
- history navigation in path prompts
- a dedicated in-prompt toggle key for hidden entries
- multi-column or list-first path browsing UI

## Phases

## Phase 1: Define sibling-preview state and acceptance rules

### Task Items

- [x] add internal prompt state for sibling candidate list, active preview index, and preview replacement
- [x] define how sibling-preview mode abandons any active legacy `Tab` cycle state
- [x] define helper functions for deriving a ghost suffix from the active preview
- [x] reset preview state on typing, backspace, clear, and parent-segment navigation
- [x] clear the sibling candidate cache as part of full-input reset actions such as `Ctrl+U`
- [x] document the precedence between active preview acceptance and legacy `Tab` cycling

### Phase Deliverable

- [x] prompt internals can represent typed input and sibling preview separately

## Phase 2: Implement sibling candidate resolution and wrap navigation

### Task Items

- [x] add a sibling-resolution helper for the current segment scope
- [x] support empty-fragment browsing inside a resolved parent directory
- [x] cache the resolved sibling set per segment scope and invalidate it only when that scope changes
- [x] implement previous/next navigation with wrap-around semantics
- [x] treat a one-candidate sibling set as wrap-to-self and beep only when there are zero candidates
- [x] apply directory-first sorting and max-suggestion limits consistently
- [x] implement the hidden-entry policy for both empty-fragment browsing and explicit dot-prefix access

### Phase Deliverable

- [x] prompt can browse a stable sibling set for the current segment without mutating committed input

## Phase 3: Wire keys and preserve existing completion semantics

### Task Items

- [x] replace the current `Up` / `Down` no-op behavior with sibling preview navigation
- [x] make `Tab` accept the active sibling preview before falling back to existing completion/cycle logic
- [x] make `Up` / `Down` abandon any active legacy `Tab` cycle and enter sibling-preview mode
- [x] keep `Right Arrow` accepting the visible ghost preview
- [x] refresh ghost/completion state immediately after accepting a sibling preview so the next `Tab` operates on the new value
- [x] beep only when there are no siblings to browse or no preview to accept

### Phase Deliverable

- [x] working keyboard flow for preview-first sibling navigation with predictable acceptance rules

## Phase 4: Docs, tests, and manual QA

### Task Items

- [x] add or update tests around sibling ordering, empty-prefix browsing, hidden entries, and wrap behavior
- [x] update `docs/guides/interactive-path-prompt-ux.md`
- [x] run focused manual checks in supported terminals for `./`, nested directories, and mixed file/directory sibling sets
- [x] document any remaining terminal escape-sequence caveats

### Phase Deliverable

- [x] documented and verified sibling-navigation UX integrated into the interactive path prompt

## Technical Design Notes

- Prefer extending the existing suggestion engine instead of duplicating filesystem traversal logic.
- Treat sibling navigation as a segment-local concern: resolve `parent path + current fragment`, never rewrite earlier segments during preview.
- Resolve and cache the sibling candidate list once per segment-scope change; `Up` / `Down` should move within that cached set instead of triggering a fresh filesystem read on every keypress.
- Keep the committed `value` string authoritative for validation and submission until the user explicitly accepts a preview.
- Entering sibling-preview mode should abandon any active legacy `cycleState`, and accepting a sibling preview should also clear legacy cycle state before refreshing completions for the new committed value.
- Derive rendered ghost text from either:
  - the active sibling preview when one exists
  - the current best completion candidate otherwise
- Preserve Node.js runtime compatibility and current prompt fallback behavior.

## Verification Plan

### Manual UX checks

- [x] `./` + `Down` previews visible siblings from the current working directory
- [x] `./docs/` + `Up` / `Down` browses siblings under `./docs/` with wrap-around
- [x] `./do` + `Down` previews only matching siblings for that fragment
- [x] `Tab` commits the active preview without submitting
- [x] `Right Arrow` commits the active preview without submitting
- [x] typing after preview resets the sibling-preview state and recalculates ghost text
- [x] hidden entries remain absent from empty-prefix browsing when hidden suggestions are off
- [x] explicit dot-prefix typing such as `./.g` can still reveal hidden matches under the proposed policy

### Failure-mode checks

- [x] nonexistent parent directory during navigation does not crash
- [x] no sibling matches causes a beep and leaves typed input unchanged
- [x] large directories remain bounded by the configured suggestion limit
- [x] fallback simple mode still bypasses advanced sibling-navigation behavior

## Risks and Mitigations

- Risk: mixing sibling preview and legacy completion cycling creates ambiguous `Tab` behavior.
  - Mitigation: define strict priority order where active sibling preview acceptance wins first, and only then fall back to legacy completion cycling.
- Risk: empty-prefix browsing feels noisy in large directories.
  - Mitigation: keep current suggestion caps and directory-first ordering; hidden entries stay excluded by default.
- Risk: hidden-entry exceptions become hard to reason about.
  - Mitigation: limit the exception to explicit dot-prefix typing and document it clearly.
- Risk: ghost rendering becomes misleading if preview text diverges from the typed prefix contract.
  - Mitigation: keep sibling candidate scope prefix-matched and reset preview whenever the fragment changes.

## Deliverables

- sibling-preview state in the inline path prompt
- `Up` / `Down` wrap-around sibling navigation
- preview-first acceptance flow for `Tab` and `Right Arrow`
- documented hidden-entry behavior for sibling navigation
- tests and guide updates covering the refined prompt UX

## Related Research

- `docs/researches/research-2026-02-28-interactive-path-ghost-hint-and-sibling-navigation-ux.md`
- `docs/researches/research-2026-02-25-interactive-path-hints-and-autocomplete-ux.md`

## Related Plans

- `docs/plans/plan-2026-02-25-interactive-path-hints-and-autocomplete-ux.md`
