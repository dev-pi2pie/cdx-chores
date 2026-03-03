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
- analyzer-assisted cleanup now has an initial interactive implementation:
  - bounded filename sampling and local grouping
  - structured Codex suggestion parsing
  - opt-in interactive suggestion flow with manual fallback
- remaining work is now about fixture coverage, user feedback during analyzer runs, and deciding whether grouped analyzer output should produce a report artifact
- the main implementation record is now consolidated in `docs/plans/jobs/2026-03-03-analyzer-assisted-rename-cleanup-implementation.md`
- the contract-level research is already captured in `docs/researches/research-2026-03-03-codex-analyzer-assisted-rename-cleanup.md`
- grouped report artifact decisions are now captured in `docs/researches/research-2026-03-03-rename-cleanup-analyzer-report-artifact.md`

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

## Follow-up Questions

- should analyzer-assisted cleanup have a dedicated mixed-pattern fixture generator for manual smoke checks?
- should analyzer-assisted cleanup optionally emit a grouped analysis report, likely CSV, instead of only showing a short summary in interactive mode?
- what level of status/progress messaging should be shown while sampling filenames and waiting for Codex suggestions?

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
  Current note:
  A live interactive smoke run against `examples/playground/cleanup-analyzer/mixed-family` verified the status-text and fallback path, but the Codex request aborted in the current environment before a real suggestion/report step completed.

### Phase 5: Fixture and smoke-test support

- [x] add a mixed-pattern cleanup fixture generator under `scripts/` similar in spirit to `scripts/generate-huge-logs.mjs`
- [x] seed small grouped filename families rather than one huge single-pattern set:
  - [x] timestamp-heavy names
  - [x] date-only names
  - [x] serial-only names
  - [x] existing `uid-<token>` names
  - [x] intentionally mixed or ambiguous folders
- [x] keep fixture counts compact for analyzer-assisted smoke tests, roughly 5-15 files per family
- [x] document the intended playground directory and usage for analyzer-assisted manual checks

### Phase 6: Analyzer UX feedback

- [x] add visible status text before and during analyzer-assisted cleanup work
- [x] distinguish local evidence collection from remote Codex suggestion work, for example:
  - [x] sampling filenames
  - [x] grouping filename patterns
  - [x] waiting for Codex suggestions
- [x] keep the status messaging short and compatible with plain terminal output
- [x] verify analyzer fallback paths still read clearly when suggestion generation fails

### Phase 6.1: Analyzer UX polish follow-up

- [x] print grouped analysis report paths using display/relative formatting instead of raw absolute paths
- [x] replace the current static multi-line analyzer progress output with one mutable progress surface:
  - [x] show sampling
  - [x] show grouping
  - [x] show waiting-for-Codex
- [x] add optional TTY-aware animated status treatment for analyzer progress:
  - [x] dim/standard emphasis changes instead of fixed static text
  - [x] use terminal-safe redraw/cleanup behavior
  - [x] keep non-TTY and test environments on a simple fallback path
- [x] consider `picocolors` for the analyzer progress emphasis layer while keeping plain-text fallback readable

### Phase 7: Grouped analysis report exploration

- [x] decide whether analyzer-assisted cleanup should optionally emit a grouped analysis report artifact
- [x] keep this separate from the normal rename plan CSV contract
- [x] evaluate a CSV schema that represents grouped filename evidence and suggestions, such as:
  - [x] grouped pattern
  - [x] count
  - [x] representative examples
  - [x] recommended hints
  - [x] recommended style
  - [x] recommended timestamp action
  - [x] confidence
- [x] confirm whether the report is interactive-only, optional, and advisory rather than executable
- [x] defer true per-group analyzer recommendations until the Codex response contract is expanded

### Phase 8: Grouped analysis report implementation

- [x] add a dedicated analysis artifact writer separate from the rename plan CSV writer
- [x] use a distinct filename pattern such as `rename-cleanup-analysis-<utc-timestamp>Z-<uid>.csv`
- [x] write one row per grouped local filename pattern
- [x] include overall analyzer suggestion fields on each row in the first pass
- [x] make report generation optional within the interactive analyzer-assisted flow
- [x] add focused tests for report naming and CSV content
- [ ] run a manual smoke check using `examples/playground/cleanup-analyzer/`

## Success Criteria

- analyzer-assisted cleanup remains opt-in and visibly separate from the default deterministic path
- first-pass analyzer input uses filename lists only
- suggestions map cleanly onto existing cleanup controls
- failures or low-confidence suggestions fall back to manual deterministic cleanup without blocking the user
- the implementation does not reopen cleanup hint semantics, style semantics, or conflict-strategy behavior

## Related Research

- `docs/researches/research-2026-03-03-codex-analyzer-assisted-rename-cleanup.md`
- `docs/researches/research-2026-03-02-rename-cleanup-subcommand-and-pattern-hints.md`
- `docs/researches/research-2026-03-03-rename-cleanup-analyzer-report-artifact.md`

## Related Plans

- `docs/plans/plan-2026-03-03-interactive-rename-template-and-cleanup-flow-enhancements.md`

## Related Job Record

- `docs/plans/jobs/2026-03-03-analyzer-assisted-rename-cleanup-implementation.md`
