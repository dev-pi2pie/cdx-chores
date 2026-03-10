---
title: "Data query scope and contract"
created-date: 2026-03-09
modified-date: 2026-03-10
status: draft
agent: codex
---

## Goal

Define the product and implementation contract for a future `data query` command before any CLI, interactive, or DuckDB-backed query surface is added.

## Milestone Goal

Reduce `data query` from a broad idea into an implementation-ready contract that:

- stays separate from lightweight `data preview`
- stays separate from the first DuckDB-backed `data parquet preview` milestone
- is explicit about SQL, file-shape, input-detection, output, and error semantics
- is narrow enough to support a follow-up implementation plan without reopening core product questions

## Key Findings

### 1. `data query` is materially larger than Parquet preview

`data parquet preview` can stay bounded and read-only while reusing a preview-style renderer.

`data query` is broader because it introduces:

- SQL as a user-facing contract
- file-to-table naming rules
- format-specific shape normalization for query mode
- query result rendering/output questions
- a different error model from lightweight preview

Implication:

- `data query` needs its own research and implementation plan

### 2. The first v1 question is command shape, not DuckDB capability

DuckDB can query CSV, JSON, and Parquet, but that does not answer the actual product questions:

- what the command syntax is
- which input formats are supported in v1
- whether v1 is single-file only
- whether SQL is always required
- what output shape users receive by default

Implication:

- CLI contract decisions should come before backend wiring

### 3. Single-file query scope is the safest first boundary

A conservative first query milestone should likely support:

- one input file per invocation
- one logical table name, such as `file`
- explicit SQL through a required `--sql` flag

This avoids immediately expanding into:

- multi-file joins
- attachment aliases
- directory scans
- remote sources

Implication:

- keep the first research boundary intentionally narrow

### 4. File-shape rules need explicit v1 decisions

CSV is straightforward if headers define columns.

Parquet is the strongest first-class fit because schema and types already exist.

JSON is less obvious because query mode must decide what counts as a table:

- array of objects
- top-level object as one row
- scalar array
- scalar top-level JSON
- nested objects and arrays

Implication:

- JSON support should not be assumed until the query-mode normalization contract is frozen

### 5. Output semantics are a separate product decision

`data preview` has a bounded terminal-table contract already.

`data query` still needs choices for:

- default output format
- whether terminal rendering and file-output writing are separate user-facing concepts
- whether `--output <path>` is part of the baseline contract
- how output file format is inferred or overridden
- whether results are bounded by default
- whether machine-readable output lands in v1
- how large result sets are truncated or paged
- whether schema/type information is surfaced

Implication:

- query output should be designed explicitly rather than inherited implicitly from preview

### 6. Input detection and backend capability should be separate decisions

The query action should first determine what the input is, then determine what DuckDB capability is required to read it.

A conservative first-pass contract should likely:

- accept an explicit input-format override when needed
- otherwise detect format from a narrow, extension-based mapping
- fail closed on ambiguous or unknown inputs instead of broad file sniffing
- keep `.db` out of automatic SQLite detection in v1 because it is too ambiguous

Useful first-pass detection candidates:

- `.parquet` -> Parquet
- `.csv` / `.tsv` -> delimited text
- `.sqlite` / `.sqlite3` -> SQLite
- `.xlsx` -> Excel workbook

Implication:

- input validation errors should stay distinct from DuckDB runtime or extension errors

### 7. DuckDB extension loading should be explicit, while installation policy should stay conservative

DuckDB Neo can use DuckDB extensions through normal SQL execution, but that still leaves a CLI product decision around when extension installation is allowed.

The safest first-pass contract is:

- built-in formats such as Parquet and CSV do not require explicit extension activation
- extension-backed formats such as SQLite and Excel should use explicit extension loading
- missing extensions should fail with actionable guidance instead of silently installing by default

Why:

- silent installation introduces hidden network access
- silent installation introduces hidden writes to the DuckDB extension cache
- sandboxed or offline environments may permit query execution but not extension installation

Implication:

- the CLI should separate `input supported`, `extension required`, `extension load failed`, and `extension install unavailable` as different failure classes

### 8. Interactive mode should stay out until SQL-entry UX is real

Unlike preview prompts, query mode needs an actual SQL input workflow.

Possible options include:

- a single inline prompt for `--sql`
- an editor-backed SQL entry flow
- loading a saved query
- choosing whether results stay in the terminal or are written to a file

Implication:

- interactive query mode should remain out of scope until a specific SQL-entry UX is selected

## Decision Updates

### Draft decision 1. v1 should include CSV, Parquet, SQLite, and Excel

The current draft should no longer frame SQLite and Excel as optional expansion beyond the first useful query milestone.

Recommended draft contract:

- built-in first-class inputs: CSV and Parquet
- extension-backed first-class inputs: SQLite and Excel
- JSON remains deferred until query-shape normalization is explicit

Why:

- SQLite and Excel are strong practical formats for local CLI workflows
- both are materially narrower than heavier remote-database targets such as PostgreSQL or MySQL
- extension-backed support still fits the single-input, single-table-first boundary if activation behavior is explicit

### Draft decision 2. v1 should require `--sql`, and non-SQL query modes should stay out

Recommended draft contract:

- every invocation requires explicit SQL in v1
- non-SQL query helpers should stay out of the first implementation plan

Potential non-SQL query modes would mean opinionated shortcuts such as:

- `data query sales.csv --select "region,total" --where "total > 1000"`
- `data query users.parquet --count`
- `data query metrics.xlsx --group-by team --sum hours`
- `data query app.sqlite --schema`

These are all effectively alternate mini-languages layered on top of SQL.

Why defer them:

- they expand the product surface without adding new backend capability
- they create a second query grammar that users must learn
- they reopen design questions around quoting, expressions, aggregates, aliases, ordering, and function support

Implication:

- v1 should stay on one clear contract: `data query <input> --sql "<query>"`

### Draft decision 3. Support explicit input-format override with `--input-format`

Recommended draft contract:

- detect input format automatically by default
- allow users to override detection with `--input-format <format>`

Why:

- `--format` is too easily confused with output formatting
- `--input-format` is explicit about which contract it affects

### Draft decision 4. Default output should be a bounded terminal table, with opt-in JSON output

Recommended draft contract:

- default terminal behavior renders a bounded table
- `--json` emits machine-readable JSON to stdout instead of the table
- `--pretty` only affects machine-readable JSON rendering when `--json` is selected

Implication:

- the command should separate human-facing terminal rendering from data-export behavior

### Draft decision 5. `--output <path>` should be part of v1, with format inferred from the output path

Recommended draft contract:

- `--output <path>` writes result data to a file in v1
- `.json` and `.csv` are chosen from the output-path extension
- unsupported output extensions should fail clearly

Implication:

- logs and status messaging must stay separate from the file payload and should continue going to stderr or other non-payload channels when needed

### Draft decision 6. Do not add a hidden SQL result limit by default

The result-limit question should be separated into three different concerns:

- SQL execution size
- terminal display size
- file/stdout serialization size

Recommended draft contract:

- do not rewrite the user query with an implicit SQL `LIMIT`
- keep default terminal table rendering bounded
- when writing to `--output`, serialize the full query result unless the user query itself limits rows
- when using `--json` to stdout, prefer full query semantics over a hidden row cap, while keeping large-output safeguards as an implementation concern

Implication:

- v1 should bound presentation by default, not silently change query semantics

### Draft decision 7. Missing SQLite or Excel extensions should fail with guidance in v1

Recommended draft contract:

- explicit extension loading is allowed
- automatic extension installation from the command path is not part of v1
- missing or unloadable extensions should fail with targeted guidance

Guidance should cover:

- which extension was required
- whether the problem was missing install, blocked download, blocked cache directory, or load failure
- what the user can do next

### Draft decision 8. Doctor should advertise query capability by format, including extension-backed formats

Recommended draft contract:

- doctor should not collapse DuckDB capability into one generic yes/no signal
- doctor should advertise built-in query-capable formats separately from extension-backed formats

Implication:

- the capability model should be format-aware enough to explain why Parquet may work while SQLite or Excel may still be unavailable

## Implications or Recommendations

### Recommendation A. Keep `data query` doc-only until this research is completed

Recommended near-term rule:

- do not add a `data query` CLI stub
- do not add `data query` to help text
- do not add `data query` to interactive mode

Why:

- a visible stub creates user-facing debt before the contract is settled
- the current DuckDB Parquet preview track is already a complete first milestone without query mode

### Recommendation B. Use a conservative draft contract as the research baseline

Best current starting point:

- command: `data query <input> --sql "<query>"`
- input scope: one file per invocation
- logical table name: `file`
- supported built-in first-class inputs: Parquet and CSV
- supported extension-backed first-class inputs: SQLite and Excel
- input-format override flag: `--input-format`
- JSON support: conditional on explicit normalization rules
- default stdout rendering: bounded table
- machine-readable stdout mode: `--json` with optional `--pretty`
- file output: `--output <path>` with `.json` / `.csv` inferred from the output path
- interactive mode: deferred

This is a baseline for evaluation, not a final implementation decision.

### Recommendation C. Split input detection from backend capability resolution

Recommended near-term rule:

- detect input format from an explicit override or a conservative extension map
- reject unknown or ambiguous formats instead of broad auto-sniffing
- treat `readable by DuckDB without extra loading` and `requires DuckDB extension capability` as separate decisions

This keeps format selection, extension policy, and error reporting from collapsing into one opaque runtime step.

### Recommendation D. Keep DuckDB extension loading explicit and missing-extension install non-default

Recommended near-term rule:

- allow SQLite and Excel support only through explicit extension-aware handling
- prefer explicit `LOAD` behavior in app-controlled SQL paths
- if the extension is unavailable, return a targeted error instead of silently attempting networked installation

This preserves predictable CLI behavior across local, CI, offline, and sandboxed environments.

### Recommendation E. Treat output safeguards as a first-class implementation-plan topic

The high-level output contract is now narrow enough to draft:

- bounded table by default for terminal display
- `--json` for machine-readable stdout
- `--output <path>` for file export
- `.json` / `.csv` inferred from the output-path extension

The remaining work is to define operational safeguards such as:

- default terminal row-count boundary
- large-stdout protection rules
- CSV serialization details
- whether schema/type metadata is exportable separately

### Recommendation F. Create a dedicated implementation plan only after the contract is frozen

That follow-up plan should only start once the research resolves:

- command syntax
- supported input formats
- input-detection rules and override behavior
- table naming
- extension loading and installation policy
- JSON normalization rules
- output format behavior
- output file behavior and log/result channel separation
- error handling model
- doctor/help/interactive exposure

## Open Questions

1. What should the default terminal row-count boundary be for bounded table rendering?
2. Should `--json` to stdout ever require an explicit large-output acknowledgement, or should it stream full results by default?
3. What exact capability fields should doctor expose for extension-backed formats: detected support, loadability, installability, or all three?

## Related Plans

- `docs/plans/plan-2026-03-09-duckdb-parquet-preview-integration.md`

## Related Research

- `docs/researches/research-2026-03-02-tabular-data-preview-and-query-scope.md`
