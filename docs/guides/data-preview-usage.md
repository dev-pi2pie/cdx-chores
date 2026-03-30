## `data preview`

`data preview` is the first read-only tabular inspection command in `cdx-chores`.

Current boundary:

- input formats: `.csv`, `.tsv`, `.json`
- output: terminal table only
- parser path: lightweight in-memory `papaparse`-backed delimited parsing for `.csv` / `.tsv`
- DuckDB is not used in this v1 path
- SQL, Parquet, and NDJSON are out of scope for this path

The `data` command group now has two preview lanes:

- `data preview` for lightweight `.csv`, `.tsv`, and `.json`
- `data parquet preview` for DuckDB-backed `.parquet`

Follow-up improvements now available:

- `data preview` is available in interactive mode
- interactive preview can now collect `contains` filters
- headerless CSV and TSV preview is now available through `--no-header`
- summary labels and table headers use restrained color in TTY output
- active contains filters now highlight matching cells in TTY output
- global color disabling is supported through:
  - `--no-color`
  - `NO_COLOR`

### Command shape

```bash
cdx-chores data preview <input> [--no-header] [--rows <n>] [--offset <n>] [--columns <name,name,...>] [--contains <column:keyword>]
```

Examples:

```bash
cdx-chores data preview ./examples/playground/tabular-preview/basic.csv
cdx-chores data preview ./examples/playground/tabular-preview/basic.tsv
cdx-chores data preview ./examples/playground/tabular-preview/basic.json
cdx-chores data preview ./examples/playground/tabular-preview/wide.csv --columns id,status,message
cdx-chores data preview ./examples/playground/tabular-preview/large.json --rows 20 --offset 120
cdx-chores data preview ./examples/playground/data-query-probe/auto-headerless.csv --no-header
cdx-chores data preview ./examples/playground/tabular-preview/basic.csv --contains status:active
cdx-chores data preview ./examples/playground/tabular-preview/basic.json --contains name:ada --contains city:tai
```

Interactive mode:

```bash
cdx-chores interactive
```

Then choose:

- `data`
- `preview`

The interactive preview flow prompts for:

- input path
- for `.csv` and `.tsv`, whether the input should be treated as headerless
- optional row count
- optional offset
- optional comma-separated columns
- optional first contains filter in `column:keyword` form
- optional repeated contains filters through an add-another prompt

Blank optional answers map to the CLI defaults:

- `Treat CSV/TSV input as headerless?` => `No`
- blank rows => default row window
- blank offset => `0`
- blank columns => no filter
- blank first contains filter => no contains filter

Interactive headerless note:

- the prompt appears only for `.csv` and `.tsv`
- `.json` skips the prompt because `--no-header` is not valid for JSON preview
- when headerless mode is accepted, interactive `contains` validation also uses generated `column_n` names

### Contains filtering

`--contains` adds a bounded row filter without introducing SQL:

- repeatable: pass `--contains` more than once
- named-column only: each filter must target one explicit column
- combination rule: multiple filters are combined as logical `AND`
- match mode: case-insensitive literal substring match
- match target: the same display-safe string value already used in the preview table
- filter order: filtering happens before `--offset` and `--rows` slicing
- summary behavior: `Rows` and `Window` report against the filtered row set

Escaping rules:

- split on the first unescaped `:`
- escape a literal `:` as `\:`
- escape a literal `\` as `\\`
- any later unescaped `:` characters belong to the keyword segment

Examples:

```bash
cdx-chores data preview ./examples/playground/tabular-preview/basic.csv --contains status:active
cdx-chores data preview ./examples/playground/tabular-preview/basic.json --contains name:ada --contains city:tai
cdx-chores data preview ./examples/playground/tabular-preview/basic.json --contains meta\:key:api\:v1
cdx-chores data preview ./examples/playground/tabular-preview/basic.csv --contains path:C:\\logs\\app
```

### Rendering behavior

The renderer is intentionally conservative:

- adapts column widths to terminal width when stdout is a TTY
- truncates long cells instead of wrapping aggressively
- shows a bounded visible subset of columns when the full set cannot fit cleanly
- keeps redirected non-TTY output deterministic and line-oriented
- applies restrained color only to summary labels and table headers in TTY mode
- when contains filters are active, highlights matching cells only in TTY output with color enabled
- when a matching filter column is hidden by `--columns` or width limits, adds a summary note instead of forcing that column visible

### JSON normalization rules

- array of objects => one row per object
- top-level object => one-row table
- scalar array => one `value` column
- scalar top-level value => one-row `value` table
- heterogeneous object keys are shown in first-seen order across the row set

### Delimited-text normalization rules

- by default, both `.csv` and `.tsv` treat the first row as the header row
- `--no-header` applies only to `.csv` and `.tsv`
- with `--no-header`, row 1 stays in the data row set and the preview generates deterministic column names such as `column_1`, `column_2`, ...
- in `--no-header` mode, `--columns` and `--contains` target those generated `column_n` names
- blank header cells become generated names such as `column_2`
- duplicate header names are deduplicated deterministically
- rows wider than the header extend the column set with generated column names
- empty data rows after the header are skipped from the rendered row set

### Fixture generator

Use the playground fixture generator for manual smoke checks:

```bash
node scripts/generate-tabular-preview-fixtures.mjs seed
node scripts/generate-tabular-preview-fixtures.mjs clean
node scripts/generate-tabular-preview-fixtures.mjs reset
node scripts/generate-parquet-preview-fixtures.mjs seed
node scripts/generate-parquet-preview-fixtures.mjs clean
node scripts/generate-parquet-preview-fixtures.mjs reset
```

Generated files live under:

- `examples/playground/tabular-preview/` for CSV/TSV/JSON
- `examples/playground/parquet-preview/` for Parquet

The fixture sets stay aligned across both destinations:

- `basic`
- `wide`
- `large`

### Color control

Color control is global for the CLI, not `data preview`-only.

Examples:

```bash
cdx-chores --no-color data preview ./examples/playground/tabular-preview/basic.csv
NO_COLOR=1 cdx-chores data preview ./examples/playground/tabular-preview/basic.csv
```

### Follow-up notes

- machine-readable `--format json` output is deferred for now
- `data parquet preview` is the first DuckDB-backed preview action
- no SQL is supported inside `data parquet preview`
- `data query <input>` is now the separate DuckDB-backed SQL lane; see `docs/guides/data-query-usage.md`

## `data parquet preview`

`data parquet preview` is the bounded DuckDB-backed inspection path for `.parquet` files.

Current first-pass boundary:

- input format: `.parquet`
- output: terminal table only
- backend: DuckDB via `@duckdb/node-api`
- supported bounded-preview flags:
  - `--rows`
  - `--offset`
  - `--columns`
- `--contains` is intentionally not supported in this first pass
- SQL is out of scope for this action

Command shape:

```bash
cdx-chores data parquet preview <input> [--rows <n>] [--offset <n>] [--columns <name,name,...>]
```

Examples:

```bash
cdx-chores data parquet preview ./examples/playground/parquet-preview/basic.parquet
cdx-chores data parquet preview ./examples/playground/parquet-preview/wide.parquet --columns id,status,message
cdx-chores data parquet preview ./examples/playground/parquet-preview/large.parquet --rows 20 --offset 120
```

Interactive mode:

```bash
cdx-chores interactive
```

Then choose:

- `data`
- `parquet preview`

The interactive Parquet preview flow prompts for:

- input path
- optional row count
- optional offset
- optional comma-separated columns

Blank optional answers map to the CLI defaults:

- blank rows => default row window
- blank offset => `0`
- blank columns => no filter
