---
title: "Data query interactive flow implementation"
created-date: 2026-03-10
status: draft
agent: codex
---

## Goal

Implement the interactive `data query` workflow on top of the frozen introspection-first contract, reusing the direct CLI/backend query foundations rather than inventing a separate execution surface.

## Why This Plan

Interactive query is a separate implementation track from direct CLI query.

It depends on the same underlying query contract, but it introduces additional UX systems:

- read-only introspection before SQL authoring
- source selection for multi-object formats
- `choose mode` routing
- structured `formal-guide` prompts
- Codex-assisted SQL drafting and review
- explicit execution confirmation and recovery loops

That makes it a better follow-up plan than an appendix inside the CLI implementation plan.

## Current State

- the interactive query design contract is frozen in research
- the direct CLI query implementation is planned separately
- interactive mode already supports staged prompt flows for preview and conversion commands
- there is no interactive `data query` route yet
- there is no introspection-first schema/sample flow yet
- there is no `formal-guide` query builder yet
- there is no `Codex Assistant` query-drafting integration for `data query`

## Dependency Note

- this plan should follow the direct CLI query implementation plan
- this plan should follow the CLI `data query codex` drafting plan
- interactive query should reuse the CLI/backend query contract rather than define a second execution contract
- interactive `Codex Assistant` should align with the CLI `data query codex` drafting contract rather than invent a conflicting Codex contract

## Design Contract

### Entry flow

- interactive `data query` starts with input selection
- format detection runs before mode selection
- lightweight read-only introspection runs before SQL authoring
- source selection happens before SQL authoring for multi-object formats

### Mode selector

- `manual`
- `formal-guide`
- `Codex Assistant`

### Shared execution guardrail

- every mode produces candidate SQL
- final SQL is always shown back to the user
- execution always requires explicit confirmation
- SQL errors should return the user to revise or regenerate rather than silently retrying

### Introspection contract

- detected format
- selected source object
- column names
- inferred column types
- small bounded sample window

### Output-mode prompts

- table mode: ask `Rows to show (optional)` and reuse `--rows`
- JSON stdout mode: ask whether to pretty-print
- file-output mode: ask for output path and overwrite confirmation when needed

## Scope

### Interactive routing

- add `data:query` to the interactive menu
- route `data:query` through the interactive dispatcher
- add a dedicated interactive handler branch for query flow

### Introspection-first UX

- prompt for input path
- detect input format with optional override when needed
- load extension capability for introspection when needed
- gather bounded introspection metadata
- prompt for source selection when the format exposes multiple objects
- render schema/sample context clearly before mode selection

### `manual` mode

- gather SQL directly from the user
- keep the first implementation bounded to practical prompt-based SQL entry
- show final SQL and require confirmation before execution

### `formal-guide` mode

- prompt for selected source object when relevant
- prompt for selected columns or `all columns`
- prompt for simple filters
- prompt for optional grouping/aggregate summary intent
- prompt for optional ordering
- build candidate SQL from those answers
- show final SQL and require confirmation before execution

### `Codex Assistant` mode

- gather the user’s intent in natural language
- provide Codex with the bounded introspection payload plus the user’s intent
- receive candidate SQL
- show final SQL and require confirmation before execution
- support revise/regenerate loops after errors or user rejection

Alignment note:

- this mode defines the advisory guardrails that any later `data query codex` CLI drafting lane should reuse
- interactive `Codex Assistant` and future CLI `data query codex` should not diverge on introspection prerequisites or SQL review requirements

### Output prompts and execution

- choose output mode after candidate SQL is accepted
- reuse the direct CLI/backend query contract for actual execution
- keep status/log output distinct from result payloads

## Non-Goals

- redefining the direct CLI query contract
- non-SQL direct CLI flags such as `--select` or `--limit`
- editor-backed SQL entry in the first pass
- pagination
- keyboard-driven table navigation
- multi-file queries
- remote data sources
- freeform autonomous Codex execution without explicit user confirmation
- defining a separate CLI `data query codex` implementation in this plan

## Risks and Mitigations

- Risk: interactive mode may duplicate backend behavior instead of reusing the direct CLI query contract.
  Mitigation: keep interactive execution as a thin orchestration layer over shared query helpers.

- Risk: `formal-guide` may become an underpowered pseudo-SQL builder that misleads users about supported query complexity.
  Mitigation: freeze the minimum prompt set and route advanced cases to `manual` or `Codex Assistant`.

- Risk: `Codex Assistant` may create hidden intent drift or unexpected SQL.
  Mitigation: always show generated SQL, require confirmation, and keep Codex advisory only.

- Risk: introspection may become expensive on large SQLite or Excel sources.
  Mitigation: keep introspection bounded, read-only, and sample-sized rather than count- or scan-heavy.

## Implementation Touchpoints

- `src/cli/interactive/menu.ts`
- `src/cli/interactive/index.ts`
- `src/cli/interactive/data.ts`
- new interactive query/introspection helpers under `src/cli/interactive/` or `src/cli/duckdb/`
- shared query action helpers from the direct CLI plan
- interactive harness/tests under `test/`
- future usage guide docs under `docs/guides/`

## Phase Checklist

### Phase 1: Interactive route and prompt contract

- [ ] add `data:query` to the interactive action key set
- [ ] add the submenu entry under `data`
- [ ] freeze prompt sequencing for:
  - [ ] input path
  - [ ] optional input-format override
  - [ ] introspection summary
  - [ ] source selection
  - [ ] `choose mode`
  - [ ] output mode
  - [ ] execution confirmation

### Phase 2: Introspection-first foundation

- [ ] implement bounded read-only introspection for each supported format
- [ ] implement source-object discovery for SQLite
- [ ] implement source-object discovery for Excel
- [ ] present schema/sample context consistently across modes
- [ ] keep introspection failures distinct from execution failures

### Phase 3: `manual` mode

- [ ] implement manual SQL prompt flow
- [ ] define blank-input and retry behavior
- [ ] show final SQL for explicit confirmation
- [ ] route execution through shared query helpers

### Phase 4: `formal-guide` mode

- [ ] implement prompts for selected columns or `all columns`
- [ ] implement prompts for simple filters
- [ ] implement prompts for optional grouping and aggregate summary intent
- [ ] implement prompts for optional ordering
- [ ] build SQL deterministically from structured answers
- [ ] show final SQL for explicit confirmation

### Phase 5: `Codex Assistant` mode

- [ ] define the exact prompt/context bundle passed to Codex
- [ ] implement candidate SQL generation from natural-language intent
- [ ] show generated SQL for explicit confirmation
- [ ] define revise/regenerate flow after rejection or SQL error
- [ ] keep Codex advisory-only with no implicit execution

### Phase 6: Output-mode prompts and execution wiring

- [ ] add table output prompt flow with optional `rows`
- [ ] add JSON stdout prompt flow with optional pretty-print
- [ ] add file-output prompt flow with path and overwrite handling
- [ ] reuse shared execution/output helpers from the direct CLI query plan

### Phase 7: Tests

- [ ] add interactive routing coverage for `data:query`
- [ ] add prompt-flow coverage for introspection-first sequencing
- [ ] add coverage for source selection in SQLite and Excel flows
- [ ] add coverage for `manual` mode confirmation behavior
- [ ] add coverage for `formal-guide` SQL generation
- [ ] add coverage for `Codex Assistant` review/confirmation guardrails
- [ ] add coverage for output-mode prompts and execution routing
- [ ] add coverage for error recovery and cancel paths

### Phase 8: Docs and verification

- [ ] add a dedicated interactive `data query` usage guide
- [ ] document `manual`, `formal-guide`, and `Codex Assistant`
- [ ] document introspection-first behavior and source selection
- [ ] document SQL review/confirmation rules
- [ ] run manual interactive smoke checks across supported formats

## Success Criteria

- users can reach `data query` from interactive mode through a staged, introspection-first flow
- `manual`, `formal-guide`, and `Codex Assistant` each produce reviewable SQL rather than bypassing SQL visibility
- multi-object formats behave predictably through guided source selection
- interactive query reuses the direct CLI/backend contract instead of diverging from it
- tests cover routing, prompts, source selection, mode behavior, and confirmation guardrails

## Verification

- `bunx tsc --noEmit`
- focused `bun test` interactive/query suites
- manual interactive smoke checks across representative formats

## Related Research

- `docs/researches/research-2026-03-09-data-query-scope-and-contract.md`

## Related Plans

- `docs/plans/plan-2026-03-10-data-query-cli-implementation.md`
- `docs/plans/plan-2026-03-10-data-query-codex-cli-drafting.md`
- `docs/plans/plan-2026-03-09-duckdb-parquet-preview-integration.md`
