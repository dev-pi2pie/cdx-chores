---
title: "Inline ghost prompt wrap fix"
created-date: 2026-03-29
modified-date: 2026-03-30
status: active
agent: codex
---

## Goal

Fix the interactive inline ghost prompt redraw bug reported in issue `#31` so long wrapped paths do not leave stale terminal rows behind.

## Why This Plan

Research for the wrapped prompt bug points to a shared repainting limitation rather than a path-suggestion failure.

The current inline prompt implementation clears only one terminal row before rewriting the full prompt line. That is sufficient for short single-line prompts, but it breaks once a long multi-folder path wraps across multiple rows.

This follow-up should treat the problem as shared TUI behavior, not as a prompt-specific patch:

1. introduce a shared wrap-aware renderer
2. move both inline prompt variants onto that renderer
3. add regression coverage for narrow terminals and display-width-sensitive content

## Scope

### Shared renderer

- introduce a shared line-aware renderer under `src/cli/tui/`
- treat the renderer as a terminal interaction primitive shared by multiple prompt types
- track previously occupied visual rows and clear all of them before repainting

### Width handling

- use display width rather than raw string length for cursor-back movement
- use display width for wrap-related row counting
- reuse the existing display-width utilities from `src/cli/text-display-width.ts`

### Prompt integration

- update `src/cli/prompts/path-inline.ts` to use the shared renderer
- update `src/cli/prompts/text-inline.ts` to use the shared renderer
- preserve the current prompt interaction behavior outside repaint correctness

### Tests and verification

- add focused tests for repeated redraws of wrapped prompts
- cover both ASCII and display-width-sensitive content
- treat terminal compatibility as an explicit verification dimension, not only terminal width
- include two manual narrow-terminal smoke checks:
  - one with a long ASCII multi-folder path
  - one with display-width-sensitive content
- include terminal-matrix verification for at least:
  - iTerm2
  - Ghostty

## Non-Goals

- changing path suggestion ordering or matching behavior
- changing text template completion behavior
- redesigning the raw input session model
- broad TUI restyling outside the wrap-related repaint fix

## Implementation Touchpoints

- `src/cli/tui/screen.ts`
- new shared wrap-aware renderer under `src/cli/tui/`
- `src/cli/prompts/path-inline.ts`
- `src/cli/prompts/text-inline.ts`
- `src/cli/text-display-width.ts`
- focused TUI and prompt tests under `test/`

## Phase Checklist

### Phase 1: Renderer contract freeze

- [x] freeze `src/cli/tui/` as the canonical home for the shared renderer
- [x] freeze the renderer contract around:
  - [x] full clearing of previously occupied visual rows before repaint
  - [x] display-width-based cursor-back movement
  - [x] display-width-based wrap counting
- [x] freeze the rule that `path-inline` and `text-inline` both consume the same repaint primitive

### Phase 2: Shared renderer implementation

- [x] implement the shared wrap-aware renderer in `src/cli/tui/`
- [x] track the previous rendered visual row count
- [x] clear all previously occupied visual rows before each repaint
- [x] keep the existing one-line case behavior clean and simple

### Phase 3: Prompt integration

- [x] update `src/cli/prompts/path-inline.ts` to use the shared renderer
- [x] update `src/cli/prompts/text-inline.ts` to use the shared renderer
- [x] preserve existing prompt semantics for:
  - [x] ghost suffix rendering
  - [x] arrow-key acceptance behavior
  - [x] sibling preview behavior
  - [x] template-completion behavior

### Phase 4: Tests

- [x] add focused automated coverage for narrow-terminal wrapped redraw behavior
- [x] add ASCII long-path coverage
- [x] add display-width-sensitive coverage such as CJK or emoji-containing input
- [x] verify repeated redraws do not leave stale rows behind
- [x] verify both prompt variants use the same wrap-aware behavior

### Phase 5: Manual verification and docs alignment

- [ ] run one manual narrow-terminal smoke check with a long ASCII multi-folder path
- [ ] run one manual narrow-terminal smoke check with display-width-sensitive content
- [ ] run terminal-matrix verification in iTerm2 and record the result
- [ ] run terminal-matrix verification in Ghostty and record the result
- [ ] capture environment notes alongside manual verification:
  - [ ] terminal app
  - [ ] `TERM`
  - [ ] approximate terminal width
  - [ ] whether the issue reproduces on `Backspace`, `Right Arrow`, or both
- [ ] update issue `#31` and related docs if the remaining gap is confirmed to be terminal-specific rather than generic
- [ ] update related docs if implementation details change from the current research and issue framing

## Success Criteria

- repeated redraws of a wrapped inline prompt do not leave stale rows behind
- both `path-inline` and `text-inline` use the same wrap-aware repaint path
- cursor-back movement and wrap calculations behave correctly for both ASCII and display-width-sensitive prompt content
- focused automated coverage exists for narrow-terminal redraw behavior
- manual narrow-terminal smoke checks pass for:
  - a long ASCII multi-folder path
  - a display-width-sensitive example such as CJK or emoji-containing input
- manual verification clearly records terminal-specific outcomes, including the current iTerm2 pass and Ghostty reproduction signal, until both terminals pass or the issue is re-scoped as terminal-specific

## Verification

- targeted prompt and TUI tests under `test/`
- manual interactive smoke checks in a narrow terminal
- manual terminal-matrix verification across iTerm2 and Ghostty with environment notes

## Related Research

- `docs/researches/research-2026-03-29-inline-ghost-prompt-wrap-bug.md`
