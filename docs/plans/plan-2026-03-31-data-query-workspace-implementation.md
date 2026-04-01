---
title: "Data query workspace implementation"
created-date: 2026-03-31
modified-date: 2026-03-31
status: completed
agent: codex
---

## Goal

Implement the first workspace-based expansion of `data query` so one source container can expose explicit relation bindings for SQL authoring, review, and execution without breaking the current single-source `file` shorthand.

## Why This Plan

The new research now freezes the next-stage contract:

- one source container per invocation still remains the first boundary
- the old single-source path remains available for compatibility
- explicit workspace mode is introduced through repeatable relation bindings
- any explicit relation binding enters workspace mode, even when only one relation is bound
- multi-relation authoring belongs to `data query`, not `data extract`
- interactive mode must gain a workspace-binding phase before SQL authoring
- SQLite and DuckDB-file fit the same public contract, even if implementation sequencing lands SQLite first

This work is best handled as a dedicated plan because it crosses direct CLI, shared DuckDB preparation, interactive query, Codex drafting, docs, and fixtures. It is materially larger than a flag follow-up and smaller than a general query-family redesign.

## Current State

- direct `data query` is built around one logical relation named `file`
- `--source` selects one backend object for SQLite or Excel and rebinds it to `file`
- interactive `data query` also assumes one selected source object before SQL authoring
- `data query codex` drafts only against the singular `file` relation
- deterministic shaping and header-mapping flows already exist for one-source query work
- the current smoke fixtures cover representative formats, including multi-object SQLite and Excel inputs
- the new workspace research now freezes:
  - one source container per invocation
  - explicit workspace mode via repeatable relation bindings
  - reserved `file` alias in workspace mode
  - SQLite-first implementation focus
  - deferred Excel multi-relation shaping
  - deferred multi-file relation assembly as a separate future family

## Design Contract

### Public model

- one invocation creates one query workspace
- one workspace contains one or more bound logical relations
- one positional input path still identifies one source container
- the old single-source shorthand remains valid when no explicit relation bindings are present

### Direct CLI contract

- keep the current single-source path:
  - `data query <input> --sql "..."`
- keep the current single-object selector path for the compatibility lane:
  - `data query <input> --source <name> --sql "..."`
- add repeatable relation bindings:
  - `--relation users`
  - `--relation bookmarks`
  - `--relation u=users`
- bare `--relation users` means `users=users`
- any explicit `--relation` flag enters workspace mode
- once in workspace mode, SQL must target explicit relation names rather than the implicit `file` alias

### Alias rule

- `file` remains a compatibility alias only when exactly one implicit single-source relation is active
- workspace mode reserves `file` from explicit alias use
- a backend object actually named `file` must be rebound under a different alias such as `f=file`

### Source-family scope

First implementation focus:

- SQLite as the first file-backed catalog source for workspace bindings

Implemented by this plan after the initial SQLite-first slice:

- DuckDB database files

Explicitly deferred:

- Excel multi-relation binding until per-relation shaping is designed
- multi-file relation assembly such as file lists, globs, `union_by_name`, or `filename`-style provenance controls
- connection-backed sources such as Postgres or MySQL

Practical reading:

- this plan delivered the workspace model for SQLite first and then extended it to DuckDB-file
- the shared APIs, docs, and validation wording now cover both file-backed catalog backends
- Excel workspace support remains deferred outside this plan

### Interactive contract

- keep one source container per interactive invocation
- inspect the source container first
- add a scope choice before SQL authoring:
  - single-source query
  - workspace query
- single-source path keeps:
  - `manual`
  - `formal-guide`
  - `Codex Assistant`
- workspace path keeps first-pass authoring to:
  - `manual`
  - `Codex Assistant`
- workspace-mode `formal-guide` remains deferred

### Codex drafting contract

- single-source drafting may keep the current `file` shorthand
- workspace-mode drafting must expose explicit relation names and relation-local schema summaries
- Codex prompts must instruct the model to use only the relations bound into the current workspace

### Ambiguous-extension contract

- narrow extension-based auto-detection remains preferred
- generic `*.db` stays ambiguous
- direct CLI must continue to require explicit `--input-format` for ambiguous paths
- interactive mode must prompt for explicit format choice instead of presenting a false-positive detected format

### Fixture and verification contract

- preserve the current representative single-source fixture set
- add workspace-oriented fixtures that cover:
  - one explicit relation binding
  - multiple explicit relation bindings
  - joinable relations
  - a backend object named `file`
- keep fixture design scenario-oriented rather than only format-oriented

## Scope

### Direct CLI surface

- add repeatable `--relation <binding>` to `data query`
- add repeatable `--relation <binding>` to `data query codex`
- define validation behavior between:
  - implicit single-source mode
  - `--source` compatibility mode
  - workspace mode via `--relation`
- reject `file` as an explicit alias in workspace mode
- keep existing single-source SQL execution behavior intact when no `--relation` flags are present

### Shared DuckDB preparation

- extend query-source preparation so it can bind multiple relations into one connection-scoped workspace
- separate backend object selection from SQL-visible alias naming
- preserve current one-relation preparation for single-source mode
- keep SQLite as the first required workspace-capable backend
- structure the API so DuckDB-file support can attach later without redesigning the binding model

### Interactive `data query`

- add workspace-versus-single-source scope selection after source inspection
- add relation-binding prompts for workspace mode
- carry accepted workspace bindings through:
  - `manual`
  - `Codex Assistant`
  - SQL review
  - execution
  - output selection
- preserve the current single-source interactive flow for:
  - `manual`
  - `formal-guide`
  - `Codex Assistant`

### `data query codex`

- extend introspection to gather workspace-aware relation summaries
- revise prompt construction so workspace-mode Codex sees:
  - relation names
  - relation-local columns
  - bounded samples per relation
- keep single-source drafting behavior backward-compatible

### Documentation

- update `docs/guides/data-query-usage.md`
- update `docs/guides/data-query-codex-usage.md`
- update `docs/guides/data-query-interactive-usage.md`
- describe workspace relation binding as distinct from multi-file relation assembly
- add a concise support table that distinguishes:
  - current single-source support
  - workspace support implemented by this plan
  - workspace support deferred to follow-up work
- keep file-backed catalog examples behavior-oriented and public-safe

### Fixtures and tests

- extend the query fixture generator and stable test fixtures for workspace scenarios
- add command, action, and interactive coverage for:
  - one explicit relation binding
  - multiple relation bindings
  - reserved `file` alias rejection
  - Codex workspace prompt shaping
  - interactive workspace binding and execution routing

### Follow-up direction

The next preferred backend follow-up after the current SQLite slice is DuckDB-file workspace support, not Excel multi-relation shaping.

That follow-up should cover:

- `duckdb` input-format support and `.duckdb` extension detection
- continued explicit `--input-format` selection for ambiguous `*.db` paths
- relation binding against DuckDB-file catalogs
- schema-qualified selectors where needed
- generated DuckDB smoke fixtures that include:
  - multiple tables
  - at least one non-default schema
  - joinable relations
  - a reserved-`file` alias protection case

## Non-Goals

- multi-file relation assembly
- file lists, glob patterns, `union_by_name`, or filename-provenance controls
- Excel multi-relation shaping
- connection-backed database support
- workspace-mode `formal-guide`
- extending `data extract` into a multi-relation workspace command
- redesigning output modes beyond what workspace execution needs

## Risks and Mitigations

- Risk: the new relation-binding surface overlaps confusingly with the old `--source` path.
  Mitigation: freeze one rule set where `--source` remains the single-object compatibility lane and any `--relation` enters workspace mode.

- Risk: `file` alias semantics stay fuzzy during migration.
  Mitigation: reserve `file` in workspace mode, document the rule clearly, and reject conflicting explicit aliases early.

- Risk: workspace support leaks into Excel before per-relation shaping is ready.
  Mitigation: keep Excel multi-relation binding out of scope for the first implementation plan.

- Risk: interactive workspace mode becomes a hidden variant of the current source picker instead of a visible contract.
  Mitigation: add an explicit scope-selection checkpoint before SQL authoring and keep workspace binding as its own phase.

- Risk: Codex drafting reuses single-source assumptions and generates invalid workspace SQL.
  Mitigation: split prompt construction by mode and require explicit relation-name framing in workspace mode.

- Risk: fixture growth becomes ad hoc and obscures the contract under too many format-specific cases.
  Mitigation: add workspace fixtures by scenario family first, then expand formats only where they exercise distinct behavior.

## Implementation Touchpoints

- `src/cli/commands/data/query.ts`
- `src/cli/actions/data-query.ts`
- `src/cli/actions/data-query-codex.ts`
- `src/cli/duckdb/query/types.ts`
- `src/cli/duckdb/query/prepare-source.ts`
- `src/cli/duckdb/query/introspection.ts`
- `src/cli/duckdb/query/source-resolution.ts`
- `src/cli/data-query/codex.ts`
- `src/cli/interactive/data-query/index.ts`
- `src/cli/interactive/data-query/source-selection.ts`
- `src/cli/interactive/data-query/execution.ts`
- interactive and query tests under `test/`
- `scripts/generate-data-query-fixtures.mjs`
- `docs/guides/data-query-usage.md`
- `docs/guides/data-query-codex-usage.md`
- `docs/guides/data-query-interactive-usage.md`

## Phase Checklist

### Phase 1: Freeze relation-binding API

- [x] freeze repeatable `--relation <binding>` syntax
- [x] freeze bare binding semantics as `name=name`
- [x] freeze alias syntax as `alias=object`
- [x] freeze workspace-entry rule for any explicit `--relation`
- [x] freeze reserved `file` behavior in workspace mode
- [x] freeze coexistence rules for `--source` versus `--relation`

### Phase 2: Shared workspace binding foundation

- [x] introduce workspace-aware query preparation helpers
- [x] preserve the current single-source `file` preparation path
- [x] implement multi-binding support for SQLite source containers
- [x] validate relation aliases and backend object selection deterministically
- [x] reject reserved `file` alias usage in workspace mode

### Phase 3: Direct CLI execution and Codex drafting

- [x] add `--relation` support to direct `data query`
- [x] add `--relation` support to `data query codex`
- [x] keep current single-source behavior unchanged when `--relation` is absent
- [x] add workspace-aware introspection payloads for Codex drafting
- [x] split single-source and workspace prompt construction in `data-query/codex.ts`

### Phase 4: Interactive workspace query flow

- [x] add source-container scope choice:
  - [x] single-source query
  - [x] workspace query
- [x] add workspace relation-binding prompts
- [x] route workspace mode through `manual`
- [x] route workspace mode through `Codex Assistant`
- [x] keep `formal-guide` on the single-source path only
- [x] keep SQL review, execution, and output selection aligned with explicit relation names

### Phase 5: Fixtures, tests, and docs

- [x] extend fixture generation for workspace scenarios
- [x] add stable tests for direct CLI workspace behavior
- [x] add stable tests for Codex workspace drafting behavior
- [x] add interactive coverage for workspace selection and binding
- [x] update the query, Codex, and interactive guides
- [x] add a guide support table covering SQLite, Excel, DuckDB-file, and deferred multi-file assembly behavior
- [x] clarify in docs that multi-file relation assembly remains a separate future area

### Phase 6: DuckDB-file workspace follow-up

- [x] add `duckdb` input-format support to `data query`
- [x] detect `.duckdb` inputs while keeping generic `*.db` explicit-only through `--input-format`
- [x] extend workspace relation binding to DuckDB-file catalogs
- [x] support schema-qualified selectors where the DuckDB catalog requires them
- [x] generate a stable `multi.duckdb` smoke fixture with:
  - [x] multiple tables
  - [x] at least one non-default schema
  - [x] joinable relations
  - [x] a reserved-`file` alias protection case
- [x] add direct CLI, Codex drafting, and source-listing coverage for DuckDB-file workspace inputs

## Deferred Follow-up Area

Excel workspace support should not be treated as a numbered implementation phase in this plan.

It remains a separate deferred area that first requires dedicated research for:

- per-relation workbook shaping
- sheet-specific `range`, `header-row`, and `body-start-row` state
- how reviewed shape artifacts scale across multiple bound sheets

Only after that research is frozen should a separate Excel-workspace implementation plan be created.

## Related Research

- `docs/researches/research-2026-03-31-multi-source-query-workspace-contract.md`
- `docs/researches/archive/research-2026-03-09-data-query-scope-and-contract.md`
- `docs/researches/archive/research-2026-03-20-data-command-surface-headerless-and-codex-boundaries.md`

## Related Plans

- `docs/plans/archive/plan-2026-03-10-data-query-cli-implementation.md`
- `docs/plans/plan-2026-03-10-data-query-interactive-flow-implementation.md`
- `docs/plans/plan-2026-03-10-data-query-codex-cli-drafting.md`
- `docs/plans/plan-2026-03-18-data-source-shaping-foundation.md`
- `docs/plans/plan-2026-03-30-interactive-data-query-followup-implementation.md`
