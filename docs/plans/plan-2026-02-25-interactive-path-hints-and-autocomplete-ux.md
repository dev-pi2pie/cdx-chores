---
title: "Interactive path hints and autocomplete UX implementation plan"
created-date: 2026-02-25
modified-date: 2026-02-25
status: completed
agent: codex
---

## Goal

Implement a better interactive path-entry experience in `cdx-chores` with:

- clearer derived path hints (especially default output paths)
- filesystem-backed path suggestions/autocomplete while typing
- shell-like inline ghost-hint completion (Fish-style input-first interaction)
- predictable keyboard behavior with safe terminal fallbacks

## Why This Plan

Current interactive mode uses a minimal `promptPath()` wrapper in `src/cli/interactive.ts` that only validates non-empty input. This keeps the flow simple but adds friction for common tasks:

- users must type long paths manually
- output defaults are shown in some prompts but are not consistently reusable
- there is no path discovery/assist behavior during entry

This plan upgrades the UX without changing command action behavior or Node.js runtime compatibility.

## Plan Reset Note (2026-02-25)

- The target UX was clarified after an initial Phase 3 prototype: the expected behavior is Fish-style inline completion (input-first with dimmed ghost hint), not a list-first search prompt.
- The list-first `@inquirer/search` integration is now considered a **prototype / misaligned approach** for the default path prompt UX.
- Phase 1 and Phase 2 remain valid and are retained.
- This plan resets the remaining implementation path to replace the current Phase 3 UI approach with an inline ghost-hint prompt design.

## User Experience Targets

- Path prompts remain fast and text-first in a terminal (no heavy TUI dependency)
- Typed input remains the primary interaction (no forced list-selection mental model)
- Inline dimmed "ghost text" hint shows the best completion suffix when available
- Suggestions feel helpful, not noisy
- `Enter` submits the current input (never unexpectedly accepts a suggestion)
- `Tab` accepts the current completion and can cycle candidates without submitting
- Candidate list (if shown) remains secondary to the input line
- Directory suggestions are visually distinct (trailing `/`)
- A fallback path prompt remains available when advanced key handling is not supported

## Proposed Decisions (Resolve Current Research Questions)

- Default interaction model: shell-like inline completion (Fish-style), not list-first search selection
- Accept suggestion with `Tab` (primary binding)
- Keep `Right Arrow` as optional future enhancement only if terminal handling is reliable
- Show suggestions after 1+ typed character, and also for explicit relative prefixes like `./`, `../`, `/`
- Hide dotfiles/dotdirs by default in the suggestion list (future toggle later)
- Render directories with trailing `/`
- Provide a simple fallback mode (existing input prompt behavior) for unsupported terminals or opt-out
- `fzf`-style browsing is a possible future optional mode, not the default path prompt UX

These defaults should be implemented first and revisited after manual testing across common terminals.

## In Scope

### Path prompt abstraction

- Extract path prompting logic from `src/cli/interactive.ts` into reusable helpers (for example, `src/cli/prompts/path.ts`)
- Support required file path prompt variant
- Support required directory path prompt variant
- Support optional output path prompt variant with derived default hint
- Support CSV plan path prompt variant
- Centralize path prompt validation and display formatting

### Derived path hints (default output suggestions)

- Standardize hint generation currently done ad hoc in `formatDefaultOutputHint(...)`
- Show resolved/display-friendly default output paths for `data json-to-csv`
- Show resolved/display-friendly default output paths for `data csv-to-json`
- Show resolved/display-friendly default output paths for `md to-docx`
- Show resolved/display-friendly default output paths for `video gif` (optional output)
- Keep behavior compatible with existing action defaults (prompt hint only; action remains source of truth)

### Filesystem-backed autocomplete (MVP)

- Suggest entries from the current working directory or typed parent directory
- Support relative and absolute path input
- Filter suggestions by basename prefix match
- Distinguish directories via `/`
- Sort directories first, then files, alphabetically
- Cap suggestion count (for example, 10-20 items) to avoid noisy rendering
- Preserve typed text if no suggestion is accepted

### Inline ghost-hint prompt UX (replacement Phase 3/4 target)

- Input-first prompt rendering (text entry remains primary)
- Dimmed inline suffix hint for the best completion candidate
- Completion candidate cycling model for repeated `Tab`
- Optional secondary suggestion list/panel (only if it improves clarity and does not dominate the UX)
- Fallback to simple prompt when terminal capabilities or key handling are unreliable

### Keyboard behavior + fallback

- `Tab`: accept ghost completion or cycle suggestions
- `Enter`: submit current text
- `Esc`/`Ctrl+C`: preserve current prompt cancellation behavior
- Fallback to simple input prompt when advanced autocomplete mode is unavailable or disabled
- Add a small internal switch/env flag for troubleshooting (for example, disable advanced path prompt)

### Documentation and discoverability

- Add interactive shortcut notes (`Tab` behavior, fallback behavior) to `README.md` or CLI help text
- Document any limitations (hidden files, terminal compatibility, large directories)

## Out of Scope (Initial Implementation)

- Full shell-grade completion behavior (zsh/bash parity)
- Fuzzy matching/ranking beyond prefix match
- Gitignore-aware filtering
- Hidden file toggle UI
- File previews / metadata columns (size/date)
- Multi-select path picking
- Mouse interaction
- `fzf` as the default path prompt UX
- Hard dependency on external fuzzy finder binaries for the default prompt flow

## Phases

## Phase 1: Refactor Prompt APIs and Unify Path Hints

### Task Items

- [x] Introduce a reusable path prompt helper module (interactive mode only)
- [x] Define prompt option types (kind, required/optional, default hint builder, validation mode)
- [x] Replace existing `promptPath()` calls in `src/cli/interactive.ts` with the new helper
- [x] Keep behavior equivalent first (no autocomplete yet) to reduce regression risk

### Phase Deliverable

- [x] Interactive mode path prompts are routed through one abstraction with consistent hint text

## Phase 2: Add Autocomplete Suggestion Engine (Logic Only)

### Task Items

- [x] Implement a pure suggestion resolver utility (for example, `src/cli/prompts/path-suggestions.ts`)
- [x] Parse input into a directory segment to inspect and a basename fragment to match
- [x] Read directory entries and normalize suggestions
- [x] Add filtering, sorting, and result-limit behavior
- [x] Unit test edge cases (`""`, `./`, `../`, absolute paths, nonexistent parent dir, hidden files)

### Phase Deliverable

- [x] Testable path suggestion engine independent of terminal rendering

## Phase 3: Reset UI Approach and Choose Inline Prompt Primitive

### Task Items

- [x] Record the reset decision in plan/docs and treat the list-first `@inquirer/search` path prompt as a superseded prototype
- [x] Run a focused implementation-primitive spike for inline ghost-hint path prompts (for example, `@inquirer/core` custom prompt vs raw-mode/readline prompt)
- [x] Choose the implementation primitive and document tradeoffs/constraints
- [x] Define exact interaction semantics for MVP (ghost hint, `Tab` accept/cycle, `Enter` submit, optional list visibility)

### Phase Deliverable

- [x] Approved replacement Phase 3 design for Fish-style inline path completion (ready to implement)

## Phase 4: Implement Fish-Style Inline Ghost-Hint Path Prompt

### Task Items

- [x] Implement an input-first inline path prompt renderer using the chosen primitive
- [x] Render dimmed inline ghost-hint suffix for the best completion candidate
- [x] Wire `Tab` accept/cycle and `Enter` submit semantics without list-first selection behavior
- [x] Integrate the existing suggestion engine and runtime fallback/simple mode controls
- [x] Replace or gate the current list-first prototype path prompt implementation
- [x] Swap interactive command flows to use the replacement inline prompt for path fields

### Phase Deliverable

- [x] Working Fish-style inline ghost-hint path autocomplete for core path-entry prompts

## Phase 5: Polish, Docs, and Validation Pass

### Task Items

- [x] Verify prompt behavior across commands (`data`, `md`, `rename`, `video`)
- [x] Tune suggestion count and matching thresholds
- [x] Update docs/help text (including ghost-hint semantics and fallback env flags)
- [x] Add manual test notes and terminal compatibility notes

### Phase Deliverable

- [x] Documented, stable MVP path autocomplete UX with fallback and manual QA notes

## Technical Design Notes

- Keep filesystem suggestion logic separate from rendering/key handling so it can be unit tested without a TTY.
- Do not change action-layer path resolution semantics (`resolveFromCwd`, action defaults, overwrite checks).
- Prompt helpers should return raw strings (matching current interactive/action interfaces) to minimize churn.
- Treat autocomplete as a UX enhancement only; validation remains explicit and action-level checks remain authoritative.
- The default path prompt interaction model should be input-first; list-first prompt wrappers are not the target UX for this feature.

## Verification Plan

### Manual UX checks

- [x] `cdx-chores` -> choose `data json-to-csv` (output hint is shown and readable)
- [x] `cdx-chores` -> choose `data json-to-csv` (dimmed ghost hint appears as path suffix while typing)
- [x] `cdx-chores` -> choose `data json-to-csv` (`Tab` accepts/cycles completion without submitting)
- [x] `rename batch` target directory shows shell-like inline completion behavior (not list-first sub-selection)
- [x] `rename batch` `Enter` submits typed directory without forcing suggestion acceptance
- [x] `rename apply` CSV file path suggestion works for relative path
- [x] `video gif` optional output default/custom selection works (default path used when choosing default)

### Terminal Compatibility Checks (Manual QA)

- [x] macOS Terminal
- [x] iTerm2
- [x] VS Code integrated terminal

### Failure-mode checks

- [x] Nonexistent parent directory during typing (no crash; no suggestions)
- [x] Large directory (suggestions remain capped/responsive)
- [x] Hidden files present (not shown by default)
- [x] Advanced prompt disabled/unavailable -> simple prompt still works
- [x] Repeated `Tab` cycling with multiple matches remains predictable and non-destructive

## Risks and Mitigations

- Risk: prompt library limitations make custom key handling fragile.
  - Mitigation: keep a simple fallback mode and decouple suggestion engine from UI; choose the implementation primitive via a focused spike before reimplementation.
- Risk: large directories cause sluggish suggestions.
  - Mitigation: cap results, short-circuit matching, and avoid expensive stat calls in MVP.
- Risk: a list-first prompt implementation feels wrong even if technically functional.
  - Mitigation: target an input-first ghost-hint prompt model and treat list-first implementations as optional prototypes/pickers only.
- Risk: users expect shell-like behavior and are surprised by differences.
  - Mitigation: document exact key behavior and keep `Enter` submission semantics predictable.
- Risk: duplicate hint/default logic diverges from action defaults.
  - Mitigation: centralize hint generation and treat hints as display-only while actions remain source of truth.

## Deliverables

- Reusable interactive path prompt helper(s)
- Filesystem-backed path suggestion engine with unit tests
- Fish-style inline ghost-hint path prompts in interactive mode (MVP)
- Fallback/simple prompt path mode
- Documentation updates for shortcuts and limitations

## Follow-up Jobs (After Plan Approval)

- [x] Job: extract path prompt abstraction and unify output hints
- [x] Job: implement and test path suggestion engine
- [x] Job: prototype list-first search-based path autocomplete + fallback (superseded)
- [x] Job: research/choose implementation primitive for inline ghost-hint path prompt
- [x] Job: implement inline ghost-hint path prompt + fallback
- [x] Job: document keyboard shortcuts, ghost-hint semantics, and terminal caveats

## Related Research

- `docs/researches/research-2026-02-25-interactive-path-hints-and-autocomplete-ux.md`

## Related Plans

- `docs/plans/plan-2026-02-25-initial-launch-lightweight-implementation.md`

## Status Notes

- Phase 1 and Phase 2 are complete and remain valid foundations for the replacement implementation path.
- A list-first `@inquirer/search`-based Phase 3 prototype was implemented and documented, but it is considered a misaligned approach for the default path prompt UX and has been replaced by an input-first inline ghost-hint prompt implementation.
- Manual QA completed for core UX flows, terminal compatibility, and failure-mode checks; remaining improvements are optional polish beyond MVP.
