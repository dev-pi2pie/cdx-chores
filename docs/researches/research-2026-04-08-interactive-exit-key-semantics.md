---
title: "Interactive exit key semantics"
created-date: 2026-04-08
modified-date: 2026-04-08
status: completed
agent: codex
---

## Goal

Clarify how interactive mode should treat `Esc` and optional `q` quit behavior across menu screens and inline prompts, with a specific focus on avoiding ambiguous "go back" versus "exit" semantics.

This research is now complete for the current planning scope.

Version-scoping note:

- this recommendation is scoped to the small pre-release follow-up currently being discussed around `v0.1.1-canary.1`
- it is not intended to imply a separate tracked milestone beyond that narrow release slice

Accepted direction for the current pre-release slice:

- ship menu-level `Esc` as "exit interactive mode"
- ship menu-level `q` with the same exit behavior
- keep free-text and path-entry prompts unchanged so literal `q` input still works
- defer help and tip wording updates to a later follow-up unless implementation work proves they are immediately necessary

Implementation evidence is now recorded in the related plan and job docs for this slice.

## Key Findings

### 1. `Esc` already has real behavior in the inline prompt layer

The current raw-mode inline prompts already treat a standalone `Esc` as prompt abort after a short delay that protects arrow-key escape sequences.

That behavior exists in the shared key parser and both custom inline prompt implementations:

- `src/cli/tui/keys.ts`
- `src/cli/prompts/path-inline.ts`
- `src/cli/prompts/text-inline.ts`

Implication:

- `Esc` is not a new concept in interactive mode
- any menu-level `Esc` support should align with the existing inline-prompt meaning rather than introducing a conflicting mental model

### 2. The current interactive stack does not model `Esc` as "go back one layer"

The interactive menus use `@inquirer/prompts` `select` flows, while many path and text steps use custom inline prompts.

Those inline prompts currently reject with `ExitPromptError`, and uncaught prompt-abort errors can bubble out of the interactive run.

That means the current product shape is closer to this:

- menu `Cancel`: explicit exit choice
- `Ctrl+C`: hard abort
- inline prompt `Esc`: prompt abort that effectively behaves like session exit unless a caller catches and reinterprets it

Implication:

- the product does not yet have a shared navigation-stack contract
- treating `Esc` as "Back" would require a wider flow-control refactor rather than a small keybinding addition

### 3. Adding top-menu `Esc` is technically safe, but only if the product meaning is simple

The repository can safely add `Esc` support to menu screens.

The real risk is not key parsing. The real risk is semantic mismatch.

Two product models are possible:

- exit model:
  - `Esc` exits interactive mode
- stack-navigation model:
  - `Esc` goes back one layer

The stack-navigation model is more ambitious because it needs prompt callers to return navigation intent instead of throwing an abort-like error.

Recommendation:

- do not introduce top-menu `Esc` as "Back" in isolation
- if a small near-term improvement is desired, define `Esc` as "exit interactive mode"

### 4. The "exit interactive mode" route is the smallest coherent contract

The current inline prompt behavior already leans toward exit/cancel rather than layered backtracking.

That makes one narrow menu-level rule the least surprising near-term direction:

- menu-level `Esc` should mean "exit interactive mode"

Why this is the safer first contract:

- it aligns better with current inline prompt behavior
- it avoids inventing a pseudo-wizard navigation model that the flows do not currently implement
- it can be explained briefly in tips or help text
- it avoids partial "Back" behavior that works in some places but not others

### 5. `q` can ship in the same slice, but only with menu-only scope

`q` behaves differently from `Esc`.

On a menu screen, `q` can reasonably mean "quit".

Inside a text or path prompt, `q` is valid literal input and should not be intercepted as a global quit shortcut.

Implication:

- `q` cannot be a universal interactive exit key without breaking text entry
- if adopted, it should be limited to menu screens only
- it should share the same menu-level exit meaning as `Esc` rather than introducing a second quit model

Recommendation:

- keep `Esc` as the primary soft-exit concept
- ship menu-level `q` in the same slice as menu-level `Esc`
- keep `q` unavailable inside free-text and path-entry prompts
- do not describe `q` as a global shortcut unless the product truly supports it everywhere

### 6. Help and tip wording updates are not part of the current slice

The current user-facing hint surfaces still mostly describe `Ctrl+C` as the exit path.

Examples:

- `src/cli/interactive/notice.ts` currently resolves width-aware `Ctrl+C` abort copy only
- `src/cli/interactive/contextual-tip.ts` builds randomized tips from that abort copy
- `README.md` currently does not document interactive keyboard shortcuts

Implication:

- the runtime hints and docs may temporarily lag the new menu behavior if the implementation lands first

Recommendation:

- do not expand the current scope just to update help and tip wording
- record this as a deferred documentation follow-up for a later pass
- keep the current research recommendation focused on key semantics and menu/input boundaries

## Implications or Recommendations

### Recommended near-term contract

1. Keep `Ctrl+C` as the hard abort path.
2. Add `Esc` to menu screens only if the new menu-level behavior is explicitly "exit interactive mode" rather than a partial "Back" model.
3. Preserve the current inline-prompt `Esc` abort behavior for now, while documenting that the full interactive stack still has split implementations.
4. Ship menu-level `q` in the same slice with the same exit behavior as menu-level `Esc`.
5. Keep `q` as literal input inside free-text and path prompts.
6. Scope this recommendation to the current small pre-release slice currently being discussed around `v0.1.1-canary.1`.
7. Do not attempt help/tip copy updates in the same slice.
8. Do not attempt layered `Esc` back-navigation in the same slice.

### What should wait for a larger follow-up

These behaviors should be treated as a separate navigation-system project rather than bundled into a small exit-key polish pass:

- submenu `Esc` => root menu
- inline prompt `Esc` => submenu
- restoration of prior answers after going back
- one shared "back/cancel/abort" contract across all interactive flows

Current direction:

- do not pursue submenu-level `Esc` as "Back" in the current phase
- lock the near-term meaning of `Esc` to interactive-mode exit rather than layered navigation
- keep help and tip wording review out of the current small pre-release slice around `v0.1.1-canary.1`

## Resolved Follow-Up Questions

- Should menu-level `q` ship in the same slice as menu-level `Esc`?
  - yes
  - both should ship together for menu screens in the current planning scope
- Should free-text prompts support `q` as a quit shortcut?
  - no
  - `q` remains literal text input outside menu screens
- Should the current phase include help, tip, and README wording updates?
  - no
  - defer those documentation and hint-surface updates to a later follow-up unless implementation work exposes an immediate mismatch that must be corrected
- Should submenu-level `Esc` reserve room for a future "Back" contract?
  - not in the current phase
  - the accepted near-term direction is exit semantics, not layered back-navigation

## Related Historical Docs

- `docs/plans/archive/plan-2026-02-25-interactive-path-hints-and-autocomplete-ux.md`
  - historical context for the earlier inline-prompt keyboard contract, including the explicit decision to preserve `Esc` and `Ctrl+C` cancellation behavior during the path-prompt rollout

## Related Plans

- `docs/plans/plan-2026-04-08-interactive-menu-exit-keys.md`

## Related Jobs

- `docs/plans/jobs/2026-04-08-interactive-menu-exit-keys.md`

## References

- `src/cli/tui/keys.ts`
- `src/cli/prompts/path-inline.ts`
- `src/cli/prompts/text-inline.ts`
- `src/cli/interactive/menu.ts`
- `src/command.ts`
- `src/cli/interactive/notice.ts`
- `docs/researches/research-2026-03-30-interactive-data-query-followup-ux.md`
- `docs/researches/research-2026-03-30-interactive-contextual-tip-usage.md`
