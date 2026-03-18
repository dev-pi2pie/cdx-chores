## `data extract`

`data extract` materializes one shaped logical table from one local input file into a clean `.csv`, `.tsv`, or `.json` artifact.

For the shared reviewed header-mapping artifact contract, see `docs/guides/data-schema-and-mapping-usage.md`.
For DuckDB extension setup used by Excel and SQLite inputs, see `docs/guides/data-duckdb-usage.md`.
For SQL execution instead of direct materialization, use `docs/guides/data-query-usage.md`.

Current boundary:

- one input file per invocation
- one shaped logical table per invocation
- no SQL in this lane
- built-in inputs: `.csv`, `.tsv`, `.parquet`
- extension-backed inputs: `.sqlite`, `.sqlite3`, `.xlsx`
- explicit Excel shaping is available through `--range <A1:Z99>`
- reviewed Codex source-shape suggestions can be requested through `--codex-suggest-shape`
- accepted source shapes can be reused through `--source-shape <path>`
- accepted semantic header renames can be reused through `--header-mapping <path>`
- reviewed semantic header suggestions can be requested through `--codex-suggest-headers`
- materialization runs require `--output <path>`
- output format is inferred from `.csv`, `.tsv`, or `.json`
- extracted table content is written to the output artifact, not mixed into stdout

### Command shape

```bash
cdx-chores data extract <input> --output <path> [--input-format <format>] [--source <name>] [--range <A1:Z99>] [--source-shape <path>] [--header-mapping <path>] [--overwrite]
cdx-chores data extract <input> --source <name> --codex-suggest-shape [--write-source-shape <path>] [--input-format <format>] [--overwrite]
cdx-chores data extract <input> --codex-suggest-headers [--write-header-mapping <path>] [--input-format <format>] [--source <name>] [--range <A1:Z99> | --source-shape <path>] [--overwrite]
```

Supported `--input-format` values:

- `csv`
- `tsv`
- `parquet`
- `sqlite`
- `excel`

Examples:

```bash
cdx-chores data extract ./examples/playground/data-query/basic.csv --output ./examples/playground/.tmp-tests/basic.clean.json --overwrite
cdx-chores data extract ./examples/playground/data-query/basic.tsv --output ./examples/playground/.tmp-tests/basic.clean.csv --overwrite
cdx-chores data extract ./examples/playground/data-query/multi.xlsx --source Summary --range A1:B3 --output ./examples/playground/.tmp-tests/summary.tsv --overwrite
cdx-chores data extract ./examples/playground/data-extract/messy.xlsx --source Summary --codex-suggest-shape --write-source-shape ./shape.json
cdx-chores data extract ./examples/playground/data-extract/messy.xlsx --source-shape ./shape.json --output ./examples/playground/.tmp-tests/messy.clean.csv --overwrite
cdx-chores data extract ./examples/playground/data-query/generic.csv --codex-suggest-headers --write-header-mapping ./header-map.json
cdx-chores data extract ./examples/playground/data-query/generic.csv --header-mapping ./header-map.json --output ./examples/playground/.tmp-tests/generic.clean.csv --overwrite
```

### Source shaping

`data extract` reuses the same explicit shaping contract as the shared query helpers.

`--source` is required for multi-object formats:

- SQLite: table or view name
- Excel: sheet name

`--range` is valid only for Excel inputs and narrows the selected sheet before the shaped table is materialized.
Other input formats reject `--range`.

First-pass reviewed Codex source-shape help is narrower:

- valid only for Excel inputs
- still requires `--source`
- suggests an explicit `range`
- writes a JSON source-shape artifact and stops before materialization

`--source-shape <path>` reuses an accepted source-shape artifact and applies the accepted sheet plus range before extraction continues.

Examples:

```bash
cdx-chores data extract ./examples/playground/data-query/multi.sqlite --source users --output ./examples/playground/.tmp-tests/users.json --overwrite
cdx-chores data extract ./examples/playground/data-query/multi.xlsx --source Summary --output ./examples/playground/.tmp-tests/summary.csv --overwrite
cdx-chores data extract ./examples/playground/data-query/multi.xlsx --source Summary --range A1:B3 --output ./examples/playground/.tmp-tests/summary.csv --overwrite
cdx-chores data extract ./examples/playground/data-extract/messy.xlsx --source Summary --codex-suggest-shape --write-source-shape ./shape.json
cdx-chores data extract ./examples/playground/data-extract/messy.xlsx --source-shape ./shape.json --output ./examples/playground/.tmp-tests/messy.clean.csv --overwrite
```

### Reviewed header suggestions

`--codex-suggest-headers` stays explicitly two-step and is downstream of accepted source shaping:

1. inspect the current shaped source
2. ask Codex for semantic header suggestions
3. write a JSON header-mapping artifact
4. stop before writing the extracted output artifact

Then rerun `data extract` with the accepted `--header-mapping <path>` plus `--output <path>`.

First-pass reuse is strict:

- the artifact must match the current normalized `input.path`
- the artifact must match the current `input.format`
- optional `source` and `range` must also match exactly when present

### Interactive mode

Interactive `data extract` is available through:

```bash
cdx-chores interactive
```

Choose:

1. `data`
2. `extract`

Current interactive flow:

1. choose input
2. detect format
3. choose source when needed
4. inspect the current shaped source
5. for suspicious whole-sheet Excel inputs, choose:
   - keep as-is
   - enter range manually
   - ask Codex to suggest shaping
6. after accepted source-shape changes, re-inspect
7. when generated placeholder headers remain, optionally review semantic header suggestions
8. choose the output file path
9. confirm overwrite when needed
10. materialize the shaped table

### Output rules

- `--output <path>` is required for materialization runs
- `.csv`, `.tsv`, and `.json` are inferred from the output path extension
- `--overwrite` is required to replace an existing output artifact
- materialization status lines are written to stderr
- suggestion runs write the mapping summary to stdout and artifact status lines to stderr

### Smoke fixtures

Reset the public-safe manual smoke fixtures under `examples/playground/data-extract/`:

```bash
node scripts/generate-data-extract-fixtures.mjs reset
```

Reset the fixture set into a custom directory:

```bash
node scripts/generate-data-extract-fixtures.mjs reset --output-dir examples/playground/.tmp-tests/data-extract-smoke
```

### DuckDB readiness

Excel and SQLite extraction use the same DuckDB-backed source preparation as `data query`.

If the required extension is missing, install it explicitly and retry:

```bash
cdx-chores data duckdb extension install sqlite
cdx-chores data duckdb extension install excel
```
