---
title: "Fix interactive menu review follow-up findings"
created-date: 2026-04-08
modified-date: 2026-04-08
status: completed
agent: codex
---

## Goal

Address the post-implementation review findings in the interactive menu follow-up by restoring select-menu search behavior for printable `q` and keeping the `doctor` confirmation on the injected interactive runtime streams.

## What Changed

- removed the command-menu `q` abort interception from `src/cli/interactive/menu-prompt.ts`
  - keeps `Esc` as the soft-exit key for the command menus
  - restores `@inquirer/select` prefix-search behavior so typed `q` can still focus menu entries such as `query`
- recorded the same-day shortcut decision in the related plan and research docs
  - printable `q` remains unsupported as a menu-exit key because it conflicts with select-menu prefix search
  - `Ctrl+Q` remains unsupported because some terminals may intercept it for flow control or local keybindings before the CLI receives it
- updated `src/cli/interactive/index.ts` so the `doctor` `confirm(...)` prompt receives `runtime.stdin` and `runtime.stdout`
- added narrow test seams in `runInteractiveMode(...)` for `confirm` and `actionDoctor` so the stream wiring can be asserted without invoking the full doctor action
- replaced the prior `q`-exit helper regression with a regression that drives the real `@inquirer/select` prompt and verifies typed `q` still selects a `q`-prefixed menu entry
- added a focused wiring test that `runInteractiveMode(...)` passes the runtime streams into the `doctor` confirmation prompt
- updated the original same-day plan, research, and implementation job docs with a short follow-up note so the current documented contract matches the shipped `Esc`-only menu-exit behavior

## Files

- `src/cli/interactive/index.ts`
- `src/cli/interactive/menu-prompt.ts`
- `docs/plans/plan-2026-04-08-interactive-menu-exit-keys.md`
- `docs/researches/research-2026-04-08-interactive-exit-key-semantics.md`
- `docs/plans/jobs/2026-04-08-interactive-menu-exit-keys.md`
- `test/cli-interactive-menu.test.ts`
- `test/cli-interactive-menu-prompt.test.ts`

## Verification

- `bun test test/cli-interactive-menu-prompt.test.ts test/cli-interactive-menu.test.ts test/cli-text-inline.test.ts test/cli-path-inline.test.ts test/cli-interactive-routing.test.ts`
- `bunx tsc --noEmit`

## Related Plans

- `docs/plans/plan-2026-04-08-interactive-menu-exit-keys.md`

## Related Research

- `docs/researches/research-2026-04-08-interactive-exit-key-semantics.md`

## Related Jobs

- `docs/plans/jobs/2026-04-08-interactive-menu-exit-keys.md`
