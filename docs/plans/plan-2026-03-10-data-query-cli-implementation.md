---
title: "Data query CLI implementation"
created-date: 2026-03-10
modified-date: 2026-03-10
status: completed
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
- an initial `data query` CLI command now exists for SQL-first direct querying
- the direct CLI path now supports CSV/TSV and Parquet end to end, with guidance-first extension handling for SQLite and Excel
- doctor now exposes query capability by format
- dedicated deterministic smoke fixtures now exist for playground and test coverage
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
- `--json` and `--output <path>` are mutually exclusive
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
- reject `--json` together with `--output <path>`

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

- [x] add `scripts/generate-data-query-fixtures.mjs`
- [x] support `seed`, `clean`, and `reset`
- [x] generate deterministic smoke fixtures under `examples/playground/data-query/`
- [x] cover representative CSV, TSV, Parquet, SQLite, and Excel inputs
- [x] include multi-object SQLite and Excel fixtures for `--source` coverage
- [x] keep smoke generation independent from preview fixture generators

### Phase 1: Freeze CLI command and validation contract

- [x] add `data query <input> --sql "<query>"` to the CLI surface
- [x] add `--input-format <format>`
- [x] add `--source <name>`
- [x] add `--rows <n>`
- [x] add `--json`
- [x] add `--pretty`
- [x] add `--output <path>`
- [x] define validation behavior for incompatible flag combinations
- [x] define validation behavior for missing `--source` on multi-object formats
- [x] define validation behavior for unsupported output extensions
- [x] define validation behavior for `--pretty` without a JSON payload target
- [x] reject `--json` together with `--output <path>`

### Phase 2: Input detection and source binding

- [x] implement extension-based input detection
- [x] implement `--input-format` override behavior
- [x] add source-object selection logic for SQLite and Excel
- [x] bind the chosen source object to logical table `file`
- [x] keep direct CLI deterministic when source selection is ambiguous

### Phase 3: DuckDB query adapter layer

- [x] implement direct query setup for Parquet
- [x] implement direct query setup for CSV/TSV
- [x] implement direct query setup for SQLite with explicit extension loading
- [x] implement direct query setup for Excel with explicit extension loading
- [x] surface targeted runtime failures for extension-backed formats

### Phase 4: Output rendering and serialization

- [x] render bounded table output with the 20-row default
- [x] honor `--rows` without changing SQL semantics
- [x] implement JSON stdout serialization for `--json`
- [x] implement `--pretty` JSON formatting behavior
- [x] implement file output for `.json`
- [x] implement file output for `.csv`
- [x] keep stdout payloads and status/log output separated

### Phase 5: Doctor support

- [x] add format-aware query capability reporting
- [x] expose built-in format support separately from extension-backed format support
- [x] expose detected support, loadability, and installability for extension-backed formats
- [x] define doctor behavior when the environment blocks install checks

### Phase 6: Tests

- [x] add direct CLI coverage for each supported input family
- [x] add coverage for `--input-format`
- [x] add coverage for `--source`
- [x] add coverage for missing-source validation
- [x] add coverage for no implicit default source selection on multi-object formats
- [x] add coverage for bounded table output with default and explicit `--rows`
- [x] add coverage for `--json`
- [x] add coverage for `--pretty`
- [x] add coverage for `--output` with `.json`
- [x] add coverage for `--output` with `.csv`
- [x] add coverage for `--output` suppressing stdout result payloads
- [x] add coverage for invalid `--pretty` usage without a JSON payload target
- [x] add coverage for conflicting output-mode flag combinations
- [x] add coverage for unsupported output extensions
- [x] add coverage for extension load failure and install-unavailable guidance
- [x] add doctor coverage for detected support, loadability, and installability
- [x] confirm the smoke-fixture generator produces stable representative inputs for manual verification

### Phase 7: Docs and verification

- [x] add a dedicated `data query` CLI usage guide
- [x] document the SQL-first contract
- [x] document `--source` for SQLite and Excel
- [x] document output-mode behavior clearly
- [x] document doctor capability semantics
- [x] document the dedicated smoke-fixture generator and its reset command
- [x] run manual smoke checks across built-in and extension-backed formats

## Success Criteria

- users can run SQL queries from the direct CLI against Parquet, CSV/TSV, SQLite, and Excel
- multi-object formats behave deterministically through `--source`
- bounded table output, JSON stdout, and file export stay contract-consistent
- extension-backed failures are actionable instead of opaque
- doctor exposes query capability detail that matches runtime behavior closely enough to trust

## Verification

- `node scripts/generate-data-query-fixtures.mjs reset`
- `node scripts/generate-data-query-fixtures.mjs reset --output-dir test/fixtures/data-query`
- `bunx tsc --noEmit`
- `bun test test/cli-actions-data-query.test.ts test/cli-command-data-query.test.ts test/data-query-fixture-generator.test.ts test/cli-actions-doctor-markdown-video-deferred.test.ts test/cli-ux.test.ts`
- manual smoke checks on representative CSV, TSV, Parquet, SQLite, and Excel inputs generated under `examples/playground/data-query/`

## Related Research

- `docs/researches/research-2026-03-09-data-query-scope-and-contract.md`

## Related Plans

- `docs/plans/plan-2026-03-09-duckdb-parquet-preview-integration.md`
- `docs/plans/plan-2026-03-10-data-query-codex-cli-drafting.md`
- `docs/plans/plan-2026-03-10-data-query-interactive-flow-implementation.md`
