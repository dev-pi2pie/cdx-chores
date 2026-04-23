---
title: "Data stack multi-file assembly direction"
created-date: 2026-04-23
status: draft
agent: codex
---

## Goal

Define the product and CLI design route for a future `data stack` command that assembles one logical table from multiple local files without conflating that work with the current `data query` workspace contract.

## Milestone Goal

Reduce the current discussion into a research-level direction that answers:

- whether multi-file assembly should live under a new `data stack` action rather than expanding `data query` or `data extract`
- how directory-based input with `--input-dir` and `--pattern` should behave
- how headerless delimited inputs should be normalized before stacking
- whether `jsonl` belongs in the first multi-file assembly slice
- how Codex-assisted flows should relate to stacking without making `stack` a new reviewed-artifact owner immediately

## Related Research

- `docs/researches/research-2026-03-31-multi-source-query-workspace-contract.md`
- `docs/researches/research-2026-04-01-schema-aware-query-workspace-direction.md`
- `docs/researches/research-2026-03-31-workspace-file-alias-reservation-reconsideration.md`

## Related Historical Docs

- `docs/researches/archive/research-2026-03-09-data-query-scope-and-contract.md`
- `docs/researches/archive/research-2026-03-20-data-command-surface-headerless-and-codex-boundaries.md`

## Related Plans

- `docs/plans/plan-2026-03-31-data-query-workspace-implementation.md`
- `docs/plans/plan-2026-03-20-data-command-surface-followup-headerless-and-source-shape-replay.md`

Status note:

- this document is research only and does not propose an immediate implementation change
- the current stable contract remains:
  - one input file per `data query` or `data extract` invocation
  - explicit workspace relation binding only for SQLite and DuckDB-file inputs
  - headerless direct flags only where already documented today

## Problem

The repo now has a clear query/workspace story:

- `data query` is the DuckDB-backed SQL lane
- `data extract` materializes one shaped table from one input file
- `data query` workspace mode binds backend objects from one source container through repeatable `--relation`

That still leaves an unowned adjacent problem:

- assembling one logical relation from multiple local files before later SQL or materialization work

Examples raised in current discussion:

- multiple CSV files with the same header
- headerless CSV or TSV files that should be normalized into one shared column contract first
- many `jsonl` files that naturally behave as one stream of row objects
- directory-oriented discovery such as:

```bash
cdx-chores data stack --input-dir ./examples/playground/stack-cases/csv-matching-headers --pattern "*.csv" --output merged.csv
```

The main design risk is conflation.

If this problem is implemented as a looser version of current `data query --relation`, the product would blur:

- workspace relation binding from one source container
- multi-file relation assembly across many files
- materialization vs SQL execution vs source discovery

## Scope

This research covers:

- one future `data stack` action under `data`
- directory and file-list input discovery
- deterministic stacking rules for delimited and `jsonl` inputs
- first-pass headerless handling
- how stacked output should feed later `data query` and `data query codex` flows

This research does not define:

- implementation details for DuckDB file-list SQL generation
- reviewed header-mapping or source-shape artifact changes
- schema-aware workspace redesign
- a new interactive workflow beyond high-level direction
- mixed-format stacking in one invocation

## Key Findings

### 1. Multi-file assembly should be a separate command family from query workspace binding

The current workspace research already distinguishes:

- workspace relation binding from one source container
- future multi-file relation assembly such as file lists, globs, `union_by_name`, and filename provenance

Implication:

- a new action such as `data stack` is a better fit than stretching `data query` past its current one-input contract
- `data stack` can own source discovery and row assembly while `data query` continues to own SQL execution

### 2. `data stack` is a better product fit than expanding `data extract`

`data extract` is currently framed as:

- one shaped logical table
- one input file
- no SQL
- direct materialization

That makes it adjacent to stacking, but still not the same workflow.

Stacking introduces a different primary concern:

- assembling one source from many files before later materialization or query

Implication:

- `data extract` should remain the one-input shaping/materialization lane
- `data stack` can materialize a merged table without taking ownership of Excel shaping, source-shape artifacts, or the rest of the current extract boundary

### 3. Directory-based input should be explicit and tool-owned, not shell-owned

The shell can already expand `./dir/*.csv`, but that is not a stable product contract:

- glob expansion differs across shells
- empty matches can fail awkwardly
- quoted patterns behave differently from unquoted ones
- interactive mode cannot naturally mirror shell expansion semantics

Recommended direction:

- define explicit directory discovery flags such as:
  - `--input-dir <path>`
  - `--pattern <glob>`

Implication:

- the CLI, not the shell, becomes responsible for discovery
- interactive mode can later mirror the same discovery logic directly
- documentation can describe one stable discovery model

### 4. Traversal should be conservative by default

Recursive directory reads create easy accidental scope expansion:

- old exports
- nested archive folders
- prior merged outputs
- unrelated files under deeper subdirectories

Recommended first-pass rules:

- `--input-dir` scans direct children only by default
- recursion is opt-in
- `--max-depth <n>` should exist if recursive mode is supported
- matched files should be sorted deterministically by relative path before stacking
- hidden files should be ignored by default
- if the output path sits inside the scanned directory, it should be excluded automatically

Implication:

- the default command stays predictable
- users can widen scope intentionally instead of by accident

### 5. Headerless stacking should reuse the repo’s deterministic placeholder contract, not invent semantic headers automatically

The current repo already has a user-facing deterministic contract for headerless CSV and TSV:

- explicit `--no-header`
- generated placeholder names such as `column_1`, `column_2`, ...

That is a much safer first-pass story than automatic semantic header generation.

Recommended direction:

- if `--no-header` is present, treat every matched file as headerless
- if `--columns <a,b,c>` is provided, use those names as the authoritative shared schema
- otherwise generate deterministic placeholder names once and apply them across all files
- reject mixed header and headerless inputs in the same invocation unless a future flag deliberately defines that override behavior

Implication:

- headerless stacking stays deterministic
- later reviewed header suggestions can remain a downstream step rather than becoming part of stack-time source interpretation

### 6. `jsonl` is a better first structured-data expansion than generic `.json`

Generic JSON still carries unresolved table-shape questions:

- array of objects
- top-level object
- scalar arrays
- nested structures

`jsonl` is narrower and more aligned with stacking:

- one object row per line
- natural multi-file append semantics
- easier directory-based discovery

Recommended first-pass contract:

- support `jsonl` as one JSON object per line
- reject top-level arrays or scalar lines
- treat missing keys across rows as null-valued columns only if a future union-by-name rule is enabled, or define a strict same-key requirement first
- keep generic `.json` input deferred even if `.json` remains an output encoding for the assembled table
- if `.json` output is supported, define it explicitly as one JSON array of row objects rather than newline-delimited output

Implication:

- `jsonl` can join CSV and TSV earlier than generic JSON because its row model is already stream-oriented

### 7. The first public route should start narrow: exact-shape delimited stacking first, then `jsonl`, then union-style flexibility

The cleanest phase order is:

1. CSV and TSV with matching headers
2. headerless CSV and TSV through `--no-header` and optional `--columns`
3. `jsonl`
4. opt-in union-style column reconciliation such as `union_by_name`

Why:

- exact-match delimited stacking is easiest to explain and test
- headerless support reuses existing repo contracts
- `jsonl` is narrower than generic JSON
- union-style schema reconciliation introduces a second design problem that should stay opt-in at first

Implication:

- the v1 command can be valuable without trying to solve every multi-file data-shape edge case immediately

### 8. Codex should stay downstream of stacking in the first pass

The current repo already has Codex-assisted data workflows, but they are attached to:

- reviewed header suggestions
- reviewed source-shape suggestions
- SQL drafting through `data query codex`

Stacking does not need a new Codex-assisted ownership boundary immediately.

Recommended direction:

- do not introduce `--codex-suggest-stack` in the first research route
- prefer:
  - `data stack ... --output merged.csv`
  - `data query merged.csv --sql "..."`
  - `data query codex merged.csv --intent "..."`

Possible later Codex use:

- explain header mismatch failures
- suggest a reviewed header mapping after a placeholder-based merge
- summarize schema drift before a user chooses a union-style mode

Implication:

- `data stack` can stay deterministic first
- Codex remains additive where the repo already has established review/drafting patterns

## Recommended Design Route

### Phase 1: Directory-first stacking for CSV and TSV

Recommended primary command shape:

```bash
cdx-chores data stack --input-dir ./examples/playground/stack-cases/csv-matching-headers --pattern "*.csv" --output merged.csv
```

Recommended first-pass flags:

- `--input-dir <path>`
- `--pattern <glob>`
- `--output <path>`
- `--overwrite`
- `--input-format <csv|tsv>` when needed
- `--recursive` and `--max-depth <n>` only if recursion lands in the same slice

Recommended first-pass behavior:

- directory-first discovery only in the first public slice
- same-format files only
- matching header row required
- deterministic file order
- no SQL in this lane

### Phase 2: Headerless delimited stacking

Recommended additive flags:

- `--no-header`
- `--columns <name,name,...>`

Recommended behavior:

- all matched files are interpreted the same way
- if `--columns` is omitted, generate `column_<n>` placeholders
- reject varying column counts

### Phase 3: `jsonl`

Recommended scope:

- one object per line
- one logical row per line
- row-key reconciliation rules documented explicitly

Recommended first-pass constraint:

- keep generic `.json` deferred even if `jsonl` lands

### Phase 4: Optional schema-flex modes

Future candidates:

- `--union-by-name`
- source provenance columns such as `--add-source-column <name>`
- explicit row-origin file metadata

Recommended stance:

- treat these as separate follow-up decisions, not baseline v1 behavior

## Draft Command-Surface Direction

Recommended primary contract:

```bash
cdx-chores data stack --input-dir <path> --pattern "<glob>" --output <path>
```

Likely phase-1 companion forms:

```bash
cdx-chores data stack --input-dir <path> --pattern "*.tsv" --output merged.tsv
```

Likely phase-2 companion form:

```bash
cdx-chores data stack --input-dir <path> --pattern "*.csv" --no-header --columns id,name,status --output merged.csv
```

Likely later-slice companion form:

```bash
cdx-chores data stack --input-dir <path> --pattern "*.jsonl" --input-format jsonl --output merged.json
```

Recommended output rule:

- `data stack` materializes one assembled table to an explicitly supported output format
- if `.json` output is supported, it should mean one JSON array of row objects
- later SQL remains the job of `data query`

## Open Questions

- Should recursive discovery use one flag (`--max-depth`) or two (`--recursive` plus `--max-depth`)?
- For `jsonl`, should first-pass row-key mismatch be strict failure or opt-in union behavior?
- Should `.jsonl` input land in the same implementation slice as directory-first CSV and TSV stacking, or in the next slice after that?
- Should the first output set remain `.csv`, `.tsv`, and optional array-style `.json`, or should Parquet output be part of the first stacking milestone too?
- If a later interactive flow lands, should it begin with directory discovery only, or also support mixed direct-file selection?

## Recommendation

Use a new `data stack` action as the owned surface for multi-file assembly.

Keep the first implementation narrow:

- directory-first discovery through `--input-dir` plus `--pattern`
- shallow traversal by default
- CSV and TSV first, with direct file-list mode deferred
- deterministic headerless support through `--no-header` and optional `--columns`
- `jsonl` as the next structured-data expansion, with explicit output encoding if it lands
- no new Codex-owned stacking flow in the first slice

Then keep the downstream flow explicit:

1. assemble a clean merged file with `data stack`
2. run SQL with `data query` if needed
3. use `data query codex` on the merged output if natural-language drafting helps
