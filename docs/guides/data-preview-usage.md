## `data preview`

`data preview` is the first read-only tabular inspection command in `cdx-chores`.

Current v1 boundary:

- input formats: `.csv`, `.json`
- output: terminal table only
- interaction model: non-interactive
- DuckDB is not used in this v1 path
- SQL, Parquet, and NDJSON are out of scope for this pass

Follow-up improvements now available:

- `data preview` is available in interactive mode
- summary labels and table headers use restrained color in TTY output
- global color disabling is supported through:
  - `--no-color`
  - `NO_COLOR`

### Command shape

```bash
cdx-chores data preview <input> [--rows <n>] [--offset <n>] [--columns <name,name,...>] [--contains <column:keyword>]
```

Examples:

```bash
cdx-chores data preview ./examples/playground/tabular-preview/basic.csv
cdx-chores data preview ./examples/playground/tabular-preview/basic.json
cdx-chores data preview ./examples/playground/tabular-preview/wide.csv --columns id,status,message
cdx-chores data preview ./examples/playground/tabular-preview/large.json --rows 20 --offset 120
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
- optional row count
- optional offset
- optional comma-separated columns

Blank optional answers map to the CLI defaults:

- blank rows => default row window
- blank offset => `0`
- blank columns => no filter

Interactive note:

- `--contains` is currently CLI-only
- interactive preview does not yet prompt for row filters

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

The v1 renderer is intentionally conservative:

- adapts column widths to terminal width when stdout is a TTY
- truncates long cells instead of wrapping aggressively
- shows a bounded visible subset of columns when the full set cannot fit cleanly
- keeps redirected non-TTY output deterministic and line-oriented
- applies restrained color only to summary labels and table headers in TTY mode

### JSON normalization rules

- array of objects => one row per object
- top-level object => one-row table
- scalar array => one `value` column
- scalar top-level value => one-row `value` table
- heterogeneous object keys are shown in first-seen order across the row set

### CSV normalization rules

- first row is treated as the header row
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
```

Generated files live under `examples/playground/tabular-preview/`.

### Color control

Color control is global for the CLI, not `data preview`-only.

Examples:

```bash
cdx-chores --no-color data preview ./examples/playground/tabular-preview/basic.csv
NO_COLOR=1 cdx-chores data preview ./examples/playground/tabular-preview/basic.csv
```

### Follow-up notes

- machine-readable `--format json` output is deferred for now
- DuckDB-backed preview remains a separate follow-up plan
- the most concrete future reason to activate DuckDB is Parquet preview support
