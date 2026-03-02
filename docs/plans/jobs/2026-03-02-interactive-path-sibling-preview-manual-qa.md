---
title: "Interactive path sibling preview manual QA"
created-date: 2026-03-02
modified-date: 2026-03-02
status: completed
agent: codex
---

## Goal

Run focused manual QA for the sibling-preview path prompt behavior after Phases 2 and 3, and record which checks were completed in the current terminal environment.

## What Was Verified

- In a PTY session via `bun src/bin.ts interactive`, `Up` / `Down` previewed same-segment siblings without mutating the committed input first.
- Wrap-around behavior worked:
  - `examples/playground/re` cycled through `rename-route-a-smoke/`, `review-tmp-mixed/`, and `review-tmp-spaced/`, then wrapped.
  - `examples/playground/docs/` wrapped from `jj.json` to `xxx.pdf` and back.
- `Tab` accepted the active sibling preview and immediately refreshed ghost completion for the new committed value.
- `Right Arrow` accepted the active previewed hidden-file match.
- Typing after a preview reset the preview state and recalculated ghost text for the typed value.
- Empty-prefix browsing excluded hidden entries by default.
- Explicit dot-prefix input (`examples/playground/.`) revealed hidden matches such as `.tmp-tests/`, `.DS_Store`, and `.gitignore`.
- Zero-match sibling browsing emitted a terminal bell and left the typed input unchanged.
- Nonexistent parent-directory browsing (`examples/playground/missing/fi`) emitted a bell and left the prompt stable without crashing.
- Large-directory browsing under `examples/playground/huge-logs/` remained responsive while previewing capped sibling candidates.
- Simple fallback mode still routed to the plain prompt with `CDX_CHORES_PATH_PROMPT_MODE=simple`.
- A full interactive `data -> json-to-csv` run succeeded with:
  - input `examples/playground/docs/jj.json`
  - default output path
  - overwrite `No`

## Remaining QA

- User confirmed the same path-prompt scenarios worked as expected in macOS Terminal.
- User confirmed the same path-prompt scenarios worked as expected in iTerm2.
- User confirmed the same path-prompt scenarios worked as expected in VS Code integrated terminal.

## Notes

- The successful `json-to-csv` QA run generated `examples/playground/docs/jj.csv` temporarily; that artifact was removed after validation.
- The user reported the GUI-terminal checks as working as expected and noted there was no dedicated debug/log mode producing explicit `pass` / `fail` output, so the confirmation is recorded as manual operator validation.

## Verification

- PTY-driven manual session: `bun src/bin.ts interactive`
- PTY-driven simple-mode session: `CDX_CHORES_PATH_PROMPT_MODE=simple bun src/bin.ts interactive`
