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
- supported first-class candidates: Parquet and CSV
- extension-backed near-term candidates: SQLite and Excel
- JSON support: conditional on explicit normalization rules
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

### Recommendation E. Treat output contract as a first-class research topic

Questions to settle:

- whether terminal display remains the default human-facing output
- whether `--output <path>` should write result data in v1
- whether `.json` / `.csv` output is inferred from the output path or selected separately
- whether status/log messaging must be separated from result data, especially in interactive mode
- bounded table by default or full query output by default
- whether an output-format override is needed in v1
- whether result limits are required or inferred
- what large-result safeguards are applied

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

1. Should `data query` v1 support CSV and Parquet only, or also include SQLite and Excel once extension policy is frozen?
2. Should `--sql` be required in every invocation, or is there any non-SQL query mode worth supporting?
3. Should the command support an explicit input-format override, and if so, what flag name should carry that contract?
4. Should output default to a bounded table, machine-readable JSON, or a dual-mode contract?
5. Should `--output <path>` be part of v1, with `.json` / `.csv` chosen by file extension or by a separate output-format flag?
6. Should v1 enforce a result limit by default?
7. Should missing SQLite/Excel extensions fail with guidance only, or should installation ever be allowed from the command path?
8. Should doctor advertise query capability separately from Parquet preview capability, including extension-backed formats?

## Related Plans

- `docs/plans/plan-2026-03-09-duckdb-parquet-preview-integration.md`

## Related Research

- `docs/researches/research-2026-03-02-tabular-data-preview-and-query-scope.md`
