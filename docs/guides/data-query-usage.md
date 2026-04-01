## `data query`

`data query` is the direct DuckDB-backed SQL lane for querying one local input file.

Single-source runs expose the logical table name `file`.
Workspace runs expose one or more explicit relation bindings instead.

It is also the current general-purpose lane for tricky transformations that go beyond the shaping/materialization boundary of `data extract`.

As of `v0.0.9`, this guide reflects the shipped split where direct `data query` owns SQL execution, accepted header-mapping reuse, and accepted source-shape replay, while reviewed source-shape generation still begins on the `data extract` lane.

For natural-language SQL drafting, use the separate `data query codex` lane documented in `docs/guides/data-query-codex-usage.md`.
For materializing one shaped table without SQL, use `docs/guides/data-extract-usage.md`.
For reviewed source-shape artifacts and the current shape-first direct CLI workflow, see `docs/guides/data-source-shape-usage.md`.
For reviewed semantic header suggestions and the shared JSON artifact contract, see `docs/guides/data-schema-and-mapping-usage.md`.

Current boundary:

- one input file per invocation
- SQL is required through `--sql`
- built-in inputs: `.csv`, `.tsv`, `.parquet`, `.duckdb`
- extension-backed inputs: `.sqlite`, `.sqlite3`, `.xlsx`
- workspace relation binding is available through repeatable or comma-separated `--relation <binding>`
- workspace mode is currently supported for SQLite and DuckDB-file inputs
- explicit headerless CSV and TSV interpretation is available through `--no-header`
- explicit Excel shaping is available through `--range <A1:Z99>`
- explicit Excel body-start selection is available through `--body-start-row <n>`
- explicit Excel header selection is available through `--header-row <n>`
- accepted source-shape replay is available through `--source-shape <path>` for Excel inputs
- accepted semantic header renames can be reused through `--header-mapping <path>`
- reviewed semantic header suggestions can be requested through `--codex-suggest-headers`
- default output: bounded terminal table
- machine-readable stdout: `--json`
- file output: `--output <path>` with `.json` or `.csv`
- interactive mode is available through `cdx-chores interactive`; see `docs/guides/data-query-interactive-usage.md`

### Support matrix

| Input family | Single-source query | Workspace query | Notes                                                                           |
| ------------ | ------------------- | --------------- | ------------------------------------------------------------------------------- |
| CSV / TSV    | yes                 | no              | one logical table only                                                          |
| Parquet      | yes                 | no              | one logical table only                                                          |
| SQLite       | yes                 | yes             | `--source` or repeatable `--relation`                                           |
| DuckDB-file  | yes                 | yes             | `.duckdb` auto-detect; generic `*.db` requires explicit `--input-format duckdb` |
| Excel        | yes                 | no              | workbook workspace support remains deferred                                     |

Important distinction:

- workspace relation binding is not the same feature as multi-file relation assembly
- lists, globs, and `union_by_name` style multi-file scans remain a separate future area

Current intent:

- use `data query` when you already know the SQL you want to run
- use `data query` when `data extract` is too narrow for the transformation you need, even if the input is not Excel
- use `--output` on `data query` when you want SQL-backed materialization rather than bounded terminal output

### Direct CLI vs interactive mode

Use direct CLI when you already know the SQL or want a scriptable one-shot command.
Use interactive mode when you want the CLI to inspect the source first, help shape it, and guide SQL authoring before execution.

```text
Direct CLI: cdx-chores data query ...

input + flags + SQL
        |
        v
shape source if needed
        |
        v
execute query
        |
        v
table output | JSON stdout | file output


Interactive: cdx-chores interactive -> data -> query

choose input
        |
        v
inspect source
        |
        v
shape/review if needed
        |
        v
choose SQL authoring mode
(manual | formal-guide | Codex Assistant)
        |
        v
review SQL and confirm execution
        |
        v
choose output mode
```

### Command shape

```bash
cdx-chores data query <input> --sql "<query>" [--input-format <format>] [--source <name>] [--relation <binding>] [--range <A1:Z99>] [--source-shape <path>] [--no-header] [--body-start-row <n>] [--header-row <n>] [--header-mapping <path>] [--install-missing-extension] [--rows <n>] [--json] [--pretty] [--output <path>] [--overwrite]
cdx-chores data query <input> --codex-suggest-headers [--write-header-mapping <path>] [--input-format <format>] [--source <name>] [--range <A1:Z99>] [--source-shape <path>] [--no-header] [--body-start-row <n>] [--header-row <n>] [--overwrite]
```

Supported `--input-format` values:

- `csv`
- `tsv`
- `parquet`
- `sqlite`
- `duckdb`
- `excel`

Examples:

```bash
cdx-chores data query ./examples/playground/data-query/basic.csv --sql "select id, name from file order by id"
cdx-chores data query ./examples/playground/data-query/basic.tsv --sql "select status, count(*) as total from file group by status order by status" --rows 10
cdx-chores data query ./examples/playground/data-query-probe/auto-headerless.csv --no-header --sql "select column_1, column_2 from file order by column_1"
cdx-chores data query ./examples/playground/data-query/basic.parquet --sql "select id, name from file order by id" --json
cdx-chores data query ./examples/playground/data-query/basic.csv --sql "select * from file order by id" --output ./examples/playground/.tmp-tests/data-query-basic.json --pretty --overwrite
cdx-chores data query ./examples/playground/data-query/multi.xlsx --source Summary --range A1:B3 --sql "select * from file order by id"
cdx-chores data query ./examples/playground/data-query-duckdb/multi.duckdb --source users --sql "select id, name from file order by id"
cdx-chores data query ./examples/playground/data-query-duckdb/multi.duckdb --relation users --relation events=analytics.events --sql "select users.name, events.event_type from users join events on users.id = events.user_id order by events.id"
cdx-chores data query ./examples/playground/data-query/multi.sqlite --relation users,entries=time_entries --sql "select users.name, entries.hours from users join entries on users.id = entries.entry_id order by users.id"
cdx-chores data query ./examples/playground/data-query-duckdb/multi.db --input-format duckdb --relation file --sql "select user_id, note from file order by user_id"
cdx-chores data query ./examples/playground/data-extract/messy.xlsx --source-shape ./shape.json --sql "select ID, item, status from file order by ID"
cdx-chores data query ./examples/playground/data-extract/stacked-merged-band.xlsx --source Sheet1 --range B7:BR20 --body-start-row 10 --header-row 7 --sql "select id, question, status, notes from file order by id"
cdx-chores data query ./examples/playground/data-query/generic.csv --codex-suggest-headers --write-header-mapping ./header-map.json
cdx-chores data query ./examples/playground/data-query/generic.csv --header-mapping ./header-map.json --sql "select id, status from file order by id"
```

### Source selection

`--source` is required for multi-object formats:

- SQLite: table or view name
- DuckDB-file: table or view selector, using `schema.table` where needed
- Excel: sheet name

`--relation` enters workspace mode and is currently valid only for SQLite and DuckDB-file inputs:

- bare `--relation users` means `users=users`
- one flag may also bundle multiple bindings, such as `--relation users,entries=time_entries`
- `--relation alias=source` binds a source under an explicit SQL relation name
- workspace mode starts as soon as one explicit `--relation` is present, even if only one relation is bound
- once any `--relation` is present, SQL must target the bound relation names instead of the implicit `file` alias
- single-source mode keeps the implicit compatibility table name `file`
- workspace mode does not inject `file` implicitly, but it does allow `file` as an explicit alias when you bind it yourself
- that means `--relation file` and `--relation file=users` are both valid workspace bindings

`--range` is valid only for Excel inputs and narrows the selected sheet before the logical table `file` is created.
Other input formats reject `--range`.

`--no-header` is valid only for CSV and TSV inputs:

- it keeps row 1 in the data row set
- it generates deterministic placeholder names such as `column_1`, `column_2`, ...
- when reviewed header mappings are written from an explicit `--no-header` run, that explicit headerless choice becomes part of the exact-match reuse context

`--body-start-row <n>` and `--header-row <n>` are also valid only for Excel inputs:

- both use absolute worksheet row numbering
- `body-start-row` marks where logical body rows begin
- when `--range` is present, each row must fall inside that rectangle
- when both rows are present, `body-start-row` must be greater than `header-row`
- `body-start-row` changes import-time shaping instead of acting as a later SQL filter

`--source-shape <path>` is also valid only for Excel inputs:

- it replays an accepted reviewed source-shape artifact before SQL execution continues
- replay is strict exact-match against the current input path, format, and artifact source
- it replaces explicit shape flags instead of merging with them
- direct `data query` is the replay consumer in the current product split; reviewed artifact generation still starts with `data extract --codex-suggest-shape`
- do not combine it with:
  - `--source`
  - `--range`
  - `--header-row`
  - `--body-start-row`

Examples:

```bash
cdx-chores data query ./examples/playground/data-query/multi.sqlite --source users --sql "select * from file limit 20"
cdx-chores data query ./examples/playground/data-query-duckdb/multi.duckdb --source users --sql "select * from file limit 20"
cdx-chores data query ./examples/playground/data-query-duckdb/multi.duckdb --relation users --relation events=analytics.events --sql "select users.name, events.event_type from users join events on users.id = events.user_id order by events.id"
cdx-chores data query ./examples/playground/data-query/multi.sqlite --relation users,entries=time_entries --sql "select users.name, entries.hours from users join entries on users.id = entries.entry_id order by users.id"
cdx-chores data query ./examples/playground/data-query-duckdb/multi.db --input-format duckdb --relation file --sql "select * from file limit 20"
cdx-chores data query ./examples/playground/data-query/multi.xlsx --source Summary --sql "select * from file"
cdx-chores data query ./examples/playground/data-query/multi.xlsx --source Summary --range A1:B3 --sql "select * from file"
cdx-chores data query ./examples/playground/data-extract/stacked-merged-band.xlsx --source Sheet1 --range B7:BR20 --body-start-row 10 --header-row 7 --sql "select id, question, status, notes from file order by id"
```

### Shape-first CLI workflow

When a workbook is messy enough that you would normally use interactive `data query` to inspect the sheet, review shaping, and only then author SQL, the direct-CLI equivalent is now:

1. use direct `data extract` reviewed shaping to discover and confirm the deterministic source shape
2. rerun `data query` with `--source-shape <path>` plus `--sql`

ASCII flow:

```text
data extract --codex-suggest-shape
        |
        v
review accepted shape
(source / range / header-row / body-start-row)
        |
        v
data query --source-shape <path> --sql ...
```

Why this is the current direct-CLI pattern:

- interactive `data query` already follows the same product rhythm in one guided session:
  - inspect source
  - review shape if needed
  - author SQL against the accepted scope
- direct CLI keeps reviewed reusable source-shape generation on the `data extract` lane today
- direct `data query` now replays the accepted reviewed shape artifact without making query a second shape-artifact producer
- explicit CSV or TSV `--no-header` stays a direct query flag today rather than part of the reviewed source-shape artifact layer

Recommended direct-CLI pattern today:

```bash
cdx-chores data extract ./examples/playground/data-extract/stacked-merged-band.xlsx --source Sheet1 --codex-suggest-shape --write-source-shape ./stacked.shape.json
```

Then inspect the accepted artifact and rerun `data query` with the same accepted scope:

```bash
cdx-chores data query ./examples/playground/data-extract/stacked-merged-band.xlsx --source-shape ./stacked.shape.json --sql "select id, question, status, notes from file order by id"
```

Practical reading:

- use `data extract --codex-suggest-shape` when you need help finding the correct deterministic table scope
- use `data query --source-shape <path>` once you have an accepted reviewed scope and want filtering, projection, aggregation, or SQL-backed output
- this is the current direct-CLI way to reach the same shape-first outcome that interactive `data query` reaches in one guided flow

Current limitation:

- direct `data query codex` still takes explicit shape flags only in this slice
- direct `data query codex` does not currently accept `--source-shape <path>`
- this replay pass does not change the `data query codex` command surface

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
- optional `noHeader`, `source`, `range`, `bodyStartRow`, and `headerRow` must also match exactly when present

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
- built-in formats that work when DuckDB itself is available
- extension-backed formats that also depend on DuckDB extension loadability
- whether extension installability appears blocked by the current environment

For extension-backed formats, `detected support=yes` does not mean the format is queryable right now. The capability line turns green only when the required DuckDB extension is currently loadable.

DuckDB-file is reported as built-in DuckDB support and does not require a managed extension.

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

The repo includes a dedicated deterministic fixture generator for the lighter `data query` smoke inputs, plus a separate DuckDB-only generator for the heavier database files.

Reset the manual smoke fixtures under `examples/playground/data-query/`:

```bash
node scripts/generate-data-query-fixtures.mjs reset
```

Reset the DuckDB manual smoke fixtures under `examples/playground/data-query-duckdb/`:

```bash
node scripts/generate-data-query-duckdb-fixtures.mjs reset
```

Reset the checked-in lighter test fixtures under `test/fixtures/data-query/`:

```bash
node scripts/generate-data-query-fixtures.mjs reset --output-dir test/fixtures/data-query
```

The lightweight generator is independent from the preview fixture scripts and covers representative CSV, TSV, Parquet, SQLite, and Excel inputs, including multi-object SQLite and Excel fixtures for `--source`.

The DuckDB-only generator writes the same representative catalog twice as `multi.duckdb` and `multi.db` so manual smoke tests can cover both the preferred extension and the generic-extension path.
