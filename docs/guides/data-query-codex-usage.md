## `data query codex`

`data query codex` is the natural-language drafting lane for SQL against one local input file. It inspects the selected data source or workspace first, drafts SQL second, and does not execute the drafted SQL automatically.

As of `v0.0.9`, this lane is still intentionally narrower than direct `data query`: it accepts explicit shape flags such as `--range`, `--body-start-row`, and `--header-row`, but it does not replay reviewed `--source-shape` artifacts and it does not own semantic header-mapping reuse.

Current boundary:

- one input file per invocation
- intent is required through `--intent`
- built-in inputs: `.csv`, `.tsv`, `.parquet`, `.duckdb`
- extension-backed inputs: `.sqlite`, `.sqlite3`, `.xlsx`
- workspace relation binding is available through repeatable or comma-separated `--relation <binding>` for SQLite and DuckDB-file inputs
- explicit Excel shaping is available through `--range <A1:Z99>`
- explicit Excel body-start selection is available through `--body-start-row <n>`
- explicit Excel header selection is available through `--header-row <n>`
- no reviewed `--source-shape <path>` replay in this lane
- no direct `--header-mapping <path>` reuse in this lane
- default output: human-readable assistant summary plus drafted SQL
- shell-friendly output: `--print-sql`
- no `--execute` in the first pass

### Support matrix

| Input family | Single-source drafting | Workspace drafting | Notes                                                                           |
| ------------ | ---------------------- | ------------------ | ------------------------------------------------------------------------------- |
| CSV / TSV    | yes                    | no                 | one logical table only                                                          |
| Parquet      | yes                    | no                 | one logical table only                                                          |
| SQLite       | yes                    | yes                | `--source` or repeatable `--relation`                                           |
| DuckDB-file  | yes                    | yes                | `.duckdb` auto-detect; generic `*.db` requires explicit `--input-format duckdb` |
| Excel        | yes                    | no                 | workbook workspace support remains deferred                                     |

### Command shape

```bash
cdx-chores data query codex <input> --intent "<text>" [--input-format <format>] [--source <name>] [--relation <binding>] [--range <A1:Z99>] [--body-start-row <n>] [--header-row <n>] [--print-sql]
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
cdx-chores data query codex ./examples/playground/data-query/basic.csv --intent "show id and name ordered by id"
cdx-chores data query codex ./examples/playground/data-query/basic.parquet --intent "count rows" --print-sql
cdx-chores data query codex ./examples/playground/data-query/multi.sqlite --source users --intent "list active users ordered by id"
cdx-chores data query codex ./examples/playground/data-query-duckdb/multi.duckdb --source users --intent "list users ordered by id"
cdx-chores data query codex ./examples/playground/data-query-duckdb/multi.duckdb --relation users --relation events=analytics.events --intent "join users with analytics events"
cdx-chores data query codex ./examples/playground/data-query/multi.sqlite --relation users,entries=time_entries --intent "join users with time entries"
cdx-chores data query codex ./examples/playground/data-query-duckdb/multi.db --input-format duckdb --relation file --intent "show notes from the file table"
cdx-chores data query codex ./examples/playground/data-query/multi.xlsx --source Summary --intent "show status counts by name"
cdx-chores data query codex ./examples/playground/data-query/multi.xlsx --source Summary --range A1:B3 --intent "show ids and names"
cdx-chores data query codex ./examples/playground/data-extract/stacked-merged-band.xlsx --source Sheet1 --range B7:BR20 --body-start-row 10 --header-row 7 --intent "show id, question, status, and notes ordered by id"
```

### Execution split

Keep the two lanes separate:

- `data query` executes SQL you already know
- `data query codex` drafts SQL from natural-language intent

The first `data query codex` implementation is advisory only. It always shows the drafted SQL and does not run it for you. `--execute` is intentionally not implemented yet.

If you need SQL against an accepted reviewed source shape, use the current two-step direct-CLI flow instead:

1. `data extract --codex-suggest-shape`
2. inspect the artifact
3. `data query --source-shape <path> --sql ...`

### Source selection

`--source` is required for multi-object single-source formats:

- SQLite: table or view name
- DuckDB-file: table or view selector, using `schema.table` where needed
- Excel: sheet name

`--relation` enters workspace drafting mode and is currently valid only for SQLite and DuckDB-file inputs:

- bare `--relation users` means `users=users`
- one flag may also bundle multiple bindings, such as `--relation users,entries=time_entries`
- `--relation alias=source` binds a source under an explicit SQL relation name
- workspace mode starts as soon as one explicit `--relation` is present, even if only one relation is bound
- once any `--relation` is present, Codex is instructed to use only those relation names instead of the implicit `file` table
- single-source mode keeps the implicit compatibility table name `file`
- workspace mode does not inject `file` implicitly, but it does allow `file` as an explicit alias when you bind it yourself
- that means `--relation file` and `--relation file=users` are both valid workspace bindings

`--range` is valid only for Excel inputs and narrows the selected sheet before bounded introspection is collected for Codex drafting.

`--body-start-row <n>` and `--header-row <n>` are also valid only for Excel inputs:

- both use absolute worksheet row numbering
- `body-start-row` marks where logical body rows begin before introspection is collected
- when both rows are present, `body-start-row` must be greater than `header-row`

Examples:

```bash
cdx-chores data query codex ./examples/playground/data-query/multi.sqlite --source users --intent "list users ordered by id"
cdx-chores data query codex ./examples/playground/data-query-duckdb/multi.duckdb --source users --intent "list users ordered by id"
cdx-chores data query codex ./examples/playground/data-query-duckdb/multi.duckdb --relation users --relation events=analytics.events --intent "join users with analytics events"
cdx-chores data query codex ./examples/playground/data-query/multi.sqlite --relation users,entries=time_entries --intent "join users with time entries"
cdx-chores data query codex ./examples/playground/data-query-duckdb/multi.db --input-format duckdb --relation file --intent "show notes from the file table"
cdx-chores data query codex ./examples/playground/data-query/multi.xlsx --source Summary --intent "show ids and names"
cdx-chores data query codex ./examples/playground/data-query/multi.xlsx --source Summary --range A1:B3 --intent "show ids and names"
cdx-chores data query codex ./examples/playground/data-extract/stacked-merged-band.xlsx --source Sheet1 --range B7:BR20 --body-start-row 10 --header-row 7 --intent "show id, question, status, and notes ordered by id"
```

Workspace drafting remains distinct from multi-file relation assembly. File lists, globs, and `union_by_name`-style multi-file scans are still a separate future area rather than part of the current `data query codex` contract.

Single-object inputs do not need `--source`.

### Output modes

- default output writes a human-readable summary to stdout:
  - detected format
  - selected source when present
  - bound relations when workspace mode is active
  - selected range when present
  - selected body start row when present
  - selected header row when present
  - concise schema summary
  - bounded sample rows, grouped per relation in workspace mode
  - drafted SQL revealed under a dedicated `SQL:` label on its own line
- `--print-sql` writes SQL only to stdout as one copyable line
- diagnostics and failures stay on stderr

When stdout is a TTY, the CLI shows transient progress while it is working:

- an explicit introspection step first
- a mutable `Thinking` status while Codex drafting is running
- the mutable status line is cleared before the final result is rendered
- the human-readable summary uses CLI color styling for faster scanning
- the `SQL` label and the revealed SQL text use different colors in TTY output

When stdout is not a TTY, the command keeps stdout stable for piping and shell workflows.

### Doctor

Use `cdx-chores doctor` before relying on Codex drafting in a shell workflow.

The doctor report exposes `data query codex` separately from DuckDB format capability and reports:

- configured support
- auth/session availability
- ready-to-draft availability

`ready-to-draft` is true only when both Codex drafting signals and DuckDB introspection support are available in the current environment.
