---
title: "Data stack multi-file assembly direction"
created-date: 2026-04-23
modified-date: 2026-04-24
status: in-progress
agent: codex
---

## Goal

Define the product and CLI design route for a future `data stack` command that assembles one logical table from multiple local sources without conflating that work with the current `data query` workspace contract.

## Milestone Goal

Reduce the current discussion into a research-level direction that answers:

- whether multi-file assembly should live under a new `data stack` action rather than expanding `data query` or `data extract`
- how mixed raw inputs should work when one invocation accepts files, directories, or both together
- how a stack-specific input router should normalize those raw inputs into one file list
- how a first-pass interactive `data stack` flow should work once the direct CLI contract is stable
- how headerless delimited inputs should be normalized before stacking
- whether `jsonl` belongs in the next multi-file assembly slice
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
- `docs/plans/plan-2026-04-23-data-stack-mixed-source-input-router-implementation.md`
- `docs/plans/plan-2026-04-23-data-stack-interactive-mixed-source-followup.md`

Status note:

- this document records the research direction that shaped the shipped `data stack` implementation
- implementation evidence now lives in:
  - `docs/plans/plan-2026-04-23-data-stack-mixed-source-input-router-implementation.md`
  - `docs/plans/jobs/2026-04-23-data-stack-phase-1-2-implementation.md`
  - `docs/plans/jobs/2026-04-23-data-stack-phase-3-5-implementation.md`
  - `docs/plans/jobs/2026-04-23-data-stack-phase-6-8-implementation.md`
- the current stable command-family split is:
  - `data stack` for multi-source assembly
  - `data extract` for one-input shaping and materialization
  - `data query` for SQL
- this research remains `in-progress` while the interactive mixed-source widening and default-output behavior are still being settled
- interactive widening remains follow-up work, not a reopening of this research direction:
  - the first interactive slice intentionally shipped directory-first and CSV/TSV-only
  - `docs/plans/plan-2026-04-23-data-stack-interactive-mixed-source-followup.md` owns the next mixed-source interactive work
  - that follow-up should freeze default-output behavior before implementation because mixed raw sources do not always have one obvious basename

## Problem

The repo now has a clear query/workspace story:

- `data query` is the DuckDB-backed SQL lane
- `data extract` materializes one shaped table from one input file
- `data query` workspace mode binds backend objects from one source container through repeatable `--relation`

That still leaves an unowned adjacent problem:

- assembling one logical relation from multiple local sources before later SQL or materialization work

Those sources may not all be the same kind:

- some operators already know the explicit files they want
- others want to point at one or more directories
- some flows may need both in one invocation

That means the next contract is not only about file discovery. It is about source normalization.

Examples raised in current discussion:

- multiple CSV files with the same header
- headerless CSV or TSV files that should be normalized into one shared column contract first
- many `jsonl` files that naturally behave as one stream of row objects
- mixed-source invocation such as:

```bash
cdx-chores data stack ./jan.csv ./captures --pattern "*.csv" --output merged.csv
```

The main design risk is conflation.

If this problem is implemented as a looser version of current `data query --relation`, the product would blur:

- workspace relation binding from one source container
- multi-file relation assembly across many local sources
- materialization vs SQL execution vs source discovery

## Scope

This research covers:

- one future `data stack` action under `data`
- mixed file and directory input discovery
- one stack-specific input router that normalizes raw inputs into one file list
- first-pass interactive `data stack` design
- deterministic stacking rules for delimited inputs and a later `jsonl` slice
- first-pass headerless handling as a later slice
- how stacked output should feed later `data query` and `data query codex` flows

This research does not define:

- implementation details for DuckDB file-list SQL generation
- reviewed header-mapping or source-shape artifact changes
- schema-aware workspace redesign
- generic `.json` input support
- mixed-format stacking in one invocation
- Codex-assisted stack-time diagnostics in the first shipped slice

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

- assembling one source from many files or directories before later materialization or query

Implication:

- `data extract` should remain the one-input shaping/materialization lane
- `data stack` can materialize a merged table without taking ownership of Excel shaping, source-shape artifacts, or the rest of the current extract boundary

### 3. The direct CLI should accept mixed raw inputs and normalize them through one dedicated input router

If the product should support flexible source input, the command cannot stay directory-only.

Recommended direct CLI contract:

- accept one or more raw `<source>` arguments
- each raw source may be:
  - file
  - directory
- normalize all raw sources into one ordered file list before format and header validation runs

Recommended implementation boundary:

- use a dedicated helper such as `src/cli/data-stack/input-router.ts`

That helper should own:

- source resolution from cwd
- source-kind detection
- directory expansion
- file passthrough
- deduplication
- deterministic ordering
- source-summary metadata for later review/output messaging

Implication:

- `data stack` gets a coherent mixed-source contract
- the rest of the action can operate on one normalized file-list model instead of branching on raw input kinds throughout the workflow

Recommended ordering rule:

- preserve the raw source order as entered by the user
- when a raw source is a directory, sort its expanded candidates deterministically by relative path before merging them into the final file list
- explicit file sources keep their original position in the raw source sequence

Implication:

- explicit file inputs remain intentionally ordered
- directory-derived expansion stays deterministic and testable

### 4. The repo already has part of the needed pattern, but not a shared mixed-source router

This repo already has relevant precedents:

- minimal path resolution helpers
- file-vs-directory target detection in rename cleanup
- conservative extension-based format detection in the data-query family

But there is not yet one shared utility that says:

- accept mixed raw inputs
- detect source kind for each
- expand them into one normalized file list

Implication:

- this should begin as a stack-specific helper
- only later, if another command really needs the same contract, should it be generalized into a broader shared utility

### 5. Traversal should stay simple: shallow by default, recursion opt-in, no hidden fallback depth

The closest existing repo contract for directory traversal is the rename family:

- non-recursive by default
- opt-in recursion through `--recursive`
- optional `--max-depth`
- `--max-depth` valid only with `--recursive`

Recommended `data stack` route:

- default: shallow directory expansion only
- `--recursive`: recurse
- `--recursive` without `--max-depth`: recurse with no depth cap
- `--recursive --max-depth <n>`: recurse with a cap

Implication:

- the fallback stays simple and already matches the repo’s existing directory-action style
- users do not need to learn a hidden default recursive depth

### 6. Pattern filtering should apply to directory-expanded candidates, not explicit file inputs

If the invocation mixes files and directories, users still need a predictable rule for `--pattern`.

Recommended first-pass rule:

- explicit file sources bypass pattern filtering
- directory-expanded candidates are filtered by `--pattern`

Why:

- an explicit file argument already expresses deliberate selection
- applying a later pattern filter to explicit files is surprising and harder to explain

Implication:

- the mixed-source router can keep one simple fallback:
  - explicit file => include directly
  - directory => expand, then filter

### 7. The first shipped direct CLI slice should support matching-header CSV and TSV with mixed source inputs

Recommended first shipped slice:

- mixed file and directory sources
- matching-header CSV and TSV only
- one normalized format across the final file list
- output extensions aligned with the repo’s materialization-style actions:
  - `.csv`
  - `.tsv`
  - optional array-style `.json`
- Parquet output deferred

That mirrors the repo’s existing materialization-style output pattern most closely:

- output format inferred from the output path extension
- clear rejection of unsupported output extensions

Implication:

- the first shipped slice can stay useful without widening into schema-flex or generic structured-data work too early

### 8. Headerless stacking should reuse the repo’s deterministic placeholder contract, but it should remain a later slice

The current repo already has a user-facing deterministic contract for headerless CSV and TSV:

- explicit `--no-header`
- generated placeholder names such as `column_1`, `column_2`, ...

That is a much safer story than automatic semantic header generation.

Recommended later slice:

- if `--no-header` is present, treat every matched file as headerless
- if `--columns <a,b,c>` is provided, use those names as the authoritative shared schema
- otherwise generate deterministic placeholder names once and apply them across all files
- reject mixed header and headerless inputs in the same invocation unless a future flag deliberately defines that override behavior

Implication:

- headerless stacking stays deterministic
- later reviewed header suggestions can remain a downstream step rather than becoming part of stack-time source interpretation

### 9. `jsonl` belongs in the next slice, with strict same-key behavior first

Generic JSON still carries unresolved table-shape questions:

- array of objects
- top-level object
- scalar arrays
- nested structures

`jsonl` is narrower and more aligned with stacking:

- one object row per line
- natural multi-file append semantics
- easier directory-based discovery

Recommended next-slice contract:

- support `jsonl` as one JSON object per line
- reject top-level arrays or scalar lines
- require the same key set across rows in the first pass
- defer key-mismatch widening to a later explicit schema-flex mode such as `--union-by-name`
- keep generic `.json` input deferred even if `.json` remains an output encoding for the assembled table

Implication:

- `jsonl` can join CSV and TSV earlier than generic JSON because its row model is already stream-oriented
- the first `jsonl` contract stays deterministic rather than trying to auto-heal schema drift

### 10. Codex should stay downstream of stacking in the first pass

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

### 11. Interactive `data stack` should begin narrower than the direct CLI contract

Even if the direct CLI accepts mixed raw inputs, the first interactive slice does not need to expose the full same flexibility.

Recommended first-pass interactive scope:

- directory-first only
- CSV and TSV only
- matching-header mode first
- no direct file-list selection yet
- no `jsonl` interactive support in the first slice
- no Codex-assisted stack diagnostics in the first slice

Why:

- the direct CLI contract should stabilize first
- interactive mode can then wrap that stable behavior without inventing a second product model

Implication:

- direct CLI can be more flexible first
- interactive can stay simpler and more teachable in its first implementation slice

### 12. The first interactive flow should keep one explicit review checkpoint before writing output

The riskiest part of `data stack` is not SQL authoring. It is accidental scope:

- wrong directory
- wrong pattern
- deeper-than-expected traversal
- wrong output target

Recommended first-pass interactive contract:

1. choose the input directory
2. confirm or override detected input format when needed
3. enter the file pattern
4. choose traversal mode
5. preview matched files or at least a bounded matched-file summary
6. choose output format
7. choose output destination within the selected output format
8. review the final stack setup
9. confirm and write

Recommended review checkpoint contents:

- input directory
- pattern
- traversal mode
- matched file count
- a bounded sample of matched relative paths
- output format
- output path

Implication:

- the interactive flow stays aligned with the repo’s staged review-and-write rhythm
- users get one clear point to catch accidental file discovery before output is written

### 13. Default output-path behavior should be designed now, but implemented only after mixed-source routing semantics are stable

This repo already has a shared default-output-path helper and several actions that use it.

But `data stack` has an extra naming problem that those simpler actions do not:

- a mixed-source invocation does not always have one obvious basename
- one invocation may include both explicit files and directories
- one invocation may also include a pattern that shapes the final normalized file list more than any one raw source name does

Recommended direction:

- keep direct CLI `--output <path>` explicit in the first shipped slice
- record default output-path behavior as part of this plan rather than deferring it out of scope
- implement default output-path behavior later in the same plan, after the mixed-source router and primary-source semantics are stable enough to support unsurprising naming

Preferred first rollout for default output paths:

- interactive mode first
- offer:
  - use default output path
  - custom output path
- keep direct CLI explicit until the naming rule is validated in real stack usage

Likely future naming rule:

- derive the default output stem from the normalized source set’s primary label
- append a stack-specific suffix before the extension, such as:
  - `.stack.csv`
  - `.stack.tsv`
  - `.stack.json`

Implication:

- the feature belongs in this overall plan
- but it should land only after the mixed-source routing layer makes “primary source” naming stable enough to trust

## Interactive Flow Direction

### First-pass interactive scope

- start from `cdx-chores interactive`
- choose:
  - `data`
  - `stack`
- first pass should support:
  - directory-first input only
  - CSV and TSV only
  - matching-header mode first
- first pass should defer:
  - direct file-list mode
  - `jsonl`
  - schema-flex options such as `--union-by-name`
  - Codex-assisted stack diagnostics

### Proposed interactive flow

1. prompt for the input directory
2. detect the input format from matched candidates when possible, with override support when needed
3. prompt for the filename pattern
4. choose traversal mode:
   - shallow only
   - recursive if that feature has landed for the direct CLI contract
5. inspect the matched-file summary before continuing
6. choose output format
7. choose output destination
8. review the final stack setup
9. choose one of:
   - write now
   - revise setup
   - cancel

### ASCII flow

```text
cdx-chores interactive
        |
        v
       data
        |
        v
       stack
        |
        v
choose input directory
        |
        v
enter file pattern
        |
        v
choose traversal mode
        |
        v
preview matched files
        |
        v
choose output format
        |
        v
choose output destination
        |
        v
review stack setup
        |
  +-----+------+
  |            |
  v            v
write now   revise/cancel
```

### First-pass interactive notes

- matched-file preview can stay bounded, similar to the repo’s other interactive review surfaces
- if zero files match, the flow should fail clearly before any output prompts
- if headers mismatch in the first direct-CLI contract, the interactive flow should return to setup review rather than trying to auto-repair
- if headerless support lands later on the direct CLI side, a later research or plan update can widen the interactive flow to include header-mode prompts and optional columns
- once `jsonl` lands on the direct CLI side, a later research or plan update can widen the interactive flow to cover it explicitly
- the interactive flow should not land before the direct CLI contract is stable enough to mirror directly

## Recommended Design Route

### Phase 1: Mixed-source CLI stacking for CSV and TSV

Recommended primary command shape:

```bash
cdx-chores data stack <source...> --output <path>
```

Recommended first-pass flags:

- positional `<source...>`
- `--pattern <glob>`
- `--recursive`
- `--max-depth <n>`
- `--input-format <csv|tsv>`
- `--output <path>`
- `--overwrite`

Recommended first-pass behavior:

- explicit files and directories may be mixed in one invocation
- directories expand into candidate files
- explicit files bypass pattern filtering
- directory-expanded candidates are filtered by `--pattern`
- the final normalized file list is deduplicated and ordered deterministically
- the final normalized file list must agree on one supported format
- same-format files only
- matching header row required
- outputs limited to:
  - `.csv`
  - `.tsv`
  - optional array-style `.json`
- no SQL in this lane

### Phase 2: Interactive directory-first stacking

Recommended first-pass interactive shape:

- keep interactive narrower than the direct CLI
- use one input directory plus one pattern
- choose traversal mode
- preview the matched-file summary
- choose output format and destination
- review, then write

### Phase 3: Headerless delimited stacking

Recommended additive flags:

- `--no-header`
- `--columns <name,name,...>`

Recommended behavior:

- all matched files are interpreted the same way
- if `--columns` is omitted, generate `column_<n>` placeholders
- reject varying column counts

### Phase 4: `jsonl`

Recommended scope:

- one object per line
- one logical row per line
- strict same-key requirement first

Recommended first-pass constraint:

- keep generic `.json` input deferred even if `jsonl` lands

### Phase 5: Optional schema-flex modes

Future candidates:

- `--union-by-name`
- source provenance columns such as `--add-source-column <name>`
- explicit row-origin file metadata
- interactive support for those same schema-flex controls after the base direct CLI and interactive flows are stable

Recommended stance:

- treat these as separate follow-up decisions, not baseline v1 behavior

## Draft Command-Surface Direction

Recommended primary contract:

```bash
cdx-chores data stack <source...> --output <path>
```

Likely phase-1 companion forms:

```bash
cdx-chores data stack ./captures ./jan.csv --pattern "*.csv" --output merged.csv
cdx-chores data stack ./captures --recursive --max-depth 1 --pattern "*.tsv" --output merged.tsv
```

Likely phase-3 companion form:

```bash
cdx-chores data stack ./captures ./manual.csv --pattern "*.csv" --no-header --columns id,name,status --output merged.csv
```

Likely later-slice companion form:

```bash
cdx-chores data stack ./events ./manual.jsonl --input-format jsonl --output merged.json
```

Recommended output rule:

- `data stack` materializes one assembled table to an explicitly supported output format
- if `.json` output is supported, it should mean one JSON array of row objects
- later SQL remains the job of `data query`

## Recommendation

Use a new `data stack` action as the owned surface for multi-file assembly.

Keep the first implementation narrow, but allow mixed raw source kinds:

- mixed file and directory inputs through positional `<source...>`
- one stack-specific input router at `src/cli/data-stack/input-router.ts`
- shallow traversal by default
- optional recursion through `--recursive`, with optional `--max-depth`
- CSV and TSV first
- outputs aligned with current materialization-style actions:
  - `.csv`
  - `.tsv`
  - optional array-style `.json`
- direct file-list and directory sources may be mixed, but mixed formats should still fail in the first slice
- deterministic headerless support through `--no-header` and optional `--columns` in a later slice
- `jsonl` as the next structured-data expansion, with strict same-key behavior first
- no new Codex-owned stacking flow in the first slice

Preferred later directions:

- when `jsonl` widens beyond strict same-key behavior, widen first through one explicit opt-in union flag such as `--union-by-name`
- when interactive widens beyond the first directory-first slice, widen to a true mixed-source input mode that mirrors the CLI contract rather than a file-only intermediate mode
- when default output-path behavior widens beyond the single-source interactive rule, keep direct CLI explicit and require the interactive follow-up to define a stable mixed-source primary-label rule before adding implicit naming

Resolved future-direction decisions:

- the first schema-flex widening for `jsonl` should use one explicit opt-in union flag, with `--union-by-name` as the preferred first public contract
- the first widening beyond directory-first interactive mode should be a true mixed-source input mode that mirrors the CLI contract, not a smaller file-only intermediate mode
- later schema-flex additions such as provenance columns should remain separate follow-up work rather than widening the shipped baseline implicitly
- any Codex-assisted stack diagnostics should remain a separate future slice rather than being folded into the current `data stack` contract

Then keep the downstream flow explicit:

1. assemble a clean merged file with `data stack`
2. run SQL with `data query` if needed
3. use `data query codex` on the merged output if natural-language drafting helps
