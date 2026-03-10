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
- one selected source object per invocation when the format exposes multiple logical objects
- explicit SQL through a required `--sql` flag

This avoids immediately expanding into:

- multi-file joins
- attachment aliases
- directory scans
- remote sources

Implication:

- keep the first research boundary intentionally narrow

### 3A. Multi-object formats need an explicit source-selection contract

SQLite databases and Excel workbooks do not naturally behave like a single-table file.

Recommended draft contract:

- direct CLI query should support `--source <name>` for formats that expose multiple logical source objects
- the selected source object should be bound to the logical table name `file`
- interactive query should choose the source object during introspection before SQL authoring
- direct CLI should fail clearly when `--source` is required but missing

Implication:

- SQLite and Excel can fit the single-file boundary without requiring multi-table SQL attachment semantics in the first implementation

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

### 8. Interactive query needs a fixed contract even if implementation remains deferred

Unlike preview prompts, query mode needs an actual SQL input workflow.

The contract should now be fixed as a mode selector rather than one undifferentiated SQL prompt.

Preferred interactive mode choices:

- `manual`
- `formal-guide`
- `Codex Assistant`

Intended meanings:

- `manual`: the user writes SQL directly
- `formal-guide`: the CLI gathers structured query intent through guided prompts and builds SQL from those answers
- `Codex Assistant`: the user describes intent in natural language and Codex proposes SQL for review

Expected common flow:

- choose input
- detect input format or accept an explicit override
- perform lightweight read-only introspection
- choose source object when required
- choose mode
- gather or generate candidate SQL
- show the final SQL back to the user
- require explicit confirmation before execution
- choose whether results stay in the terminal or are written to a file

Implication:

- interactive query should be designed now as a `choose mode` workflow rather than a raw SQL-only prompt
- implementation can remain deferred until a dedicated plan picks up that contract

### 9. Interactive query should be introspection-first

Interactive query authoring should not start from a blank prompt.

Before SQL is written, guided, or generated, the CLI should gather a lightweight read-only metadata bundle for the selected input.

Recommended first-pass interactive introspection payload:

- detected input format
- logical source name
- available source objects when relevant
- selected source object
- column names
- inferred column types
- a small bounded sample window

Format-specific notes:

- CSV / Parquet: introspect the single logical table directly
- SQLite: introspect available tables or views before query authoring
- Excel: introspect available sheets before query authoring

Why:

- `manual` mode benefits from visible schema and sample context
- `formal-guide` mode needs a stable source object and field inventory
- `Codex Assistant` produces better SQL when grounded in actual columns, types, and samples

Implication:

- interactive query should include a schema-and-sample discovery step before mode-driven SQL authoring
- this introspection step should stay read-only and separate from executing the final user query

## Decision Updates

### Draft decision 1. v1 should include CSV, Parquet, SQLite, and Excel

The current draft should no longer frame SQLite and Excel as optional expansion beyond the first useful query milestone.

Recommended draft contract:

- built-in first-class inputs: Parquet plus CSV-family delimited text (`.csv`, `.tsv`)
- extension-backed first-class inputs: SQLite and Excel
- JSON remains deferred until query-shape normalization is explicit

Why:

- SQLite and Excel are strong practical formats for local CLI workflows
- both are materially narrower than heavier remote-database targets such as PostgreSQL or MySQL
- extension-backed support still fits the single-input, single-table-first boundary if activation behavior is explicit

### Draft decision 2. v1 should require `--sql`, while non-SQL query modes remain a planned follow-up feature

Recommended draft contract:

- every invocation requires explicit SQL in v1
- non-SQL query helpers should stay out of the first implementation plan
- non-SQL query helpers should remain explicitly visible in research as a later feature track that deserves its own plan and usage guide

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
- a later follow-up plan can define which non-SQL helpers are worth adding without weakening the first SQL-based contract
- that later plan can align non-SQL helpers with the interactive `formal-guide` mode so both surfaces share the same structured-query contract

### Draft decision 2F. CLI Codex assistance should be a separate command lane

Recommended draft contract:

- base execution stays under `data query <input> --sql "<query>"`
- Codex-assisted SQL drafting should live under `data query codex <input> --intent "..."`
- `data query codex` should be introspection-first rather than draft-from-blind-intent
- `data query codex` should not silently execute generated SQL by default

Default `data query codex` output should be human-readable assistant output containing:

- detected format
- selected source
- brief schema/sample summary
- generated SQL

Additional flag contract:

- `--print-sql` prints SQL only
- a later `--execute` flag may exist as an explicit second guardrail
- `--execute`, if ever added, should remain a later follow-up rather than part of the first Codex drafting contract

Why:

- this keeps query execution and query authoring assistance as separate user-facing surfaces
- this keeps the base CLI path deterministic and scriptable
- this gives Codex-assisted drafting room to evolve without destabilizing the execution command
- this preserves introspection as a first-class prerequisite for assisted SQL generation

### Draft decision 2A. Interactive query should use `choose mode`

Recommended contract:

- interactive `data query` should begin with lightweight input introspection
- interactive `data query` should open with a `choose mode` step
- first-pass mode names should be `manual`, `formal-guide`, and `Codex Assistant`
- all modes should converge on an explicit SQL review-and-confirm step before execution

Why:

- introspection gives all three modes the schema context they need
- `manual` preserves direct control for users who already know SQL
- `formal-guide` gives a lower-typo structured path without requiring a full SQL editor
- `Codex Assistant` can help infer intent, but should remain advisory rather than implicitly authoritative

Implication:

- interactive query should be planned as an introspection-first guided multi-step workflow, not a single freeform prompt

### Draft decision 2B. Freeze the interactive query flow now

Recommended interactive contract:

1. Prompt for input path.
2. Detect format, with optional override if detection is missing or ambiguous.
3. Load required DuckDB extension capability for introspection when needed.
4. Gather a bounded introspection payload.
5. If the format exposes multiple logical objects, prompt for source selection.
6. Prompt `choose mode`: `manual`, `formal-guide`, or `Codex Assistant`.
7. Produce candidate SQL from that mode.
8. Show final SQL back to the user.
9. Require explicit confirmation before execution.
10. Prompt for output mode and output-specific options.

Output-specific prompt rules:

- table mode: ask `Rows to show (optional)` and reuse the `--rows` contract
- JSON stdout mode: ask whether to pretty-print
- file-output mode: ask for output path, infer `.json` or `.csv`, ask whether to pretty-print when the output path is `.json`, and ask for overwrite confirmation when needed

`manual` mode SQL-entry rule:

- the first implementation should use a single-line SQL prompt
- editor-backed or multiline SQL entry should remain a later follow-up rather than part of the first interactive implementation

### Draft decision 2C. Freeze the minimum `formal-guide` prompt set now

Recommended minimum `formal-guide` prompt set:

- selected source object
- columns to select, or `all columns`
- zero or more filters using simple column/operator/value rules
- optional grouping and aggregate summary intent
- optional ordering
- optional output mode choice

Why this boundary:

- it is enough to cover common exploratory queries
- it avoids pretending to support arbitrary SQL through an underpowered form
- it still leaves advanced joins, expressions, and complex subqueries to `manual` or `Codex Assistant`

### Draft decision 2D. Freeze the bounded introspection payload now

Recommended default introspection payload:

- schema plus a small sample window

Practical contents:

- detected format
- selected source object
- column names
- inferred column types
- up to a small fixed number of sample rows

Why:

- schema alone is often insufficient for naming intent, filter drafting, or AI-assisted SQL generation
- a bounded sample is enough to guide users without turning introspection into full query execution

### Draft decision 2E. Freeze the `Codex Assistant` guardrails now

Recommended `Codex Assistant` contract:

- it receives the user’s intent plus the bounded introspection payload
- it drafts SQL but does not execute automatically
- the generated SQL must be shown back to the user
- execution requires explicit user confirmation
- SQL errors should return the user to revise or regenerate rather than silently retrying

Why:

- this keeps Codex in an advisory role
- this reduces the risk of hidden intent drift between user request and executed SQL
- the same advisory-only guardrails should also apply to any later `data query codex` CLI lane

### Draft decision 3. Support explicit input-format override with `--input-format`

Recommended draft contract:

- detect input format automatically by default
- allow users to override detection with `--input-format <format>`

Why:

- `--format` is too easily confused with output formatting
- `--input-format` is explicit about which contract it affects

### Draft decision 3A. Support explicit source-object override with `--source`

Recommended draft contract:

- formats with multiple logical source objects should accept `--source <name>`
- the selected object should be exposed in SQL as the logical table `file`
- formats with one implicit source object should not require `--source`

Why:

- it gives direct CLI a deterministic contract for SQLite tables/views and Excel sheets
- it preserves the single-logical-table query contract without introducing attachment aliases in v1

### Draft decision 4. Default output should be a bounded terminal table, with opt-in JSON output

Recommended draft contract:

- default terminal behavior renders a bounded table
- `--json` emits machine-readable JSON to stdout instead of the table
- `--pretty` only affects machine-readable JSON rendering

Implication:

- the command should separate human-facing terminal rendering from data-export behavior

### Draft decision 4A. Default bounded table rendering should use a fixed 20-row default

Recommended draft contract:

- default bounded table rendering should show 20 rows
- `--rows` should remain the explicit override for a different display bound
- the default should not adapt to terminal height
- pagination should stay out of the baseline contract
- pagination should be treated as out of scope for the current research and implementation contract

Why:

- a fixed default matches the current preview precedent
- a fixed default is easier to document and test
- adaptive height-based defaults create inconsistent behavior across TTY and non-TTY environments
- pagination is a separate interaction model rather than a small variation on bounded rendering
- deferring pagination keeps the first implementation focused on stateless bounded rendering

### Draft decision 4B. `--json` should stream full results to stdout by default

Recommended draft contract:

- `--json` should stream full query results to stdout by default
- no extra acknowledgement should be required just because the result is large
- large-output safeguards, if added later, should be designed carefully so they do not silently change result semantics

### Draft decision 4C. `--pretty` should apply to JSON serialization only

Recommended draft contract:

- `--pretty` should be valid only when the result payload is JSON
- `--pretty` should apply to both `--json` stdout output and `.json` file output through `--output <path>`
- `--pretty` should not apply to bounded table rendering
- `--pretty` should not apply to `.csv` file output

Why:

- the flag describes JSON serialization shape rather than terminal presentation
- allowing it for JSON file output keeps the JSON contract consistent across stdout and file targets
- rejecting it for table and CSV output keeps the flag surface explicit and testable

### Draft decision 4D. `--json` and `--output` should be mutually exclusive

Recommended draft contract:

- `--json` selects JSON result payload on stdout
- `--output <path>` selects file-result payload delivery
- `--json` and `--output` should not be accepted together in v1

Why:

- both flags try to control the same result-payload lane
- `--output <path>` already chooses serialization format from the target extension
- rejecting the combination avoids ambiguous dual-output behavior and keeps shell/file workflows predictable

### Draft decision 5. `--output <path>` should be part of v1, with format inferred from the output path

Recommended draft contract:

- `--output <path>` writes result data to a file in v1
- `.json` and `.csv` are chosen from the output-path extension
- unsupported output extensions should fail clearly
- `--output <path>` is mutually exclusive with `--json`

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
- reuse `--rows` as the renderer-facing row-bound flag for query-mode table display
- implement bounded table rendering as an application display concern rather than a DuckDB- or OS-derived hard limit
- table rendering should be able to read `display_limit + 1` rows so it can report truncation without promising a full total-row count
- when writing to `--output`, serialize the full query result unless the user query itself limits rows
- when using `--json` to stdout, prefer full query semantics over a hidden row cap, while keeping large-output safeguards as an implementation concern

Implication:

- v1 should bound presentation by default, not silently change query semantics
- reserving `--limit` outside the SQL-first contract leaves room for later non-SQL helper semantics without overloading the table-display flag

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

### Draft decision 8A. Doctor should expose detected support, loadability, and installability

Recommended draft contract for extension-backed formats:

- `detected support`: whether the format is part of the declared capability surface
- `loadability`: whether the required DuckDB extension can currently be loaded
- `installability`: whether the environment appears able to install the missing extension if needed

Why:

- these are different failure and support states
- collapsing them into one value hides the actual remediation path
- the user needs to know the difference between `supported in principle`, `ready now`, and `blocked by environment`

### Draft decision 8B. Doctor should expose Codex drafting availability separately

Recommended draft contract:

- doctor should expose `data query codex` availability separately from DuckDB format capability
- Codex drafting capability should include:
  - configured support
  - authentication or session availability
  - ready-to-draft availability for the current environment

Why:

- `data query codex` is a separate command lane with a different failure surface from direct DuckDB query execution
- users need a predictable preflight signal before relying on natural-language SQL drafting
- separating Codex drafting availability keeps DuckDB capability checks from implying that Codex assistance is also ready

## Implications or Recommendations

### Recommendation A. Keep `data query` doc-only until this research is completed

Recommended near-term rule:

- do not add a `data query` CLI stub
- do not add `data query` to help text
- do not add interactive `data query` implementation until a dedicated plan picks up the now-fixed contract

Why:

- a visible stub creates user-facing debt before the contract is settled
- the current DuckDB Parquet preview track is already a complete first milestone without query mode

### Recommendation B. Use a conservative draft contract as the research baseline

Best current starting point:

- command: `data query <input> --sql "<query>"`
- input scope: one file per invocation
- logical table name: `file`
- supported built-in first-class inputs: Parquet and CSV-family delimited text (`.csv`, `.tsv`)
- supported extension-backed first-class inputs: SQLite and Excel
- input-format override flag: `--input-format`
- source-object override flag for multi-object formats: `--source`
- bounded table-display flag: `--rows`
- JSON support: conditional on explicit normalization rules
- default stdout rendering: bounded table
- machine-readable stdout mode: `--json` with optional `--pretty`
- file output: `--output <path>` with `.json` / `.csv` inferred from the output path
- `--json` and `--output <path>` are mutually exclusive
- interactive mode: implementation deferred, design contract fixed

This is a baseline for evaluation, not a final implementation decision.

Separate future authoring lane:

- command: `data query codex <input> --intent "..."`
- default output: human-readable assistant summary plus generated SQL
- SQL-only mode: `--print-sql`
- default output channel: stdout
- SQL-only output channel: stdout
- diagnostics and failures: stderr
- possible later explicit execution guardrail: `--execute`

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

- large-stdout protection rules
- CSV serialization details
- whether schema/type metadata is exportable separately

### Recommendation F. Create the dedicated implementation plan now that the contract is frozen

That follow-up plan should implement the now-fixed contract across:

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
- interactive query implementation sequence and verification strategy
- later `data query codex` authoring-lane design and rollout sequencing

## Open Questions

No remaining contract-level open questions.

## Related Plans

- `docs/plans/plan-2026-03-09-duckdb-parquet-preview-integration.md`
- `docs/plans/plan-2026-03-10-data-query-cli-implementation.md`
- `docs/plans/plan-2026-03-10-data-query-codex-cli-drafting.md`
- `docs/plans/plan-2026-03-10-data-query-interactive-flow-implementation.md`

## Related Research

- `docs/researches/research-2026-03-02-tabular-data-preview-and-query-scope.md`
