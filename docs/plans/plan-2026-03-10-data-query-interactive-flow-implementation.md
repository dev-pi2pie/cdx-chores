---
title: "Data query interactive flow implementation"
created-date: 2026-03-10
modified-date: 2026-03-11
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
- interactive `Codex Assistant` should reuse the shared drafting guardrails and prompt/context contract defined in the CLI `data query codex` plan rather than invent a conflicting Codex contract

## Design Contract

### Entry flow

- interactive `data query` starts with input selection
- format detection runs before mode selection
- lightweight read-only introspection runs before SQL authoring
- source selection happens before SQL authoring for multi-object formats
- once a source object is selected, it is bound to the logical SQL table name `file` before mode selection

### Mode selector

- `manual`
- `formal-guide`
- `Codex Assistant`

### Shared execution guardrail

- every mode produces candidate SQL
- final SQL is always shown back to the user
- execution always requires explicit confirmation
- SQL errors should return the user to a mode-appropriate revise or regenerate step rather than silently retrying

### Source-binding contract

- the interactive flow always exposes the selected input through the logical SQL table name `file`
- for SQLite and Excel, the chosen source object is metadata used to bind `file`, not a second SQL table name users must target directly
- `manual`, `formal-guide`, and `Codex Assistant` should all author SQL against `file` so interactive semantics match direct CLI query semantics

### Introspection contract

- detected format
- selected source object
- column names
- inferred column types
- small bounded sample window

### Output-mode prompts

- table mode: ask `Rows to show (optional)` and reuse `--rows`
- JSON stdout mode: ask whether to pretty-print
- file-output mode: ask for output path, ask whether to pretty-print when the output path is `.json`, and ask for overwrite confirmation when needed
- interactive output selection must map to exactly one direct-query output contract: table, `--json`, or `--output <path>`
- interactive output selection must not allow mixed result-delivery choices that the direct CLI query contract rejects
- when file output is chosen, the interactive layer should preserve the direct CLI stdout or stderr split by keeping payloads in the file and status lines outside stdout

### Intent prompt boundary

- the first-pass `Codex Assistant` intent prompt should support multiline entry
- `Shift+Enter` should insert a newline when the terminal exposes it distinctly
- because `Shift+Enter` is not portable across all terminal environments, multiline intent entry must also expose guaranteed fallback submit keys
- the first-pass guaranteed fallback submit key should be `Ctrl+D`
- plain `Enter` should insert a newline in the multiline intent prompt rather than submit immediately
- `Ctrl+C` and `Escape` retain their existing cancel or abort roles
- multiline intent entry should be implemented through a dedicated prompt primitive rather than by stretching the existing single-line text prompt
- when the runtime falls back to the existing simple or non-raw prompt path, `Codex Assistant` intent capture should downgrade to a single-line prompt with an explicit warning before drafting continues
- multiline interactive intent should be normalized into the same shared prompt or context text shape used by the CLI `data query codex` lane before Codex drafting is invoked

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
- keep the first implementation bounded to a single-line SQL prompt
- keep editor-backed or multiline SQL entry out of the first pass
- show final SQL and require confirmation before execution
- after SQL errors, return to manual SQL revision without rerunning introspection

### `formal-guide` mode

- prompt for selected columns or `all columns`
- prompt for simple filters
- prompt for optional grouping/aggregate summary intent
- prompt for optional ordering
- build candidate SQL from those answers
- show final SQL and require confirmation before execution
- after SQL errors, return to revise the structured answers or rebuild SQL from them

### `Codex Assistant` mode

- gather the user’s intent in natural language
- gather that intent through a multiline prompt surface
- provide Codex with the bounded introspection payload plus the user’s intent
- receive candidate SQL
- show final SQL and require confirmation before execution
- support revise/regenerate loops after errors or user rejection

Alignment note:

- this mode should reuse the advisory guardrails already defined for the CLI `data query codex` lane
- interactive `Codex Assistant` and CLI `data query codex` should not diverge on introspection prerequisites, prompt/context shape, or SQL review requirements

### Output prompts and execution

- choose output mode after candidate SQL is accepted
- reuse the direct CLI/backend query contract for actual execution
- map interactive output choices to exactly one of table, `--json`, or `--output <path>`
- reject output-choice combinations that would conflict with the direct CLI query contract
- keep status/log output distinct from result payloads

## Non-Goals

- redefining the direct CLI query contract
- non-SQL direct CLI flags such as `--select` or `--limit`
- editor-backed SQL entry in the first pass
- editor-backed intent entry in the first pass
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

- Risk: `Shift+Enter` may not be distinguishable from plain `Enter` in some terminal environments.
  Mitigation: treat `Shift+Enter` as a best-effort newline key and define `Ctrl+D` as the guaranteed submit fallback for the multiline prompt.

- Risk: multiline intent entry may be forced into the current single-line prompt primitive and create brittle rendering behavior.
  Mitigation: add a dedicated multiline text prompt module with explicit multi-row rendering, cursor movement, newline insertion, and submit-key handling.

- Risk: multiline intent capture may not be available in simple or non-raw environments even though the rest of interactive mode still works.
  Mitigation: downgrade `Codex Assistant` intent capture to a single-line prompt with an explicit warning rather than failing the whole interactive path.

- Risk: interactive multiline intent may diverge from the shared CLI `data query codex` drafting contract.
  Mitigation: normalize multiline intent into the same shared prompt or context text shape before passing it into the reused Codex drafting bundle.

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
  - [ ] freeze the logical `file` table-binding rule after source selection
  - [ ] freeze first-pass `Codex Assistant` intent entry as multiline with `Shift+Enter` newline support plus `Ctrl+D` submit fallback
  - [ ] freeze simple or non-raw fallback behavior as single-line intent entry with a visible warning
  - [ ] freeze output-mode mapping so interactive choices stay one-to-one with table, `--json`, or `--output <path>`

### Phase 2: Introspection-first foundation

- [ ] implement bounded read-only introspection for each supported format
- [ ] implement source-object discovery for SQLite
- [ ] implement source-object discovery for Excel
- [ ] bind the selected source object to the logical SQL table `file` before any mode-specific prompts
- [ ] present schema/sample context consistently across modes
- [ ] keep introspection failures distinct from execution failures

### Phase 3: `manual` mode

- [ ] implement manual SQL prompt flow
- [ ] define blank-input and retry behavior
- [ ] show final SQL for explicit confirmation
- [ ] define SQL-error recovery that returns to manual SQL revision without rerunning introspection
- [ ] route execution through shared query helpers

### Phase 4: `formal-guide` mode

- [ ] implement prompts for selected columns or `all columns`
- [ ] implement prompts for simple filters
- [ ] implement prompts for optional grouping and aggregate summary intent
- [ ] implement prompts for optional ordering
- [ ] build SQL deterministically from structured answers
- [ ] show final SQL for explicit confirmation
- [ ] define SQL-error recovery that returns to structured-answer revision without rerunning introspection

### Phase 5: `Codex Assistant` mode

- [ ] reuse the shared prompt/context bundle defined in the CLI `data query codex` plan
- [ ] add a dedicated multiline text prompt primitive for natural-language intent capture
- [ ] implement multiline natural-language intent capture for the first pass
- [ ] support newline insertion through `Shift+Enter` when the terminal exposes it distinctly
- [ ] support guaranteed multiline submit fallback through `Ctrl+D`
- [ ] downgrade to a single-line intent prompt with warning when the multiline raw prompt cannot run
- [ ] normalize interactive intent into the shared CLI `data query codex` prompt/context text shape before drafting
- [ ] implement candidate SQL generation from natural-language intent
- [ ] show generated SQL for explicit confirmation
- [ ] define revise/regenerate flow after rejection or SQL error
- [ ] keep Codex advisory-only with no implicit execution

### Phase 6: Output-mode prompts and execution wiring

- [ ] add table output prompt flow with optional `rows`
- [ ] add JSON stdout prompt flow with optional pretty-print
- [ ] add file-output prompt flow with path, optional JSON pretty-printing, and overwrite handling
- [ ] keep JSON stdout and file output mutually exclusive in the interactive flow
- [ ] keep file-output payload delivery off stdout so direct CLI stdout or stderr expectations remain intact
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
- [ ] add coverage for the shared logical `file` table-binding behavior across multi-object formats
- [ ] add coverage for multiline `Codex Assistant` intent entry including `Shift+Enter` best-effort newline handling
- [ ] add coverage for `Ctrl+D` submit behavior in the multiline prompt
- [ ] add coverage for simple or non-raw downgrade to single-line intent prompt with warning
- [ ] add coverage that interactive multiline intent normalization reuses the shared CLI `data query codex` drafting contract
- [ ] add coverage that interactive output selection preserves the direct CLI mutually exclusive output contract

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
