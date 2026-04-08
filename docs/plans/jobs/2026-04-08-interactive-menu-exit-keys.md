---
title: "Implement interactive menu exit keys"
created-date: 2026-04-08
modified-date: 2026-04-08
status: completed
agent: codex
---

## Goal

Implement the first scoped rollout for interactive command-menu exit keys so the root and submenu command menus support `Esc` and `q` as session-exit shortcuts, while free-entry prompts keep their current behavior.

## Follow-Up Note

The initial rollout shipped menu-level `Esc` and `q`, but a same-day review follow-up reverted printable `q`.

Why:

- `@inquirer/select` already uses typed characters for prefix search
- intercepting `q` as quit blocked normal menu navigation to entries such as `query`

Current shipped behavior after the follow-up:

- `Esc` exits the root and submenu command menus
- printable `q` is no longer intercepted as a menu-exit key
- free-entry prompts still keep literal `q` behavior

## What Changed

- added a shared command-menu exit helper in `src/cli/interactive/menu-prompt.ts`
  - uses `AbortSignal` with `@inquirer/prompts`
  - maps standalone `Esc` to interactive-session exit for the command menus
  - originally also mapped typed `q`, but that interception was removed in the related follow-up to preserve `@inquirer/select` prefix search
  - guards keypress-event setup so repeated menu visits do not accumulate hidden emitter state
- updated `src/cli/interactive/menu.ts` so both the root menu and submenu use the shared helper
- updated `src/cli/interactive/index.ts` so the command-menu path uses the runtime `stdin` and `stdout`
- preserved free-entry prompt behavior in:
  - `src/cli/prompts/path-inline.ts`
  - `src/cli/prompts/text-inline.ts`
- added focused command-menu helper tests in `test/cli-interactive-menu-prompt.test.ts`
  - root menu exits on `Esc`
  - root menu exits on `q`
  - submenu exits on `Esc`
  - submenu exits on `q`
- added command-menu wiring tests in `test/cli-interactive-menu.test.ts`
  - `selectInteractiveAction(...)` passes the expected streams into the command-menu helper
  - `runInteractiveMode(...)` prints the spaced cancellation output after command-menu exit
- added regressions that `q` stays literal after existing input in:
  - `test/cli-path-inline.test.ts`
  - `test/cli-text-inline.test.ts`
- updated the rollout plan so the completed implementation and verification items are checked

## Verification

- `bun test test/cli-interactive-menu-prompt.test.ts test/cli-interactive-menu.test.ts test/cli-text-inline.test.ts test/cli-path-inline.test.ts test/cli-interactive-routing.test.ts`
- `bunx tsc --noEmit`

## Related Plans

- `docs/plans/plan-2026-04-08-interactive-menu-exit-keys.md`

## Related Research

- `docs/researches/research-2026-04-08-interactive-exit-key-semantics.md`

## Related Jobs

- `docs/plans/jobs/2026-04-08-interactive-menu-review-followup.md`
