---
title: "Data query CLI implementation"
created-date: 2026-03-10
modified-date: 2026-03-10
status: draft
agent: codex
---

## Goal

Implement the direct CLI surface for `data query` as the first DuckDB-backed query workflow in the repo, using the frozen contract from the March 10 research.

## Why This Plan

The `data query` contract is now narrow enough to implement without reopening core product questions.

The direct CLI path should land before interactive query because it:

- is the smallest complete user-facing query surface
- keeps SQL-first behavior explicit
- establishes the backend, error, and output contracts that interactive mode will later reuse
- avoids blocking on guided-query UX, Codex-assisted UX, or introspection-first prompt design

This plan intentionally keeps SQL execution separate from later Codex-assisted SQL drafting.

It should also own its own smoke-fixture generation path instead of reusing preview fixture scripts opportunistically.

## Current State

- `data preview` exists for lightweight CSV/JSON inspection
- `data parquet preview` exists as the first DuckDB-backed bounded preview path
- `@duckdb/node-api` is already installed and used for Parquet preview
- the `data query` research contract is now frozen
- there is no `data query` CLI command yet
- there is no DuckDB query adapter layer for CSV/TSV, SQLite, or Excel in the direct CLI path
- doctor does not yet expose query capability by format
- there is no separate `data query codex` drafting lane yet

## Design Contract

### Command shape

- command: `data query <input> --sql "<query>"`
- one input file per invocation
- one logical SQL table name: `file`
- SQL is required in the first implementation
- this command executes SQL and does not infer SQL from natural-language intent

### Supported input formats

- built-in first-class inputs:
  - Parquet
  - CSV-family delimited text (`.csv`, `.tsv`)
- extension-backed first-class inputs:
  - SQLite
  - Excel
- JSON remains out of scope for this plan

### Input and source selection

- `--input-format <format>` overrides automatic input detection
- `--source <name>` selects the source object for formats with multiple logical objects
- `--source` is required for SQLite tables/views and Excel sheets in direct CLI mode
- direct CLI does not auto-select a default source object for multi-object formats
- the selected source object is exposed in SQL as logical table `file`

### Output contract

- default stdout rendering is a bounded terminal table
- `--rows <n>` controls bounded table display
- default bounded table rendering shows 20 rows
- `--json` streams full query results to stdout
- `--pretty` only affects JSON serialization
- `--output <path>` writes full query results to a file
- output format is inferred from `.json` or `.csv`
- when `--output <path>` is used, the result payload is written only to the target file
- when `--output <path>` is used, normal table or JSON result payload should not also be emitted to stdout
- logs and status messaging must stay separate from result payloads
- diagnostics and status output should use stderr when a file payload is being written

### Error contract

- input detection errors stay distinct from DuckDB runtime errors
- missing source selection errors stay distinct from query execution errors
- extension-backed failures distinguish:
  - supported in principle
  - extension load failed
  - extension install unavailable
- the CLI must not silently install missing extensions

### Capability reporting

- doctor should expose query capability by format
- extension-backed formats should report:
  - detected support
  - loadability
  - installability

### Smoke-fixture generation contract

- add a dedicated `data query` smoke-fixture generator under `scripts/`
- keep it separate from `scripts/generate-tabular-preview-fixtures.mjs` and `scripts/generate-parquet-preview-fixtures.mjs`
- generate playground smoke assets under `examples/playground/data-query/`
- support deterministic regeneration through a reset-style command
- cover representative inputs for:
  - CSV
  - TSV
  - Parquet
  - SQLite
  - Excel
- keep this generator for manual smoke preparation and contract verification, not as a required runtime dependency of routine automated tests
- keep the generator local-only and deterministic
- do not require network downloads during smoke-fixture generation
- do not depend on runtime extension installation during smoke-fixture generation
- prefer stable local generation dependencies or checked-in generation tooling over ad hoc environment assumptions

Recommended first-pass script shape:

- `scripts/generate-data-query-fixtures.mjs`
- commands:
  - `seed`
  - `clean`
  - `reset`

First-pass fixture goals:

- one small happy-path fixture per supported input family
- one SQLite fixture with multiple tables or views to exercise `--source`
- one Excel fixture with multiple sheets to exercise `--source`
- one wider fixture to exercise column selection and JSON or CSV export checks
- one larger fixture to exercise bounded table rendering and full-result export separation

### Follow-up command-family note

- `data query` is the execution lane
- `data query codex <input> --intent "..."` is the separate CLI drafting lane
- that lane is covered by its own follow-up plan and must not be folded into the base execution command

## Scope

### CLI surface

- add `data query <input> --sql "<query>"`
- add `--input-format <format>`
- add `--source <name>`
- add `--rows <n>` for bounded table output
- add `--json`
- add `--pretty`
- add `--output <path>`
- keep `--pretty` valid only for JSON serialization on `--json` stdout and `.json` file output

### Backend behavior

- detect supported input formats from extension or explicit override
- bind supported inputs to one logical SQL table name `file`
- load required DuckDB extensions explicitly for SQLite and Excel
- keep extension installation non-default and guidance-driven
- support deterministic source-object binding for SQLite and Excel
- preserve full SQL semantics by avoiding hidden query rewrites such as implicit `LIMIT`

### Output behavior

- render bounded table output through the terminal path
- serialize full JSON results to stdout with optional pretty-printing
- serialize full JSON or CSV results to files based on output-path extension
- reject `--pretty` for bounded table output and `.csv` file output
- keep table rendering bounded without affecting JSON/file-export query semantics

### Doctor surface

- expose direct query capability by format
- distinguish built-in query-capable formats from extension-backed formats
- expose detected support, loadability, and installability for extension-backed formats

### Smoke-fixture generation

- add a dedicated generator for `data query` smoke fixtures
- keep query smoke generation independent from preview smoke generation
- land generated playground smoke assets under `examples/playground/data-query/`
- keep automated tests on stable test fixtures or generated-once fixtures rather than runtime smoke generation

## Non-Goals

- interactive `data query`
- non-SQL query helpers such as `--select` or `--limit`
- JSON input querying
- pagination
- remote data sources
- multi-file joins
- attachment aliases
- editor-backed SQL entry
- Codex-assisted query generation inside the base `data query` execution command
- `data query codex` authoring-lane implementation

## Risks and Mitigations

- Risk: source-object handling for SQLite and Excel may drift into multi-table or attachment semantics.
  Mitigation: freeze `--source` to one selected object mapped to logical table `file`.

- Risk: output modes may accidentally diverge in semantics, with table bounds leaking into JSON or file export.
  Mitigation: treat `--rows` as a presentation-only control and keep JSON/file export full-result by default.

- Risk: extension-backed support may behave inconsistently across local, CI, offline, and sandboxed environments.
  Mitigation: keep install non-default, expose capability detail in doctor, and surface targeted guidance on load/install failures.

- Risk: CSV and TSV support may drift into format-specific parser behavior that is not explicit in the plan.
  Mitigation: freeze CSV-family delimited text as part of the first-class surface and test both `.csv` and `.tsv`.

- Risk: manual smoke coverage may become ad hoc and drift away from the supported command contract.
  Mitigation: add an independent `data query` smoke-fixture generator so representative inputs can be regenerated consistently across formats.

## Implementation Touchpoints

- `src/command.ts`
- new `src/cli/actions/data-query.ts`
- new DuckDB query helpers under `src/cli/duckdb/`
- shared path/output helpers under `src/cli/actions/` and `src/cli/fs-utils.ts` as needed
- output rendering or serializer helpers under `src/cli/`
- `src/cli/actions/doctor.ts`
- focused query tests under `test/`
- new smoke-fixture generator under `scripts/`
- generated smoke assets under `examples/playground/data-query/`
- new usage guide docs under `docs/guides/`

## Phase Checklist

### Phase 0: Smoke-fixture generation suite

- [ ] add `scripts/generate-data-query-fixtures.mjs`
- [ ] support `seed`, `clean`, and `reset`
- [ ] generate deterministic smoke fixtures under `examples/playground/data-query/`
- [ ] cover representative CSV, TSV, Parquet, SQLite, and Excel inputs
- [ ] include multi-object SQLite and Excel fixtures for `--source` coverage
- [ ] keep smoke generation independent from preview fixture generators

### Phase 1: Freeze CLI command and validation contract

- [ ] add `data query <input> --sql "<query>"` to the CLI surface
- [ ] add `--input-format <format>`
- [ ] add `--source <name>`
- [ ] add `--rows <n>`
- [ ] add `--json`
- [ ] add `--pretty`
- [ ] add `--output <path>`
- [ ] define validation behavior for incompatible flag combinations
- [ ] define validation behavior for missing `--source` on multi-object formats
- [ ] define validation behavior for unsupported output extensions
- [ ] define validation behavior for `--pretty` without a JSON payload target
- [ ] define validation behavior for conflicting stdout-vs-file output flags

### Phase 2: Input detection and source binding

- [ ] implement extension-based input detection
- [ ] implement `--input-format` override behavior
- [ ] add source-object selection logic for SQLite and Excel
- [ ] bind the chosen source object to logical table `file`
- [ ] keep direct CLI deterministic when source selection is ambiguous

### Phase 3: DuckDB query adapter layer

- [ ] implement direct query setup for Parquet
- [ ] implement direct query setup for CSV/TSV
- [ ] implement direct query setup for SQLite with explicit extension loading
- [ ] implement direct query setup for Excel with explicit extension loading
- [ ] surface targeted runtime failures for extension-backed formats

### Phase 4: Output rendering and serialization

- [ ] render bounded table output with the 20-row default
- [ ] honor `--rows` without changing SQL semantics
- [ ] implement JSON stdout serialization for `--json`
- [ ] implement `--pretty` JSON formatting behavior
- [ ] implement file output for `.json`
- [ ] implement file output for `.csv`
- [ ] keep stdout payloads and status/log output separated

### Phase 5: Doctor support

- [ ] add format-aware query capability reporting
- [ ] expose built-in format support separately from extension-backed format support
- [ ] expose detected support, loadability, and installability for extension-backed formats
- [ ] define doctor behavior when the environment blocks install checks

### Phase 6: Tests

- [ ] add direct CLI coverage for each supported input family
- [ ] add coverage for `--input-format`
- [ ] add coverage for `--source`
- [ ] add coverage for missing-source validation
- [ ] add coverage for no implicit default source selection on multi-object formats
- [ ] add coverage for bounded table output with default and explicit `--rows`
- [ ] add coverage for `--json`
- [ ] add coverage for `--pretty`
- [ ] add coverage for `--output` with `.json`
- [ ] add coverage for `--output` with `.csv`
- [ ] add coverage for `--output` suppressing stdout result payloads
- [ ] add coverage for invalid `--pretty` usage without a JSON payload target
- [ ] add coverage for conflicting output-mode flag combinations
- [ ] add coverage for unsupported output extensions
- [ ] add coverage for extension load failure and install-unavailable guidance
- [ ] add doctor coverage for detected support, loadability, and installability
- [ ] confirm the smoke-fixture generator produces stable representative inputs for manual verification

### Phase 7: Docs and verification

- [ ] add a dedicated `data query` CLI usage guide
- [ ] document the SQL-first contract
- [ ] document `--source` for SQLite and Excel
- [ ] document output-mode behavior clearly
- [ ] document doctor capability semantics
- [ ] document the dedicated smoke-fixture generator and its reset command
- [ ] run manual smoke checks across built-in and extension-backed formats

## Success Criteria

- users can run SQL queries from the direct CLI against Parquet, CSV/TSV, SQLite, and Excel
- multi-object formats behave deterministically through `--source`
- bounded table output, JSON stdout, and file export stay contract-consistent
- extension-backed failures are actionable instead of opaque
- doctor exposes query capability detail that matches runtime behavior closely enough to trust

## Verification

- `node scripts/generate-data-query-fixtures.mjs reset`
- `bunx tsc --noEmit`
- focused `bun test` query and doctor suites
- manual smoke checks on representative CSV, TSV, Parquet, SQLite, and Excel inputs generated under `examples/playground/data-query/`

## Related Research

- `docs/researches/research-2026-03-09-data-query-scope-and-contract.md`

## Related Plans

- `docs/plans/plan-2026-03-09-duckdb-parquet-preview-integration.md`
- `docs/plans/plan-2026-03-10-data-query-codex-cli-drafting.md`
- `docs/plans/plan-2026-03-10-data-query-interactive-flow-implementation.md`
