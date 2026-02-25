---
title: "Interactive path hints and autocomplete UX implementation plan"
created-date: 2026-02-25
status: draft
agent: codex
---

## Goal

Implement a better interactive path-entry experience in `cdx-chores` with:

- clearer derived path hints (especially default output paths)
- filesystem-backed path suggestions/autocomplete while typing
- predictable keyboard behavior with safe terminal fallbacks

## Why This Plan

Current interactive mode uses a minimal `promptPath()` wrapper in `src/cli/interactive.ts` that only validates non-empty input. This keeps the flow simple but adds friction for common tasks:

- users must type long paths manually
- output defaults are shown in some prompts but are not consistently reusable
- there is no path discovery/assist behavior during entry

This plan upgrades the UX without changing command action behavior or Node.js runtime compatibility.

## User Experience Targets

- Path prompts remain fast and text-first in a terminal (no heavy TUI dependency)
- Suggestions feel helpful, not noisy
- `Enter` submits the current input (never unexpectedly accepts a suggestion)
- `Tab` accepts or cycles suggestions without submitting
- Directory suggestions are visually distinct (trailing `/`)
- A fallback path prompt remains available when advanced key handling is not supported

## Proposed Decisions (Resolve Current Research Questions)

- Accept suggestion with `Tab` (primary binding)
- Keep `Right Arrow` as optional future enhancement only if terminal handling is reliable
- Show suggestions after 1+ typed character, and also for explicit relative prefixes like `./`, `../`, `/`
- Hide dotfiles/dotdirs by default in the suggestion list (future toggle later)
- Render directories with trailing `/`
- Provide a simple fallback mode (existing input prompt behavior) for unsupported terminals or opt-out

These defaults should be implemented first and revisited after manual testing across common terminals.

## In Scope

### Path prompt abstraction

- Extract path prompting logic from `src/cli/interactive.ts` into reusable helpers (for example, `src/cli/prompts/path.ts`)
- Support prompt variants:
  - required file path
  - required directory path
  - optional output path with derived default hint
  - CSV plan path prompt
- Centralize path prompt validation and display formatting

### Derived path hints (default output suggestions)

- Standardize hint generation currently done ad hoc in `formatDefaultOutputHint(...)`
- Show resolved/display-friendly default output paths consistently for:
  - `data json-to-csv`
  - `data csv-to-json`
  - `md to-docx`
  - `video gif` (optional output)
- Keep behavior compatible with existing action defaults (prompt hint only; action remains source of truth)

### Filesystem-backed autocomplete (MVP)

- Suggest entries from the current working directory or typed parent directory
- Support relative and absolute path input
- Filter suggestions by basename prefix match
- Distinguish directories via `/`
- Sort directories first, then files, alphabetically
- Cap suggestion count (for example, 10-20 items) to avoid noisy rendering
- Preserve typed text if no suggestion is accepted

### Keyboard behavior + fallback

- `Tab`: accept highlighted suggestion or cycle suggestions
- `Enter`: submit current text
- `Esc`/`Ctrl+C`: preserve current prompt cancellation behavior from the prompt library
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

## Implementation Strategy

## Phase 1: Refactor prompt APIs and unify path hints

1. Introduce a reusable path prompt helper module (used by interactive mode only)
2. Define prompt option types (kind, required/optional, default hint builder, validation mode)
3. Replace existing `promptPath()` calls in `src/cli/interactive.ts` with the new helper
4. Keep behavior equivalent first (no autocomplete yet) to reduce regression risk

Deliverable:

- Interactive mode path prompts routed through one abstraction with consistent hint text

## Phase 2: Add autocomplete suggestion engine (logic only)

1. Implement a pure suggestion resolver utility (for example, `src/cli/prompts/path-suggestions.ts`)
2. Parse input into:
   - directory segment to inspect
   - basename fragment to match
3. Read directory entries and normalize suggestions
4. Add filtering/sorting/limit behavior
5. Unit test edge cases (empty input, `./`, `../`, absolute path, nonexistent parent dir, hidden files)

Deliverable:

- Testable path suggestion engine independent of terminal rendering

## Phase 3: Integrate advanced interactive path prompt UI

1. Create an advanced prompt implementation that uses the suggestion engine
2. Wire key handling for `Tab` accept/cycle and `Enter` submit
3. Render suggestions in a compact list or inline hint (depending on prompt library constraints)
4. Fall back to simple prompt if advanced mode errors or is unsupported
5. Swap interactive command flows to use advanced prompt for path fields

Deliverable:

- Working interactive path autocomplete for core path-entry prompts

## Phase 4: Polish, docs, and validation pass

1. Verify prompt behavior across commands (`data`, `md`, `rename`, `video`)
2. Tune suggestion count and matching thresholds
3. Update docs/help text
4. Add manual test notes and terminal compatibility notes

Deliverable:

- Documented, stable MVP path autocomplete UX with fallback

## Technical Design Notes

- Keep filesystem suggestion logic separate from rendering/key handling so it can be unit tested without a TTY.
- Do not change action-layer path resolution semantics (`resolveFromCwd`, action defaults, overwrite checks).
- Prompt helpers should return raw strings (matching current interactive/action interfaces) to minimize churn.
- Treat autocomplete as a UX enhancement only; validation remains explicit and action-level checks remain authoritative.

## Verification Plan

### Manual UX checks

- `cdx-chores` -> choose `data json-to-csv`
  - output hint is shown and readable
  - `Tab` completes input path without submitting
- `rename batch`
  - directory suggestions show trailing `/`
  - `Enter` submits typed directory
- `rename apply`
  - CSV file path suggestion works for relative path
- `video gif`
  - optional output path hint still works when left blank

### Terminal compatibility checks

- macOS Terminal
- iTerm2
- VS Code integrated terminal

### Failure-mode checks

- Nonexistent parent directory during typing (no crash; no suggestions)
- Large directory (suggestions remain capped/responsive)
- Hidden files present (not shown by default)
- Advanced prompt disabled/unavailable -> simple prompt still works

## Risks and Mitigations

- Risk: prompt library limitations make custom key handling fragile
  - Mitigation: keep a simple fallback mode and decouple suggestion engine from UI
- Risk: large directories cause sluggish suggestions
  - Mitigation: cap results, short-circuit matching, and avoid expensive stat calls in MVP
- Risk: users expect shell-like behavior and are surprised by differences
  - Mitigation: document exact key behavior and keep `Enter` submission semantics predictable
- Risk: duplicate hint/default logic diverges from action defaults
  - Mitigation: centralize hint generation and treat hints as display-only while actions remain source of truth

## Deliverables

- Reusable interactive path prompt helper(s)
- Filesystem-backed path suggestion engine with unit tests
- Autocomplete-enabled path prompts in interactive mode (MVP)
- Fallback/simple prompt path mode
- Documentation updates for shortcuts and limitations

## Follow-up Jobs (After Plan Approval)

- Job: extract path prompt abstraction and unify output hints
- Job: implement and test path suggestion engine
- Job: integrate advanced path autocomplete prompt + fallback
- Job: document keyboard shortcuts and terminal caveats

## Related Research

- `docs/researches/research-2026-02-25-interactive-path-hints-and-autocomplete-ux.md`

## Related Plans

- `docs/plans/plan-2026-02-25-initial-launch-lightweight-implementation.md`
