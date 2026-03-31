---
title: "Multi-source query workspace contract"
created-date: 2026-03-31
modified-date: 2026-03-31
status: draft
agent: codex
---

## Goal

Define the next query-contract direction after the current single-source `file` model, so future work can support multi-source SQL authoring without reopening naming, aliasing, or source-family boundaries on each implementation pass.

## Milestone Goal

Reduce the next-stage query expansion into an implementation-ready contract that:

- preserves the current single-source shorthand where it is still useful
- introduces an explicit workspace model for multi-source SQL
- separates backend object names from user-visible SQL relation names
- stays compatible with today's file-backed workflows while leaving room for future connection-backed sources such as Postgres or MySQL
- clarifies whether DuckDB database files belong in the same expansion track
- identifies fixture and smoke-test implications before a follow-up plan begins

## Related Research

- `docs/researches/research-2026-03-09-data-query-scope-and-contract.md`
- `docs/researches/research-2026-03-20-data-command-surface-headerless-and-codex-boundaries.md`

## Related Plans

- `docs/plans/plan-2026-03-10-data-query-cli-implementation.md`
- `docs/plans/plan-2026-03-30-interactive-data-query-followup-implementation.md`

## Key Findings

### 1. The current `file` relation is a product alias, not a DuckDB requirement

The current query stack creates one prepared logical relation named `file` before SQL execution and teaches users to write SQL against that alias.[1][2][3]

Implication:

- the current `select * from file` contract is an application-owned abstraction, not a backend-imposed SQL rule
- because the alias is product-owned, the product can evolve it deliberately instead of treating it as a fixed engine constraint

### 2. The current contract is intentionally single-source and already documented that way

The original query research and later implementation plan intentionally froze the first public contract to:

- one input file per invocation
- one selected source object when required
- one logical table name such as `file`
- no attachment aliases
- no remote sources.[4][5]

Implication:

- moving toward multi-source behavior is a genuine contract expansion, not a bug fix or wording cleanup
- the next research doc must define the new model explicitly rather than treating it as a small extension of `--source`

### 3. Multi-source support should be modeled as a query workspace, not as a looser `file` alias

If one invocation exposes multiple backend objects from the same source container to SQL, the command no longer has one obvious logical table. In that world the stable concept is not "the file table" but "the query workspace" containing one or more bound relations.

Recommended vocabulary:

- `source`
  - where data comes from, such as a CSV, SQLite file, Excel workbook, DuckDB file, or future database connection
- `backend object`
  - the raw object inside that source, such as a SQLite table, DuckDB table, Excel sheet, or future schema-qualified database relation
- `relation binding`
  - the explicit mapping that exposes one backend object into the SQL workspace under a user-facing relation name
- `workspace`
  - the set of bound relations available to one query invocation

Implication:

- future public docs and flags should describe relation bindings and workspaces rather than stretching the current single-source `file` wording past its natural limit

### 4. The safest compatibility rule is: implicit `file` only when exactly one relation is bound

The main aliasing risk is not the existence of a backend table actually named `file`. The real risk is letting the command inject a compatibility alias named `file` in cases where multiple logical relations are already present.

Recommended rule:

- single-source shorthand may continue to expose one compatibility alias named `file`
- multi-source mode should not inject any implicit `file` alias
- multi-source mode should reserve `file` as unavailable for explicit relation aliases too
- in multi-source mode, all SQL-visible names should come only from explicit non-`file` relation bindings

Implication:

- the current direct CLI shape can remain stable for one-source workflows
- multi-source mode avoids the ambiguity of asking which bound relation `file` should mean
- a backend object really named `file` is still supportable in multi-source mode, but only through a different explicit alias such as `f=file`

### 5. Backend object names and SQL relation names must stay separate concepts

A source may legitimately contain backend objects named `file`, `users`, and `bookmarks` at the same time. That is manageable only if the contract separates:

- the object selector used to choose the backend object
- the alias exposed to SQL inside the workspace

Recommended direction:

- treat relation bindings as explicit alias maps, such as `users`, `bookmarks`, or `f=file`
- avoid a tolerant contract that sometimes exposes raw backend object names and sometimes rewrites them silently

Example:

```text
source: app.sqlite
backend objects: file, users, bookmarks
workspace bindings:
- f=file
- users=users
- bookmarks=bookmarks
```

Implication:

- the command can support a real backend object named `file` without conflicting with the old single-source shorthand, as long as multi-source mode reserves `file` and requires a different explicit alias

### 6. The next public CLI should expand around repeatable relation bindings, not around a more complex `--source`

`--source` works well as a single-object selector, but it does not naturally scale to multi-source SQL because it has no place to express:

- more than one selected object
- aliases
- future schema-qualified selectors
- future connection-backed object selection

Recommended command-shape direction:

- keep current single-source shorthand:
  - `data query <input> --sql "..."`
- keep current one-object selector for the old path:
  - `data query <input> --source users --sql "..."`
- add an explicit repeatable relation-binding surface for multi-source work:
  - `--relation users`
  - `--relation bookmarks`
  - `--relation f=file`

The bare form should mean "bind a relation with the same SQL name and backend object name". In other words:

- `--relation users` expands to `users=users`
- `--relation f=file` keeps the alias explicit when the SQL name should differ from the backend object name

Recommended workspace-entry rule:

- one positional source path continues to identify one source container per invocation
- repeatable `--relation` flags bind one or more backend objects from that source container into the workspace
- any explicit `--relation` flag puts the invocation into workspace mode, even if only one relation is bound
- the workspace becomes multi-relation once two or more `--relation` flags are present
- once in workspace mode, SQL should target the explicit relation bindings rather than relying on the old implicit `file` alias

Implication:

- users can continue to rely on `file` for simple one-source work
- multi-source authoring gets a stable, explicit contract instead of overloading `--source` beyond its original purpose

### 7. Future source-family expansion should be source-oriented, not file-extension-oriented

The current product is file-backed, but the next contract should already assume more than one source family:

- file-backed tabular sources
- file-backed database/catalog sources
- future connection-backed database/catalog sources

Recommended source-family framing:

- file-like table sources
  - CSV, TSV, Parquet
- file-like catalog sources
  - SQLite, DuckDB file, Excel workbook
- future connection-backed catalog sources
  - Postgres, MySQL, and similar engines if later supported

Implication:

- the future contract can remain stable even if the implementation later adds `--connect <profile-or-dsn>` beside file paths
- product docs can describe one workspace model across both local files and future remote catalogs

### 8. DuckDB database file support belongs to the same design track, but should not be added under the old single-source mental model

The current supported formats exclude DuckDB files.[6] DuckDB's own docs show `.duckdb` as a common database-file extension, while also explicitly noting that DuckDB database files may use arbitrary extensions and that `.db` is also common.[9] If DuckDB-file support is added later, it should not be treated as merely "SQLite again under a different extension" because a DuckDB file naturally fits the broader catalog-style source family:

- multiple tables
- possible schemas
- natural join use cases
- closer similarity to future connection-backed databases than to one-table files

Recommended direction:

- include DuckDB-file support in the same research and planning track as multi-source workspaces
- if extension-based input detection is added for DuckDB files, treat `.duckdb` as the safest first explicit detection target
- do not auto-detect generic `.db` files as DuckDB because DuckDB docs treat `.db` as common too, which keeps it ambiguous against the current SQLite-first `.db` exclusion logic
- continue treating generic `.db` files as ambiguous in direct CLI too, requiring an explicit `--input-format` such as `sqlite` or future `duckdb`
- keep interactive mode aligned with the same rule: when a selected path is ambiguous such as `*.db`, skip format auto-confirmation and ask the user to choose the format explicitly instead
- do not add DuckDB-file support first under a one-selected-object-only mental model unless the team is willing to revise it again soon after

Implication:

- the next implementation plan can decide whether DuckDB-file support lands in the first multi-source phase or a closely following phase
- the likely direct-CLI first step is recognizing `.duckdb`, not claiming that `.duckdb` is the only valid DuckDB database filename
- direct CLI and interactive mode can preserve one stable product rule: ambiguous extensions require explicit format selection
- either way, the contract should be frozen once for both concerns rather than drift in two separate passes

### 9. Excel should stay explicitly narrower than SQLite or DuckDB in the first multi-source pass

SQLite and future DuckDB-file support map naturally to multi-relation SQL authoring. Excel is different because the current shaping controls are global, singular, and relation-specific at the same time:

- `--range`
- `--header-row`
- `--body-start-row`
- reviewed source-shape replay

Those controls do not scale cleanly across several sheets in one invocation without a more structured per-relation shaping model.

Recommended first-pass scope:

- first multi-source SQL phase should prioritize SQLite
- DuckDB file may join that phase if the source-resolution surface is ready
- Excel multi-source binding should remain out of the first pass unless relation-specific shaping is designed explicitly

Implication:

- the next plan can unlock real join authoring quickly without forcing a premature redesign of Excel shaping artifacts and prompts

### 10. `data query codex` should draft against workspace relations, not against a renamed singular `file`

The current Codex drafting prompt explicitly instructs the model to use only the table name `file`.[3] That rule is coherent for the current contract and wrong for the future workspace model.

Recommended drafting behavior:

- single-source Codex mode may keep the current `file` shorthand
- multi-source Codex mode should expose relation names and relation-specific schema summaries
- the prompt should instruct Codex to use only the explicitly bound relation names present in the workspace

Implication:

- multi-source SQL drafting becomes a direct extension of the workspace contract rather than a prompt-only hack layered on top of the old alias

### 11. Fixtures and smoke tests should evolve by scenario family, not only by file format

The current fixture generator for `data query` creates a representative but format-oriented set:

- `basic.csv`
- `basic.tsv`
- `basic.parquet`
- `generic.csv`
- `large.csv`
- `large.parquet`
- `multi.sqlite`
- `multi.xlsx`.[7][8]

That is sufficient for the current single-source lane, but it does not yet express the new contract questions:

- one-source shorthand compatibility
- explicit multi-relation binding
- joinable fixture pairs
- backend object names that collide with the old `file` alias
- future catalog-style sources such as DuckDB files

Recommended fixture direction:

- keep the current representative single-source set
- add scenario-oriented fixtures for:
  - single-source compatibility
  - multi-source joinable relations
  - alias-collision cases such as a real backend object named `file`
  - DuckDB catalog-style sources if they enter scope

Implication:

- smoke fixtures and generators stay aligned with the product contract rather than only with extension-based format detection

## Recommended Contract Direction

### Public model

- One query invocation creates one workspace.
- A workspace contains one or more bound logical relations.
- Single-source shorthand may expose one compatibility alias named `file`.
- Multi-source mode must expose only explicitly bound relation names.

### Alias rule

- `file` is implicit only when exactly one logical relation is bound.
- When multiple relations are bound, `file` has no implicit meaning and should be reserved from explicit alias use.
- A backend object really named `file` should be bound under a different explicit alias such as `f=file`.

### CLI direction

Keep:

- `data query <input> --sql "..."`
- `data query <input> --source <name> --sql "..."`

Add later:

- repeatable `--relation <binding>` for multi-source workspaces, where the bare form binds `name=name` and `alias=object` syntax stays available for explicit renames
- optional future connection-oriented source entry such as `--connect <profile-or-dsn>`

### Scope sequencing

Recommended first pass:

- preserve current single-source behavior
- add workspace-aware multi-relation support for SQLite from one source container per invocation
- update `data query codex` to draft against explicit relation names
- defer Excel multi-source shaping

Recommended near-follow-up:

- keep DuckDB-file support under the same public multi-source contract even if implementation sequencing lands SQLite slightly earlier
- only after the workspace contract is frozen, expand fixture generators and smoke suites around the new scenario families

## Resolved Decisions

### 1. One source container per invocation, with repeatable `--relation` bindings

The first multi-source direct CLI should keep one positional source path per invocation and use repeatable `--relation` flags to bind multiple backend objects from that source container into the workspace.

Any explicit `--relation` flag should put the invocation into workspace mode, even when it binds only one relation. Two or more `--relation` flags then produce a multi-relation workspace.

This avoids reopening the input model around multi-file or multi-connection joins in the same first pass while still unlocking multi-table SQL authoring inside one source container.

### 2. DuckDB-file support belongs to the same first multi-source contract as SQLite

DuckDB-file support should be treated as part of the same first multi-source public contract because both SQLite and DuckDB files are file-backed catalog sources with natural multi-table behavior.

Implementation sequencing may still land SQLite slightly earlier if that reduces risk, but the public relation-binding model should be frozen once for both instead of redesigned twice.

### 3. Future connection-backed bindings should accept schema-qualified selectors directly

If future connection-backed sources are added, relation bindings should accept backend selectors directly, including schema-qualified names such as `public.users`.

Alias syntax should remain available through forms such as `u=public.users`.

Separate schema flags are not recommended for the core binding contract because direct qualified selectors are simpler, closer to backend reality, and more extensible if future engines support deeper qualification than `schema.table`.

## References

- [1] `src/cli/duckdb/query/prepare-source.ts`
- [2] `src/cli/commands/data/query.ts`
- [3] `src/cli/data-query/codex.ts`
- [4] `docs/researches/research-2026-03-09-data-query-scope-and-contract.md`
- [5] `docs/plans/plan-2026-03-10-data-query-cli-implementation.md`
- [6] `src/cli/duckdb/query/types.ts`
- [7] `scripts/generate-data-query-fixtures.mjs`
- [8] `test/data-query-fixture-generator.test.ts`
- [9] DuckDB Connect docs: `https://duckdb.org/docs/current/connect/overview`
