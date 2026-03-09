---
title: "Data query scope and contract"
created-date: 2026-03-09
status: draft
agent: codex
---

## Goal

Define the product and implementation contract for a future `data query` command before any CLI, interactive, or DuckDB-backed query surface is added.

## Milestone Goal

Reduce `data query` from a broad idea into an implementation-ready contract that:

- stays separate from lightweight `data preview`
- stays separate from the first DuckDB-backed `data parquet preview` milestone
- is explicit about SQL, file-shape, output, and error semantics
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
- whether results are bounded by default
- whether machine-readable output lands in v1
- how large result sets are truncated or paged
- whether schema/type information is surfaced

Implication:

- query output should be designed explicitly rather than inherited implicitly from preview

### 6. Interactive mode should stay out until SQL-entry UX is real

Unlike preview prompts, query mode needs an actual SQL input workflow.

Possible options include:

- a single inline prompt for `--sql`
- an editor-backed SQL entry flow
- loading a saved query

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
- JSON support: conditional on explicit normalization rules
- interactive mode: deferred

This is a baseline for evaluation, not a final implementation decision.

### Recommendation C. Treat output contract as a first-class research topic

Questions to settle:

- bounded table by default or full query output by default
- whether `--format json` is needed in v1
- whether result limits are required or inferred
- what large-result safeguards are applied

### Recommendation D. Create a dedicated implementation plan only after the contract is frozen

That follow-up plan should only start once the research resolves:

- command syntax
- supported input formats
- table naming
- JSON normalization rules
- output format behavior
- error handling model
- doctor/help/interactive exposure

## Open Questions

1. Should `data query` v1 support CSV and Parquet only, or include JSON from the start?
2. Should `--sql` be required in every invocation, or is there any non-SQL query mode worth supporting?
3. Should output default to a bounded table, machine-readable JSON, or a dual-mode contract?
4. Should v1 enforce a result limit by default?
5. Should doctor advertise query capability separately from Parquet preview capability?

## Related Plans

- `docs/plans/plan-2026-03-09-duckdb-parquet-preview-integration.md`

## Related Research

- `docs/researches/research-2026-03-02-tabular-data-preview-and-query-scope.md`
