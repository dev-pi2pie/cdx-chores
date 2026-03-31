---
title: "Data extract DuckDB-file parity"
created-date: 2026-03-31
modified-date: 2026-03-31
status: completed
agent: codex
---

## Goal

Add DuckDB-file support to `data extract` so the command-family source contract stays aligned with SQLite-style file-backed database support while keeping `data extract` single-table-oriented.

## Why This Plan

The workspace-query research and plan now treat DuckDB-file as the next preferred backend follow-up after the current SQLite workspace slice in `data query`.

That follow-up creates a related but separate parity need in `data extract`:

- `data query` should gain DuckDB-file relation binding and workspace behavior
- `data extract` should gain DuckDB-file source selection and one-table materialization behavior

Those are related source-family concerns and different command contracts.

This work should therefore live in its own plan because it needs to preserve the `data extract` model:

- one source container per invocation
- one selected source object
- one shaped table materialized to output
- no workspace aliases
- no join authoring

## Dependency Note

- this plan should follow the DuckDB-file source-family decisions already recorded in:
  - `docs/researches/research-2026-03-31-multi-source-query-workspace-contract.md`
  - `docs/plans/plan-2026-03-31-data-query-workspace-implementation.md`
- this plan should follow the existing `data extract` materialization and shaping contracts rather than redefining them
- shared source detection, source listing, and catalog selection helpers should be reused across `data query` and `data extract` where practical

## Outcome

- `data extract` now supports DuckDB-file as a direct input family
- the command remains intentionally single-table-oriented
- `.duckdb` detection and explicit `duckdb` format selection now align with the broader data command family
- generic `*.db` paths remain explicit-only through `--input-format`
- the shipped extract lane now stays aligned with the query lane on DuckDB source-family behavior without inheriting workspace semantics

## Design Contract

### Command-family alignment

DuckDB-file support in `data extract` should align with the same source-family rules used by `data query`:

- support `duckdb` as an explicit input format
- detect `*.duckdb` as the clearest automatic DuckDB-file extension
- keep generic `*.db` ambiguous unless the user provides `--input-format`
- keep direct CLI and interactive mode aligned on that ambiguity rule

### `data extract` contract

DuckDB-file support in `data extract` should preserve the existing command boundary:

- one source container per invocation
- one selected table or view
- one extracted output artifact
- no workspace binding
- no repeatable `--relation`
- no multi-table SQL or join surface

### Source selection behavior

DuckDB-file should behave more like SQLite than Excel in `data extract`:

- list available tables and views when selection is required
- require explicit source selection when multiple source objects exist
- preserve one-source shorthand only when the catalog has one usable object or when the product already allows that behavior consistently

### Fixture and smoke contract

DuckDB-file support should include generated public-safe fixtures rather than ad hoc binary test assets.

Minimum fixture expectations:

- one DuckDB file with multiple tables
- at least one non-default schema
- at least one joinable pair of relations shared with query-oriented smoke scenarios
- one case that protects a real backend object named `file`

The extract-specific suite should only materialize one selected relation at a time, but it should share the same fixture family as the future DuckDB-file query work where practical.

## Scope

### Direct CLI support

- add `duckdb` to the supported `data extract` input-format family
- recognize `*.duckdb` as a DuckDB-file input
- keep `*.db` explicit-only through `--input-format duckdb` or `--input-format sqlite`
- support DuckDB-file source selection in the direct extract flow

### Shared source-resolution helpers

- extend shared source detection and source listing helpers to understand DuckDB-file catalogs
- keep the helper surface compatible with both:
  - single-source `data extract`
  - future workspace-capable `data query`
- avoid introducing extract-only source-family logic when shared helpers can own the behavior cleanly

### Interactive parity

- support DuckDB-file input selection in interactive `data extract`
- keep interactive behavior aligned with SQLite-style single-source extract flow
- prompt for explicit format selection when a chosen path is ambiguous such as `*.db`

### Fixtures and tests

- add generated DuckDB-file fixture coverage for extract-oriented scenarios
- add command, action, and interactive coverage for:
  - `.duckdb` detection
  - explicit `--input-format duckdb`
  - ambiguous `*.db` requiring explicit selection
  - source listing and source-required errors
  - successful one-table extraction from a DuckDB file

### Documentation

- update `docs/guides/data-extract-usage.md`
- clarify the support matrix so DuckDB-file appears alongside SQLite as a file-backed database family
- keep the docs explicit that DuckDB-file workspace behavior belongs to `data query`, not `data extract`

## Non-Goals

- DuckDB-file workspace support inside `data extract`
- repeatable `--relation` support in `data extract`
- join authoring or SQL execution in `data extract`
- Excel multi-relation shaping
- multi-file relation assembly such as globs or `union_by_name`
- connection-backed extract inputs such as Postgres or MySQL

## Risks and Mitigations

- Risk: DuckDB-file support drifts between `data query` and `data extract`.
  Mitigation: freeze extension detection, ambiguous-path handling, and shared catalog discovery once across both command families.

- Risk: `data extract` starts inheriting workspace concepts from `data query`.
  Mitigation: keep the command boundary explicit: one selected source object only.

- Risk: `.db` ambiguity becomes user-hostile if behavior differs between direct CLI and interactive mode.
  Mitigation: preserve one rule in both surfaces: ambiguous extensions require explicit format selection.

- Risk: fixture coverage only validates simple single-schema cases and misses real DuckDB catalog behavior.
  Mitigation: require generated fixtures with multiple tables and at least one non-default schema.

## Implementation Touchpoints

- `src/cli/actions/data-extract.ts`
- `src/cli/commands/data/extract.ts`
- shared source-resolution and DuckDB catalog helpers under `src/cli/duckdb/`
- interactive extract flow under `src/cli/interactive/`
- `scripts/generate-data-query-fixtures.mjs` or a dedicated DuckDB fixture generator if the current script boundary becomes too mixed
- extract tests under `test/`
- `docs/guides/data-extract-usage.md`

## Phase Checklist

### Phase 1: Freeze DuckDB extract contract

- [x] add `duckdb` as an explicit `data extract` input format
- [x] freeze `.duckdb` detection behavior
- [x] freeze ambiguous `*.db` behavior as explicit-only through `--input-format`
- [x] freeze one-source-only behavior for DuckDB-file extract runs

### Phase 2: Shared catalog support

- [x] extend shared source listing to understand DuckDB-file catalogs
- [x] support direct extract source selection against DuckDB tables and views
- [x] keep the helper boundary reusable by future DuckDB-file query work

### Phase 3: Interactive extract parity

- [x] support DuckDB-file format selection in interactive extract flow
- [x] support DuckDB-file source selection in interactive extract flow
- [x] keep interactive ambiguous `*.db` behavior aligned with direct CLI

### Phase 4: Fixtures, tests, and docs

- [x] generate a stable DuckDB extract smoke fixture family
- [x] add direct CLI and action coverage for DuckDB-file extraction
- [x] add interactive extract coverage for DuckDB-file selection and extraction
- [x] update the extract guide support matrix and usage docs
- [x] clarify that DuckDB-file workspace behavior belongs to `data query`, not `data extract`

## Related Research

- `docs/researches/research-2026-03-31-multi-source-query-workspace-contract.md`
- `docs/researches/research-2026-03-09-data-query-scope-and-contract.md`

## Related Plans

- `docs/plans/plan-2026-03-31-data-query-workspace-implementation.md`
- `docs/plans/plan-2026-03-18-data-extract-shaped-table-materialization.md`
- `docs/plans/plan-2026-03-18-data-extract-interactive-and-public-smoke-fixtures.md`
