---
title: "Tabular preview, SQL, and Parquet scope"
created-date: 2026-03-02
modified-date: 2026-03-02
status: draft
agent: codex
---

## Goal

Define the next research baseline for tabular-data inspection in `cdx-chores`, including a likely `data preview` command, SQL-backed workflows, and future Parquet support, and decide whether `@duckdb/node-api` should be part of the first implementation scope.

## Milestone Goal

Choose a practical first scope for tabular preview and query support that:

- fits the current Node.js-compatible TypeScript CLI architecture
- reuses as much of the existing `data` command surface as possible
- leaves room for larger-file and SQL-backed workflows later
- does not collapse rename-preview work and generic data inspection into one feature track

## Key Findings

### 1. Current `data` support is conversion-only, not inspection-oriented

Today the `data` command group only exposes:

- `data json-to-csv`
- `data csv-to-json`

The current implementation in `src/cli/actions/data.ts` is intentionally simple:

- read a text file
- parse JSON or CSV
- normalize rows
- write a converted output file

There is no current read-only inspection surface, table rendering layer, schema summary, or paging/windowing behavior.

Implication:

- `data preview` is a real new command surface, not just a flag on existing conversion commands

### 2. The scrollable-table problem and the storage/query-engine problem are related but separate

The previously completed large rename preview research already drew a useful boundary:

- bounded/scrollable preview UI is one layer
- a future `data preview` command is a broader command-level feature

That same separation still matters here.

For `data preview`, there are at least three layers:

1. file parsing / row source
2. tabular projection and schema inference
3. terminal preview UI with a bounded visible window

DuckDB mostly changes layer 1 and part of layer 2.
It does not remove the need to design:

- column width policy
- row windowing
- horizontal overflow behavior
- keyboard navigation
- compact summaries for large datasets

Implication:

- adding DuckDB does not itself solve the terminal UX

### 3. A useful v1 exists without DuckDB

For JSON and CSV, the repository already has enough local building blocks to ship a first preview command without introducing a database engine:

- CSV parsing in `src/utils/csv.ts`
- JSON normalization patterns in `src/cli/actions/data.ts`
- prior terminal-windowing research from rename preview

A TypeScript-first v1 can support:

- JSON arrays of objects
- top-level JSON objects as a single row
- simple scalar-array fallback via a single `value` column
- CSV with header detection through the existing parser contract
- row count and column summary
- bounded preview with vertical scrolling or head/tail windowing

This would cover the current request for:

- JSON preview
- CSV preview
- scrollable table

without changing the dependency model yet.

### 4. `@duckdb/node-api` meaningfully expands capability, not just performance

DuckDB Node Neo positions `@duckdb/node-api` as the high-level Node API for applications and exposes Promise-first SQL execution through the DuckDB C API.[^duckdb-node-neo][^duckdb-npm]

That matters because it opens a different product surface:

- SQL over previewed data
- direct querying of CSV / JSON / Parquet files
- large-file workflows that benefit from projection/filter pushdown
- a route toward multi-format preview beyond plain JSON/CSV

DuckDB documentation also emphasizes direct querying of files and automatic CSV sniffing / type detection.[^duckdb-csv-auto][^duckdb-data-sources][^duckdb-parquet]

Implication:

- adopting DuckDB is not just "make preview faster"
- it changes the command family from file preview to tabular query/inspection tooling

### 5. DuckDB also introduces dependency and packaging tradeoffs that are non-trivial for this repo

This project currently has a lightweight internal TypeScript implementation for `data` conversions and targets Node.js runtime compatibility, with Bun used for development.

Adding `@duckdb/node-api` would introduce new considerations:

- native bindings / packaged binaries across supported platforms
- install-size and release-distribution cost
- CI coverage for supported Node platforms
- behavior on unsupported or partially supported environments
- doctor/install guidance if the package becomes optional or fails to load

DuckDB Node Neo lists supported platforms rather than implying universal coverage, and some areas remain incomplete on its roadmap.[^duckdb-node-neo]

Implication:

- the first question is not only "would DuckDB be useful?"
- the first question is "do we want `data preview` to become a database-backed feature track right now?"

### 6. A clean adapter boundary would let the project defer that decision

The safest design is to keep the preview command split into:

- a renderer contract
- a row-source contract
- optional backend adapters

Suggested internal boundary:

- `preview source`: returns columns, row iterator/window access, counts, and type hints
- `preview renderer`: handles terminal layout and scrolling
- `preview controller`: wires command flags to source and renderer

With that structure:

- v1 can use an internal JSON/CSV row source
- v2 can add a DuckDB-backed row source
- SQL support can remain opt-in instead of leaking into the baseline command

### 7. SQL should be treated as a follow-up mode, not a hidden side effect of preview

If DuckDB is added, users will reasonably expect more than a passive viewer.
They will expect things like:

- `--sql "select ..."`
- filters, ordering, and limits
- schema/type-aware summaries
- maybe support for Parquet and remote sources later

That can be a good direction, but it is meaningfully larger than:

- "show me this JSON or CSV in a scrollable table"

Implication:

- if DuckDB lands, it should be framed explicitly as a second feature layer, not silently bundled into the first preview implementation

## Implications or Recommendations

### Recommendation A. Ship `data preview` v1 without DuckDB

Recommended v1 scope:

- command: `data preview`
- inputs: `.csv`, `.json`
- output: terminal preview only
- renderer: bounded table window with vertical scrolling or paged navigation
- summary: file path, detected format, row count, column list, truncated-view notice
- no SQL in v1
- no new binary/native dependency in v1

Why:

- directly satisfies the current preview request
- keeps implementation aligned with the existing lightweight `data` command philosophy
- reduces packaging and CI complexity
- lets the team validate the terminal UX before committing to a query engine

### Recommendation B. Design the command so DuckDB can be added later as an optional backend

Recommended architecture rule:

- do not hard-wire preview rendering to the current in-memory parser shape

Instead, define a row-source abstraction that can later support:

- current internal parser
- DuckDB-backed source

This keeps the future open for:

- larger datasets
- SQL-backed filtering
- Parquet support
- schema/type-aware summaries

without making them blockers for v1.

### Recommendation C. Treat DuckDB as a phase-2 product decision

The right time to add `@duckdb/node-api` is when at least one of these becomes important enough to justify the extra dependency and complexity:

- previewing files too large for the in-memory TypeScript path
- supporting Parquet or more file formats
- exposing SQL as a first-class workflow
- wanting filter/projection pushdown and richer type inference

If none of those are required yet, DuckDB is likely premature for the first release of `data preview`.

### Recommendation D. Keep `data preview` separate from rename-preview implementation scope

The previous rename-preview research is still correct:

- rename dry-run preview
- reusable preview infrastructure
- `data preview`

should remain related but distinct tracks.

That avoids expanding one UX improvement into a broad terminal-app rewrite.

## Proposed Command Shape

Conservative v1:

```bash
cdx-chores data preview ./table.csv
cdx-chores data preview ./rows.json
```

Possible v1 options:

```bash
cdx-chores data preview ./table.csv --rows 30
cdx-chores data preview ./rows.json --offset 100
cdx-chores data preview ./rows.json --columns name,created_at,status
```

Possible phase-2 DuckDB-backed options:

```bash
cdx-chores data preview ./table.csv --sql "select name, count(*) from file group by 1"
cdx-chores data preview ./events.parquet --limit 100
```

## Preferred Direction

Current preferred direction:

- add `data preview` as a new `data` subcommand
- make JSON and CSV the required first formats
- build the renderer and row-source boundary first
- keep DuckDB out of the first implementation
- revisit `@duckdb/node-api` only when SQL or broader file-format support becomes a concrete milestone

## Open Questions

1. Should v1 preview support only terminal rendering, or also an `--output json` summary mode for automation?
2. Should the first interactive table support horizontal scrolling, or only column truncation with a column selector?
3. Should JSON Lines / NDJSON be included in v1, or deferred until the command contract is stable?
4. If DuckDB is later added, should it be optional at runtime or a standard dependency?

## Related Research

- `docs/researches/research-2026-02-28-interactive-large-rename-preview-ux-research.md`
- `docs/researches/research-2026-02-25-excel-like-workflows-scope-and-tooling.md`
- `docs/researches/research-2026-02-25-cdx-chores-cli-scope-and-architecture.md`

## References

- `src/command.ts`
- `src/cli/actions/data.ts`
- `src/cli/interactive.ts`
- `src/utils/csv.ts`
- [^duckdb-node-neo]
- [^duckdb-npm]
- [^duckdb-csv-auto]
- [^duckdb-data-sources]
- [^duckdb-parquet]

[^duckdb-node-neo]: [DuckDB Node.js Client (Neo) overview](https://duckdb.org/docs/stable/clients/node_neo/overview)
[^duckdb-npm]: [npm: `@duckdb/node-api`](https://www.npmjs.com/package/@duckdb/node-api)
[^duckdb-csv-auto]: [DuckDB CSV auto detection](https://duckdb.org/docs/stable/data/csv/auto_detection.html)
[^duckdb-data-sources]: [DuckDB data sources](https://duckdb.org/docs/stable/data/data_sources)
[^duckdb-parquet]: [DuckDB querying Parquet files](https://duckdb.org/docs/stable/guides/file_formats/query_parquet)
