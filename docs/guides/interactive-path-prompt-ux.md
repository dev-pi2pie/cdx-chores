---
title: "Interactive Path Prompt UX Guide"
created-date: 2026-02-25
modified-date: 2026-03-29
status: completed
agent: codex
---

## Goal

Document the interactive path-entry UX used by `cdx-chores`, including keyboard shortcuts, ghost-hint behavior, fallback controls, and terminal caveats.

## Scope

This guide covers interactive path prompts used in `cdx-chores` interactive mode (for example `data`, `md`, `rename`, and `video` commands).

## Interaction Model (MVP)

The path prompt is input-first (Fish-style), not list-first.

- You type directly into the path input.
- A dimmed ghost hint may appear as a suffix for the best completion candidate.
- `Enter` submits the current typed value.
- `Tab` accepts/cycles completions without auto-submitting.

## Keyboard Shortcuts

### Core keys

- `Enter`: submit the current typed path
- `Tab`: accept the current ghost hint, or cycle to the next match
- `Right Arrow`: accept the current ghost hint (same intent as `Tab` accept)
- `Backspace`: delete one character
- `Ctrl+U`: clear the current input
- `Esc`: cancel prompt
- `Ctrl+C`: cancel prompt

### Arrow-key behavior (MVP)

- `Left Arrow`: jump back to the previous path segment boundary (parent-segment shortcut)
- `Up Arrow`: preview the previous sibling candidate for the current path segment
- `Down Arrow`: preview the next sibling candidate for the current path segment
- sibling navigation wraps at the ends of the sibling list
- sibling preview does not commit into the input until you accept it with `Tab` or `Right Arrow`

## Ghost-Hint Semantics

- The ghost hint is a suggested completion suffix for the current input.
- When sibling navigation is active, the ghost hint shows the active sibling preview instead of the default best completion.
- Accepting a ghost hint updates the input value; it does not submit the prompt.
- Directory suggestions render with a trailing `/`.
- Hidden files are not shown by default during generic browsing.
- Explicit dot-prefix input (for example `./.g`) can still reveal hidden matches even when hidden suggestions are globally disabled.
- Validation still happens at prompt/action level; autocomplete is a UX aid, not a source of truth.

## Optional Output Path UX (Default vs Custom)

For commands with derived output defaults (for example `data -> convert`, `md to-docx`, `video gif`), interactive mode now uses an explicit choice:

- `Use default output`
- `Custom output path`

Choosing custom opens the inline ghost-hint path prompt.

## Terminal Compatibility (Manual QA)

Verified manually:

- macOS Terminal
- iTerm2
- VS Code integrated terminal

## Failure-Mode Behavior

- Nonexistent parent directory while typing: no crash; suggestions return empty
- Large directories: suggestions are capped (default cap is 12)
- Hidden files present: hidden files are excluded from generic browsing by default unless enabled via env, but explicit dot-prefix input can still reveal matching hidden entries
- Simple fallback mode: supported via env (`CDX_CHORES_PATH_PROMPT_MODE=simple`)

## Runtime Controls (Environment Variables)

Path prompt behavior can be tuned with environment variables:

- `CDX_CHORES_PATH_PROMPT_MODE=simple`
  - Force simple prompt mode (no inline ghost-hint prompt)
- `CDX_CHORES_DISABLE_PATH_AUTOCOMPLETE=1`
  - Keep prompt mode auto but disable path autocomplete
- `CDX_CHORES_PATH_AUTOCOMPLETE_MIN_CHARS=<n>`
  - Minimum chars before suggestions (explicit prefixes like `./`, `../`, `/` can still trigger)
- `CDX_CHORES_PATH_AUTOCOMPLETE_MAX_SUGGESTIONS=<n>`
  - Cap number of suggestions returned/rendered
- `CDX_CHORES_PATH_AUTOCOMPLETE_INCLUDE_HIDDEN=1`
  - Include dotfiles/dotdirs in suggestions

## Terminal Caveats

- This is not full shell editing parity yet (no command history, no full cursor editing model).
- Arrow keys are handled explicitly for the MVP behaviors above; unsupported keys may be ignored.
- If a terminal/plugin sends unusual key sequences and behavior feels unstable, use:
  - `CDX_CHORES_PATH_PROMPT_MODE=simple`

## Historical Plans

- `docs/plans/archive/plan-2026-02-25-interactive-path-hints-and-autocomplete-ux.md`

## Historical Research

- `docs/researches/archive/research-2026-02-25-interactive-path-hints-and-autocomplete-ux.md`
