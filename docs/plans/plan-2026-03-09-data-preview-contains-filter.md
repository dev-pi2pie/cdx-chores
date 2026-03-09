---
title: "Data preview contains filter"
created-date: 2026-03-09
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
- there is no row-filtering flag yet

## Scope

### CLI contract

- add repeatable `--contains <column>:<keyword>`
- allow multiple `--contains` flags in one command
- combine multiple `--contains` filters as logical `AND`
- require a named column in the first implementation
- reject malformed filter values and unknown columns with clear validation errors

### Matching behavior

- match against the display-safe string value already used by preview rows
- use case-insensitive substring matching
- keep matching literal, not regex-based
- apply filtering before offset/window slicing
- preserve the existing preview rendering contract after filtering

### Interactive mode

- add optional interactive prompt support for one or more `--contains` values only if the prompt flow stays simple
- if interactive filter entry is added in this plan, use a single comma-separated or repeat-entry prompt rather than a mini query builder

## Non-Goals

- SQL syntax
- regex search
- global any-column search in the first pass
- `OR` logic between filter terms
- Parquet support
- DuckDB-backed execution

## Implementation Touchpoints

- `src/command.ts`
- `src/cli/actions/data-preview.ts`
- `src/cli/data-preview/source.ts`
- `src/cli/interactive/data.ts`
- focused preview tests under `test/`
- `docs/guides/data-preview-usage.md`

## Phase Checklist

### Phase 1: Freeze filter contract

- [ ] define `--contains <column>:<keyword>` parsing rules
- [ ] define malformed-input behavior for:
  - [ ] missing `:`
  - [ ] blank column
  - [ ] blank keyword
  - [ ] unknown column
- [ ] define multi-filter semantics as logical `AND`
- [ ] define whether interactive mode support is in scope now or deferred

### Phase 2: Source/controller filtering

- [ ] add parsed contains-filter handling to the preview action path
- [ ] filter rows before offset/window slicing
- [ ] keep filtering on the existing string-display values
- [ ] preserve deterministic row ordering after filtering

### Phase 3: CLI and interactive wiring

- [ ] add repeatable `--contains` to `data preview`
- [ ] wire validation errors through the existing `CliError` contract
- [ ] if included in scope, add a simple interactive filter prompt

### Phase 4: Tests

- [ ] add focused coverage for:
  - [ ] single contains filter
  - [ ] multiple contains filters combined as `AND`
  - [ ] case-insensitive matching
  - [ ] filtering before offset/window slicing
  - [ ] malformed filter input
  - [ ] unknown column validation
- [ ] add CLI UX coverage for the new option help/output
- [ ] add interactive coverage only if interactive filter entry is implemented in this pass

### Phase 5: Docs and verification

- [ ] update `docs/guides/data-preview-usage.md`
- [ ] document the bounded scope:
  - [ ] named-column only
  - [ ] literal substring match
  - [ ] `AND` combination only
- [ ] run manual smoke checks against `examples/playground/tabular-preview/`

## Success Criteria

- users can narrow preview rows with simple field-scoped keyword matching
- filtering stays small and deterministic instead of becoming an ad hoc query language
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
