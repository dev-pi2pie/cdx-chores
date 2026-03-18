## `data query codex`

`data query codex` is the natural-language drafting lane for SQL against one local input file. It inspects the selected data source first, drafts SQL second, and does not execute the drafted SQL automatically.

Current boundary:

- one input file per invocation
- intent is required through `--intent`
- built-in inputs: `.csv`, `.tsv`, `.parquet`
- extension-backed inputs: `.sqlite`, `.sqlite3`, `.xlsx`
- explicit Excel shaping is available through `--range <A1:Z99>`
- default output: human-readable assistant summary plus drafted SQL
- shell-friendly output: `--print-sql`
- no `--execute` in the first pass

### Command shape

```bash
cdx-chores data query codex <input> --intent "<text>" [--input-format <format>] [--source <name>] [--range <A1:Z99>] [--print-sql]
```

Supported `--input-format` values:

- `csv`
- `tsv`
- `parquet`
- `sqlite`
- `excel`

Examples:

```bash
cdx-chores data query codex ./examples/playground/data-query/basic.csv --intent "show id and name ordered by id"
cdx-chores data query codex ./examples/playground/data-query/basic.parquet --intent "count rows" --print-sql
cdx-chores data query codex ./examples/playground/data-query/multi.sqlite --source users --intent "list active users ordered by id"
cdx-chores data query codex ./examples/playground/data-query/multi.xlsx --source Summary --intent "show status counts by name"
cdx-chores data query codex ./examples/playground/data-query/multi.xlsx --source Summary --range A1:B3 --intent "show ids and names"
```

### Execution split

Keep the two lanes separate:

- `data query` executes SQL you already know
- `data query codex` drafts SQL from natural-language intent

The first `data query codex` implementation is advisory only. It always shows the drafted SQL and does not run it for you. `--execute` is intentionally not implemented yet.

### Source selection

`--source` is required for multi-object formats:

- SQLite: table or view name
- Excel: sheet name

`--range` is valid only for Excel inputs and narrows the selected sheet before bounded introspection is collected for Codex drafting.

Examples:

```bash
cdx-chores data query codex ./examples/playground/data-query/multi.sqlite --source users --intent "list users ordered by id"
cdx-chores data query codex ./examples/playground/data-query/multi.xlsx --source Summary --intent "show ids and names"
cdx-chores data query codex ./examples/playground/data-query/multi.xlsx --source Summary --range A1:B3 --intent "show ids and names"
```

Single-object inputs do not need `--source`.

### Output modes

- default output writes a human-readable summary to stdout:
  - detected format
  - selected source when present
  - selected range when present
  - concise schema summary
  - bounded sample rows
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
