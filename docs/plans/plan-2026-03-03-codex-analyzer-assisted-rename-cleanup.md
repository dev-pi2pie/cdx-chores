---
title: "Codex analyzer-assisted rename cleanup"
created-date: 2026-03-03
modified-date: 2026-03-03
status: active
agent: codex
---

## Goal

Define the first implementation-ready plan for analyzer-assisted `rename cleanup` without blurring deterministic cleanup and Codex suggestion behavior.

## Current State

- deterministic `rename cleanup` is already implemented in both CLI and interactive mode
- cleanup currently remains explicit and deterministic by default
- analyzer-assisted cleanup is still unimplemented
- the contract-level research is already captured in `docs/researches/research-2026-03-03-codex-analyzer-assisted-rename-cleanup.md`

This plan now starts from that settled research baseline rather than reopening the core product direction.

## Scope

- add an explicit analyzer-assisted cleanup entry or step in interactive mode
- collect bounded filename-list samples from the chosen cleanup scope
- send structured analyzer requests to Codex using filename evidence only in the first pass
- receive structured cleanup suggestions:
  - recommended hints
  - recommended style
  - recommended timestamp action when applicable
  - confidence
  - reasoning summary
- let the user accept or edit the proposed cleanup settings before deterministic cleanup runs
- define fallback behavior when Codex is unavailable, errors, or returns low-confidence suggestions

## Non-Goals

- reading file contents in the first pass
- silently invoking Codex during normal deterministic cleanup
- automatically executing cleanup from analyzer output without review
- generating arbitrary regex cleanup rules in the first implementation
- turning analyzer output into a full cleanup command draft in the first pass

## Proposed First Pass

1. User enters interactive cleanup flow.
2. User chooses whether to ask Codex for cleanup suggestions.
3. The app gathers a bounded filename sample from the current scope.
4. Codex returns structured suggestions only.
5. The user accepts or edits those settings.
6. Normal deterministic cleanup planning and preview continue.

## First Implementation Slice

Start with the narrowest useful path:

- interactive mode only
- explicit opt-in step: `Suggest cleanup hints with Codex?`
- filename-list evidence only
- bounded local sampling/grouping before any analyzer request
- structured suggestion response mapped onto existing cleanup controls
- clean fallback to manual deterministic cleanup when analyzer support is unavailable or low-confidence

## Likely Touchpoints

- `src/cli/interactive/rename.ts`
- `src/cli/actions/rename/cleanup.ts`
- `src/cli/actions/rename/codex.ts`
- `test/cli-interactive-rename.test.ts`
- new focused analyzer-assisted cleanup tests under `test/`

## Phase Checklist

### Phase 1: Freeze analyzer contract

- [x] confirm the interactive entry shape:
  - [x] optional `Suggest cleanup hints with Codex?` step
  - [x] separate cleanup branch
- [x] confirm filename-only input for the first pass
- [x] confirm bounded sampling and local grouping rules before sending analyzer input
- [x] confirm the structured analyzer response shape
- [x] confirm low-confidence and unavailable-Codex fallback behavior

### Phase 2: Local sampling and request shaping

- [x] implement bounded filename sampling for file and directory cleanup scopes
- [x] add local grouping/deduping so repeated filename shapes do not bloat analyzer input
- [x] define the request payload mapped from grouped filename evidence
- [x] keep the first pass free of file-content reads

### Phase 3: Analyzer integration

- [x] add the analyzer-assisted interactive step without changing the default deterministic path
- [x] call Codex only when the user explicitly opts in
- [x] parse and validate structured analyzer suggestions
- [x] map accepted suggestions back onto existing deterministic cleanup controls

### Phase 4: Review, fallback, and verification

- [x] show analyzer suggestions as editable recommendations rather than auto-applied settings
- [x] ensure analyzer errors or unsupported environments fall back cleanly to manual cleanup setup
- [x] add focused tests for sampling, response parsing, and interactive branching
- [ ] run manual smoke checks for analyzer-assisted cleanup suggestion flows

## Success Criteria

- analyzer-assisted cleanup remains opt-in and visibly separate from the default deterministic path
- first-pass analyzer input uses filename lists only
- suggestions map cleanly onto existing cleanup controls
- failures or low-confidence suggestions fall back to manual deterministic cleanup without blocking the user
- the implementation does not reopen cleanup hint semantics, style semantics, or conflict-strategy behavior

## Related Research

- `docs/researches/research-2026-03-03-codex-analyzer-assisted-rename-cleanup.md`
- `docs/researches/research-2026-03-02-rename-cleanup-subcommand-and-pattern-hints.md`

## Related Plans

- `docs/plans/plan-2026-03-03-interactive-rename-template-and-cleanup-flow-enhancements.md`
