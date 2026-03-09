## `data preview`

`data preview` is the first read-only tabular inspection command in `cdx-chores`.

Current v1 boundary:

- input formats: `.csv`, `.json`
- output: terminal table only
- interaction model: non-interactive
- DuckDB is not used in this v1 path
- SQL, Parquet, and NDJSON are out of scope for this pass

### Command shape

```bash
cdx-chores data preview <input> [--rows <n>] [--offset <n>] [--columns <name,name,...>]
```

Examples:

```bash
cdx-chores data preview ./examples/playground/tabular-preview/basic.csv
cdx-chores data preview ./examples/playground/tabular-preview/basic.json
cdx-chores data preview ./examples/playground/tabular-preview/wide.csv --columns id,status,message
cdx-chores data preview ./examples/playground/tabular-preview/large.json --rows 20 --offset 120
```

### Rendering behavior

The v1 renderer is intentionally conservative:

- adapts column widths to terminal width when stdout is a TTY
- truncates long cells instead of wrapping aggressively
- shows a bounded visible subset of columns when the full set cannot fit cleanly
- keeps redirected non-TTY output deterministic and line-oriented

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

### Follow-up notes

- machine-readable `--format json` output is deferred for now
- DuckDB-backed preview remains a separate follow-up plan
- the most concrete future reason to activate DuckDB is Parquet preview support
