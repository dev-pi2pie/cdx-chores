---
title: "Data preview contains filter"
created-date: 2026-03-09
modified-date: 2026-03-09
status: draft
agent: codex
---

## Goal

Add lightweight row filtering to `data preview` through repeatable `--contains <column>:<keyword>` flags on the existing in-memory JSON/CSV preview path.

## Why This Plan

The current `data preview` feature can inspect tabular data, but it still requires users to visually scan the whole visible window.

A bounded field-search step is useful before DuckDB because it:

- solves a real inspection workflow now
- does not require SQL or Parquet support
- fits the current JSON/CSV in-memory preview architecture
- keeps the later DuckDB plan focused on Parquet and richer querying

## Current State

- `data preview` supports:
  - `--rows`
  - `--offset`
  - `--columns`
- preview sources already normalize JSON and CSV rows into a shared string-display shape
- preview rendering already supports bounded windows, column filtering, interactive mode, and global color control
- the current preview summary derives `Rows` and `Window` from the unfiltered source row count
- there is no row-filtering flag yet

## Scope

### CLI contract

- add repeatable `--contains <column>:<keyword>`
- allow multiple `--contains` flags in one command
- combine multiple `--contains` filters as logical `AND`
- require a named column in the first implementation
- parse each flag by splitting on the first unescaped `:`
- allow literal `:` and `\\` inside either segment through `\:` and `\\\\` escapes
- treat any additional unescaped `:` characters after the split as part of the keyword
- reject malformed filter values and unknown columns with clear validation errors

### Matching behavior

- match against the display-safe string value already used by preview rows
- use case-insensitive substring matching
- keep matching literal, not regex-based
- apply filtering before offset/window slicing
- make preview summaries reflect the filtered row set:
  - `Rows` reports the filtered total
  - `Window` reports the filtered slice position over that filtered total
- keep the first implementation single-surface and do not add a second unfiltered-count summary line
- preserve the existing preview rendering contract after filtering

### Interactive mode

- defer interactive `--contains` entry in this plan
- keep the existing interactive preview flow unchanged for now
- revisit interactive filter prompts only in a separate follow-up after the direct CLI contract is implemented and tested

## Non-Goals

- SQL syntax
- regex search
- global any-column search in the first pass
- `OR` logic between filter terms
- interactive filter prompts in this pass
- Parquet support
- DuckDB-backed execution

## Implementation Touchpoints

- `src/command.ts`
- `src/cli/actions/data-preview.ts`
- `src/cli/data-preview/source.ts`
- `src/cli/data-preview/render.ts`
- focused preview tests under `test/`
- `docs/guides/data-preview-usage.md`

## Phase Checklist

### Phase 1: Freeze filter contract

- [ ] define `--contains <column>:<keyword>` parsing rules
- [ ] define escaping and split rules for literal `:` and `\\` characters
- [ ] define malformed-input behavior for:
  - [ ] missing `:`
  - [ ] blank column
  - [ ] blank keyword
  - [ ] unknown column
- [ ] define behavior for malformed escape sequences
- [ ] define multi-filter semantics as logical `AND`
- [ ] document that interactive filter entry is deferred from this plan

### Phase 2: Source/controller filtering

- [ ] add parsed contains-filter handling to the preview action path
- [ ] filter rows before offset/window slicing
- [ ] keep filtering on the existing string-display values
- [ ] preserve deterministic row ordering after filtering
- [ ] make `Rows` and `Window` summary output report filtered totals consistently

### Phase 3: CLI wiring and validation

- [ ] add repeatable `--contains` to `data preview`
- [ ] wire validation errors through the existing `CliError` contract
- [ ] keep interactive preview prompts unchanged in this pass

### Phase 4: Tests

- [ ] add focused coverage for:
  - [ ] single contains filter
  - [ ] multiple contains filters combined as `AND`
  - [ ] case-insensitive matching
  - [ ] filtering before offset/window slicing
  - [ ] filtered `Rows` and `Window` summary semantics
  - [ ] escaped `:` handling in filter parsing
  - [ ] escaped `\\` handling in filter parsing
  - [ ] malformed filter input
  - [ ] malformed escape input
  - [ ] unknown column validation
- [ ] add CLI UX coverage for the new option help/output

### Phase 5: Docs and verification

- [ ] update `docs/guides/data-preview-usage.md`
- [ ] document the bounded scope:
  - [ ] named-column only
  - [ ] literal substring match
  - [ ] `AND` combination only
  - [ ] escape rules for literal `:` and `\\`
  - [ ] filtered summaries report filtered totals
  - [ ] interactive filter entry remains deferred
- [ ] run manual smoke checks against `examples/playground/tabular-preview/`

## Success Criteria

- users can narrow preview rows with simple field-scoped keyword matching
- filtering stays small and deterministic instead of becoming an ad hoc query language
- preview summaries stay internally consistent with the filtered result set
- the later DuckDB plan remains free to define a richer query surface

## Verification

- `bunx tsc --noEmit`
- focused `bun test` preview suites
- manual smoke checks on generated preview fixtures

## Related Research

- `docs/researches/research-2026-03-02-tabular-data-preview-and-query-scope.md`

## Related Plans

- `docs/plans/plan-2026-03-09-tabular-data-preview-v1-implementation.md`
- `docs/plans/plan-2026-03-09-data-preview-interactive-and-color-polish.md`
