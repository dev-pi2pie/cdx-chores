## `data query`

`data query` is the direct DuckDB-backed SQL lane for querying one local input file through the logical table name `file`.

Current boundary:

- one input file per invocation
- SQL is required through `--sql`
- built-in inputs: `.csv`, `.tsv`, `.parquet`
- extension-backed inputs: `.sqlite`, `.sqlite3`, `.xlsx`
- default output: bounded terminal table
- machine-readable stdout: `--json`
- file output: `--output <path>` with `.json` or `.csv`

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
cdx-chores data query ./examples/playground/data-query/orders.csv --sql "select * from file order by id"
cdx-chores data query ./examples/playground/data-query/orders.tsv --sql "select team, sum(hours) as hours from file group by team order by hours desc" --rows 10
cdx-chores data query ./examples/playground/parquet-preview/basic.parquet --sql "select id, name from file order by id" --json
cdx-chores data query ./examples/playground/data-query/metrics.csv --sql "select * from file" --output ./examples/playground/data-query/metrics.json --pretty --overwrite
```

### Source selection

`--source` is required for multi-object formats:

- SQLite: table or view name
- Excel: sheet name

Examples:

```bash
cdx-chores data query ./examples/playground/data-query/app.sqlite --source users --sql "select * from file limit 20"
cdx-chores data query ./examples/playground/data-query/report.xlsx --source Summary --sql "select * from file"
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
