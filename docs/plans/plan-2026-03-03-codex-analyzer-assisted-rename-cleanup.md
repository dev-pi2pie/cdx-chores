---
title: "Codex analyzer-assisted rename cleanup"
created-date: 2026-03-03
modified-date: 2026-03-03
status: draft
agent: codex
---

## Goal

Define the first implementation-ready plan for analyzer-assisted `rename cleanup` without blurring deterministic cleanup and Codex suggestion behavior.

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

## Phase Checklist

### Phase 1: Freeze analyzer contract

- [ ] confirm the interactive entry shape:
  - [ ] separate cleanup branch
  - [ ] or optional `Suggest cleanup hints with Codex?` step
- [ ] confirm filename-only input for the first pass
- [ ] confirm bounded sampling and local grouping rules before sending analyzer input
- [ ] confirm the structured analyzer response shape
- [ ] confirm low-confidence and unavailable-Codex fallback behavior

### Phase 2: Local sampling and request shaping

- [ ] implement bounded filename sampling for file and directory cleanup scopes
- [ ] add local grouping/deduping so repeated filename shapes do not bloat analyzer input
- [ ] define the request payload mapped from grouped filename evidence
- [ ] keep the first pass free of file-content reads

### Phase 3: Analyzer integration

- [ ] add the analyzer-assisted interactive step without changing the default deterministic path
- [ ] call Codex only when the user explicitly opts in
- [ ] parse and validate structured analyzer suggestions
- [ ] map accepted suggestions back onto existing deterministic cleanup controls

### Phase 4: Review, fallback, and verification

- [ ] show analyzer suggestions as editable recommendations rather than auto-applied settings
- [ ] ensure analyzer errors or unsupported environments fall back cleanly to manual cleanup setup
- [ ] add focused tests for sampling, response parsing, and interactive branching
- [ ] run manual smoke checks for analyzer-assisted cleanup suggestion flows

## Success Criteria

- analyzer-assisted cleanup remains opt-in and visibly separate from the default deterministic path
- first-pass analyzer input uses filename lists only
- suggestions map cleanly onto existing cleanup controls
- failures or low-confidence suggestions fall back to manual deterministic cleanup without blocking the user

## Related Research

- `docs/researches/research-2026-03-03-codex-analyzer-assisted-rename-cleanup.md`
- `docs/researches/research-2026-03-02-rename-cleanup-subcommand-and-pattern-hints.md`
