## `data query`

`data query` is the direct DuckDB-backed SQL lane for querying one local input file through the logical table name `file`.

For natural-language SQL drafting, use the separate `data query codex` lane documented in `docs/guides/data-query-codex-usage.md`.
For materializing one shaped table without SQL, use `docs/guides/data-extract-usage.md`.
For reviewed semantic header suggestions and the shared JSON artifact contract, see `docs/guides/data-schema-and-mapping-usage.md`.

Current boundary:

- one input file per invocation
- SQL is required through `--sql`
- built-in inputs: `.csv`, `.tsv`, `.parquet`
- extension-backed inputs: `.sqlite`, `.sqlite3`, `.xlsx`
- explicit Excel shaping is available through `--range <A1:Z99>`
- explicit Excel body-start selection is available through `--body-start-row <n>`
- explicit Excel header selection is available through `--header-row <n>`
- accepted semantic header renames can be reused through `--header-mapping <path>`
- reviewed semantic header suggestions can be requested through `--codex-suggest-headers`
- default output: bounded terminal table
- machine-readable stdout: `--json`
- file output: `--output <path>` with `.json` or `.csv`
- interactive mode is available through `cdx-chores interactive`; see `docs/guides/data-query-interactive-usage.md`

### Command shape

```bash
cdx-chores data query <input> --sql "<query>" [--input-format <format>] [--source <name>] [--range <A1:Z99>] [--body-start-row <n>] [--header-row <n>] [--header-mapping <path>] [--rows <n>] [--json] [--pretty] [--output <path>] [--overwrite]
cdx-chores data query <input> --codex-suggest-headers [--write-header-mapping <path>] [--input-format <format>] [--source <name>] [--range <A1:Z99>] [--body-start-row <n>] [--header-row <n>] [--overwrite]
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
cdx-chores data query ./examples/playground/data-query/multi.xlsx --source Summary --range A1:B3 --sql "select * from file order by id"
cdx-chores data query ./examples/playground/data-extract/stacked-merged-band.xlsx --source Sheet1 --range B7:BR20 --body-start-row 10 --header-row 7 --sql "select id, question, status, notes from file order by id"
cdx-chores data query ./examples/playground/data-query/generic.csv --codex-suggest-headers --write-header-mapping ./header-map.json
cdx-chores data query ./examples/playground/data-query/generic.csv --header-mapping ./header-map.json --sql "select id, status from file order by id"
```

### Source selection

`--source` is required for multi-object formats:

- SQLite: table or view name
- Excel: sheet name

`--range` is valid only for Excel inputs and narrows the selected sheet before the logical table `file` is created.
Other input formats reject `--range`.

`--body-start-row <n>` and `--header-row <n>` are also valid only for Excel inputs:

- both use absolute worksheet row numbering
- `body-start-row` marks where logical body rows begin
- when `--range` is present, each row must fall inside that rectangle
- when both rows are present, `body-start-row` must be greater than `header-row`
- `body-start-row` changes import-time shaping instead of acting as a later SQL filter

Examples:

```bash
cdx-chores data query ./examples/playground/data-query/multi.sqlite --source users --sql "select * from file limit 20"
cdx-chores data query ./examples/playground/data-query/multi.xlsx --source Summary --sql "select * from file"
cdx-chores data query ./examples/playground/data-query/multi.xlsx --source Summary --range A1:B3 --sql "select * from file"
cdx-chores data query ./examples/playground/data-extract/stacked-merged-band.xlsx --source Sheet1 --range B7:BR20 --body-start-row 10 --header-row 7 --sql "select id, question, status, notes from file order by id"
```

### Header review and reuse

`--codex-suggest-headers` is a reviewed shaping flow:

- it inspects the current shaped source
- it asks Codex for semantic header suggestions
- it writes a JSON header-mapping artifact
- it stops before SQL execution

Then rerun `data query` with the accepted `--header-mapping <path>` plus `--sql`.

First-pass reuse is strict:

- the artifact must match the current normalized `input.path`
- the artifact must match the current `input.format`
- optional `source`, `range`, `bodyStartRow`, and `headerRow` must also match exactly when present

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

For extension-backed formats, `detected support=yes` does not mean the format is queryable right now. The capability line turns green only when the required DuckDB extension is currently loadable.

### DuckDB extension troubleshooting

If `sqlite` or `excel` shows `detected support=yes, loadability=no, installability=yes`, the usual cause is that the required DuckDB extension is missing for the current DuckDB runtime version.

Recommended first steps:

```bash
cdx-chores data duckdb doctor
cdx-chores data duckdb extension install sqlite
cdx-chores data duckdb extension install excel
```

If you want the query command itself to attempt one install-and-retry pass for an extension-backed input, use:

```bash
cdx-chores data query ./examples/playground/data-query/multi.sqlite --source users --install-missing-extension --sql "select * from file limit 20"
cdx-chores data query ./examples/playground/data-query/multi.xlsx --source Summary --install-missing-extension --sql "select * from file"
```

`data duckdb doctor` is the backend-oriented inspection view. It shows the current DuckDB runtime version and the managed extension state for `sqlite` and `excel`.

For the dedicated DuckDB lifecycle command surface, see `docs/guides/data-duckdb-usage.md`.

DuckDB still caches extensions by version under a path like:

```text
$HOME/.duckdb/extensions/<duckdb-version>/
```

Common failure pattern:

- an older cache directory exists for a previous DuckDB version
- the current runtime has upgraded
- one extension was reinstalled for the new version, but another was not

Example:

- `sqlite` is green because `sqlite_scanner` exists under the current DuckDB version directory
- `excel` is red because `excel.duckdb_extension` exists only under an older version directory

Advanced fallback only:

If the explicit CLI install path still does not resolve a stale-cache problem, inspect the versioned cache and prefer removing only stale version directories instead of wiping all of `$HOME/.duckdb`:

```bash
rm -rf "$HOME/.duckdb/extensions/<old-duckdb-version>"
```

After install or cleanup, rerun:

```bash
cdx-chores doctor
```

If `loadability` is still `no` and `installability` flips to `no`, the current environment likely cannot download or cache the extension and the remediation path is different from a normal reinstall.

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
