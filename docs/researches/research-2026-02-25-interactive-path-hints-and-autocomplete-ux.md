---
title: "Interactive path hints and path autocomplete UX research"
created-date: 2026-02-25
modified-date: 2026-02-25
status: draft
agent: codex
---

## Goal

Evaluate how far `cdx-chores` interactive mode should go beyond static path prompts, specifically:

- derived path hints (default output suggestions)
- richer path autocomplete behavior (shell-like inline completion)
- hot-key behavior and terminal UX tradeoffs

## Milestone Goal

Define an input-first path prompt UX that feels closer to Fish shell path completion than list-first search pickers, while preserving safe fallback behavior in terminals with limited key-handling support.

## Key Findings

- The expected interaction model is now clarified: input-first path typing with inline "ghost text" hinting (dimmed suffix), and `Tab` to accept completion.
- This target is closer to Fish shell / shell completion behavior than to `fzf` or generic list-search prompts.
- A list-first search prompt (for example, `@inquirer/search`) is a poor default fit because it introduces selection-state complexity and "sub selection" UX that feels wrong for path entry.
- `fzf`-style UX can still be useful as an optional picker mode, but it should not replace the default path input behavior.
- The existing Phase 1 and Phase 2 work remains valid:
  - reusable prompt abstraction
  - path suggestion engine (filesystem filtering/sorting)
- The primary redesign is the prompt UI rendering/input state model (Phase 3 implementation approach), not the underlying suggestion logic.

## Implications or Recommendations

- Revise the implementation plan/Phase 3 approach to target a custom inline path prompt renderer (input-first) instead of a list-selection prompt wrapper.
- Keep `Tab` as the primary accept/cycle completion key and keep `Enter` as submit-typed-input.
- Consider an optional power-user picker mode later (for example, `Ctrl+T`) if `fzf`-style browsing is desired.
- Add explicit evaluation criteria for "shell-like feel" in Manual QA (ghost hint visibility, non-disruptive typing, predictable `Tab` acceptance).

## Notes

This research topic has clarified the target UX model but still needs a focused implementation-approach comparison (custom prompt renderer vs `@inquirer/core` custom prompt vs optional external picker integration).

## Open Questions

- What is the best implementation primitive for the inline ghost-hint UI (`@inquirer/core` custom prompt, raw readline/raw-mode prompt, or another package)?
- How should completion cycling work with repeated `Tab` presses when multiple matches exist?
- Should `Shift+Tab` reverse-cycle suggestions, or should only forward-cycle be supported in the MVP?
- Should suggestions appear only after a minimum character count to reduce noise, while still showing for `./`, `../`, `/`?
- Should hidden files be shown by default?
- Should directory suggestions be visually distinguished only in the accepted text (trailing `/`) or also in ghost hints?
- Do we want a fallback mode when running in terminals that do not support the chosen key-handling behavior cleanly?

## Related Plans

- `docs/plans/plan-2026-02-25-initial-launch-lightweight-implementation.md`
- `docs/plans/plan-2026-02-25-interactive-path-hints-and-autocomplete-ux.md`

## References

- Fish shell completion/UX behavior (conceptual target)
