---
title: "Interactive data query follow-up implementation"
created-date: 2026-03-30
modified-date: 2026-03-30
status: completed
agent: codex
---

## Goal

Implement the next interactive `data query` UX follow-up slice from the settled research direction without turning `formal-guide` into a general-purpose query builder.

## Why This Plan

The initial interactive `data query` flow already ships the three authoring modes and shared execution/output routing.

The next useful slice is narrower and more UX-focused:

- add one optional SQL-level `limit` to `formal-guide`
- improve guided filter behavior in `formal-guide`
- add a short width-aware abort notice
- introduce checkpoint-based backtracking at major review stages
- align the usage guide wording with the shipped behavior once implementation lands

This work is best handled as a follow-up plan instead of being folded back into the earlier interactive-query implementation plan because the main flow already exists and this slice is about refinement rather than initial feature bring-up.

## Current State

- interactive `data query` already supports:
  - `manual`
  - `formal-guide`
  - `Codex Assistant`
- `formal-guide` currently gathers:
  - selected columns
  - simple filters
  - optional aggregate summary intent
  - optional ordering
- table output already uses the bounded preview-style execution path
- JSON stdout and file output remain full-result unless the SQL itself narrows the result
- interactive query currently has linear prompt chains after menu entry, with revise or regenerate loops only at a few later stages
- the follow-up research now settles:
  - one optional SQL-level `limit` is acceptable in `formal-guide`
  - slice, offset, page, and row-range controls should stay out
  - filter improvements should ship as one coherent guided-filter slice
  - width-aware abort notices should start in `data query` and later become a reusable pattern
  - checkpoint backtracking should start at major stages and use one consistent layout across all three modes

## Scope

### `formal-guide` SQL limit

- add one optional prompt after ordering:
  - `Maximum result rows (optional)`
- compile that answer into SQL as `limit n`
- keep the prompt optional so the current no-limit behavior remains the default
- keep SQL review explicit when a SQL limit is present
- keep table preview bounds separate from SQL-level limits

### Guided filter improvements

- extend `formal-guide` filters with one coherent first-pass set:
  - text matching:
    - `contains`
    - `starts with`
    - `ends with`
  - null checks:
    - `is null`
    - `is not null`
  - boolean-specialized choices:
    - `is true`
    - `is false`
  - emptiness checks where meaningful:
    - `is empty`
    - `is not empty`
- keep filter guidance type-aware when column types are available
- keep filter wording usable for non-SQL-first users

### Width-aware abort notice

- render a short informational abort notice near the start of interactive `data query`
- use width-tier wording based on TTY width:
  - `< 24`: `Ctrl+C to abort.`
  - `24-39`: `Press Ctrl+C to abort.`
  - `>= 40`: `Press Ctrl+C to abort this session.`
- keep the first implementation local to interactive `data query`
- structure the code so the wording or width-tier logic can later be reused by other interactive flows

### Checkpoint backtracking

- add checkpoint-level backtracking at:
  - mode selection
  - SQL review / execution confirmation
  - output selection
- apply the checkpoint model across:
  - `manual`
  - `formal-guide`
  - `Codex Assistant`
- keep one consistent action ordering across modes:
  - primary revise action
  - secondary mode-specific recovery action when applicable
  - `Change mode`
  - `Cancel`
- keep mode-specific labels where they best match the workflow

### Output and review wording

- keep `Rows to show (optional)` as the table-preview control
- do not silently inject SQL limits to match table preview bounds
- at SQL review:
  - show `SQL limit: <n>` when a SQL limit exists
- at output review or confirmation:
  - for table output with no SQL limit: `Table preview rows: default bounded`
  - for table output with explicit preview rows: `Table preview rows: <n>`
  - when both table preview bounds and SQL limit exist, surface both concepts distinctly
- keep JSON stdout separate from file output and never prompt JSON stdout for a destination path

### Documentation

- update `docs/guides/data-query-interactive-usage.md` after implementation lands
- describe only shipped behavior
- avoid vague wording such as `stable version` when the guide really means current shipped behavior
- keep public doc examples behavior-oriented rather than tied to private local cases

## Non-Goals

- pagination
- slice, offset, page, or row-range controls in `formal-guide`
- grouped boolean logic such as `or`
- nested conditions
- freeform expression building in `formal-guide`
- editor-backed SQL entry for `manual`
- redesigning the direct CLI `data query` contract
- changing the current bounded table execution behavior outside the interactive follow-up surface

## Risks and Mitigations

- Risk: `formal-guide` drifts into a partial query builder that promises more than it can safely express.
  Mitigation: keep the follow-up bounded to one optional SQL `limit` and one coherent guided-filter slice; continue routing advanced logic to `manual`.

- Risk: SQL-level `limit` and table-preview bounds become conflated in prompts or summaries.
  Mitigation: keep separate wording for SQL review and output review, and never silently inject a SQL limit for preview purposes.

- Risk: checkpoint backtracking becomes inconsistent across modes.
  Mitigation: freeze one shared checkpoint structure and action ordering, while allowing only the action labels to vary by mode.

- Risk: width-aware notices feel overfit to one command and become hard to generalize later.
  Mitigation: start in `data query`, but keep the logic small and isolated so it can be extracted after real-use validation.

- Risk: usage docs accidentally describe planned behavior as shipped behavior.
  Mitigation: update the guide only after implementation lands and keep wording tied to actual released behavior.

## Implementation Touchpoints

- `src/cli/interactive/data-query/index.ts`
- `src/cli/interactive/data-query/sql/formal-guide.ts`
- `src/cli/interactive/data-query/sql/manual.ts`
- `src/cli/interactive/data-query/sql/codex.ts`
- `src/cli/interactive/data-query/execution.ts`
- `src/cli/interactive/data-query/types.ts`
- interactive tests under `test/`
- `docs/guides/data-query-interactive-usage.md`

## Phase Checklist

### Phase 1: Freeze follow-up UX contract

- [x] freeze the optional SQL-level `limit` prompt and wording
- [x] freeze the first-pass guided-filter operator set
- [x] freeze SQL-review versus output-review wording for SQL limit and table preview bounds
- [x] freeze width-tier abort notice wording and cutoffs
- [x] freeze the checkpoint locations and shared action ordering across modes

### Phase 2: Implement `formal-guide` limit and guided filters

- [x] add `Maximum result rows (optional)` to `formal-guide`
- [x] compile the accepted value into SQL as `limit n`
- [x] keep current behavior unchanged when the prompt is left blank
- [x] add the guided-filter operator set:
  - [x] `contains`
  - [x] `starts with`
  - [x] `ends with`
  - [x] `is null`
  - [x] `is not null`
  - [x] `is true`
  - [x] `is false`
  - [x] `is empty`
  - [x] `is not empty`
- [x] keep operator availability aligned with usable column-type information where possible
- [x] preserve deterministic SQL generation for the resulting structured answers

### Phase 3: Implement review wording and checkpoint backtracking

- [x] add SQL-review display for `SQL limit: <n>` when present
- [x] add output-review wording for `Table preview rows: default bounded`
- [x] add output-review wording for explicit preview-row overrides
- [x] implement checkpoint backtracking for `manual`
- [x] implement checkpoint backtracking for `formal-guide`
- [x] implement checkpoint backtracking for `Codex Assistant`
- [x] keep one consistent action ordering across all three modes

### Phase 4: Implement width-aware abort notice

- [x] add the early interactive abort notice to `data query`
- [x] wire the notice to TTY-width detection
- [x] keep non-TTY behavior quiet or deterministic as appropriate
- [x] isolate the helper enough for later reuse by other interactive flows

### Phase 5: Verification and docs

- [x] add focused tests for:
  - [x] optional SQL `limit` generation in `formal-guide`
  - [x] new filter operator SQL generation
  - [x] SQL-review and output-review wording
  - [x] checkpoint backtracking across all three modes
  - [x] width-aware abort notice variants
- [x] update `docs/guides/data-query-interactive-usage.md`
- [x] verify the guide describes only shipped behavior

## Related Research

- `docs/researches/research-2026-03-30-interactive-data-query-followup-ux.md`
- `docs/researches/research-2026-03-09-data-query-scope-and-contract.md`
- `docs/researches/research-2026-03-16-data-preview-query-edge-cases.md`

## Related Plans

- `docs/plans/plan-2026-03-10-data-query-interactive-flow-implementation.md`
- `docs/plans/plan-2026-03-30-shared-interactive-ux-consistency-followup.md`
