## `data query`

`data query` is the direct DuckDB-backed SQL lane for querying one local input file through the logical table name `file`.

For natural-language SQL drafting, use the separate `data query codex` lane documented in `docs/guides/data-query-codex-usage.md`.

Current boundary:

- one input file per invocation
- SQL is required through `--sql`
- built-in inputs: `.csv`, `.tsv`, `.parquet`
- extension-backed inputs: `.sqlite`, `.sqlite3`, `.xlsx`
- default output: bounded terminal table
- machine-readable stdout: `--json`
- file output: `--output <path>` with `.json` or `.csv`
- interactive mode is available through `cdx-chores interactive`; see `docs/guides/data-query-interactive-usage.md`

### Command shape

```bash
cdx-chores data query <input> --sql "<query>" [--input-format <format>] [--source <name>] [--rows <n>] [--json] [--pretty] [--output <path>] [--overwrite]
```

Supported `--input-format` values:

- `csv`
- `tsv`
- `parquet`
- `sqlite`
- `excel`

Examples:

```bash
cdx-chores data query ./examples/playground/data-query/basic.csv --sql "select id, name from file order by id"
cdx-chores data query ./examples/playground/data-query/basic.tsv --sql "select status, count(*) as total from file group by status order by status" --rows 10
cdx-chores data query ./examples/playground/data-query/basic.parquet --sql "select id, name from file order by id" --json
cdx-chores data query ./examples/playground/data-query/basic.csv --sql "select * from file order by id" --output ./examples/playground/.tmp-tests/data-query-basic.json --pretty --overwrite
```

### Source selection

`--source` is required for multi-object formats:

- SQLite: table or view name
- Excel: sheet name

Examples:

```bash
cdx-chores data query ./examples/playground/data-query/multi.sqlite --source users --sql "select * from file limit 20"
cdx-chores data query ./examples/playground/data-query/multi.xlsx --source Summary --sql "select * from file"
```

Single-object inputs reject `--source`.

### Output rules

- default terminal output is a bounded table
- `--rows` only affects bounded table display
- `--json` writes full JSON results to stdout
- `--pretty` is valid only with `--json` or `.json` file output
- `--output <path>` writes full results to a file and sends status lines to stderr
- `.json` and `.csv` are inferred from the output path extension
- `--json` and `--output <path>` are mutually exclusive

### Doctor

Use `cdx-chores doctor` to inspect current `data query` capability by format.

The report distinguishes:

- built-in formats that are queryable when DuckDB is available
- extension-backed formats that also depend on DuckDB extension loadability
- whether extension installability appears blocked by the current environment

### Smoke fixtures

The repo includes a dedicated deterministic fixture generator for `data query`.

Reset the manual smoke fixtures under `examples/playground/data-query/`:

```bash
node scripts/generate-data-query-fixtures.mjs reset
```

Reset the checked-in test fixtures under `test/fixtures/data-query/`:

```bash
node scripts/generate-data-query-fixtures.mjs reset --output-dir test/fixtures/data-query
```

The generator is independent from the preview fixture scripts and covers representative CSV, TSV, Parquet, SQLite, and Excel inputs, including multi-object SQLite and Excel fixtures for `--source`.
