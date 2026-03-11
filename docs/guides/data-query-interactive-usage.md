## Interactive `data query`

Use interactive mode when you want the CLI to inspect the input first, then help you author or review SQL before execution.

Start the flow with:

```bash
cdx-chores interactive
```

Choose:

1. `data`
2. `query`

Current interactive flow:

1. prompt for the input file
2. detect the input format, with override support when needed
3. select a SQLite table or Excel sheet when the input has multiple logical sources
4. inspect schema and sample rows
5. choose one mode:
   - `manual`
   - `formal-guide`
   - `Codex Assistant`
6. review the generated SQL
7. explicitly confirm execution
8. choose one output mode:
   - terminal table
   - JSON stdout
   - file output

### Mode behavior

`manual`

- asks for one SQL string directly
- first pass stays single-line

`formal-guide`

- asks for columns, simple filters, optional aggregate summary intent, and optional ordering
- builds deterministic SQL for the logical table `file`

`Codex Assistant`

- captures natural-language intent and drafts SQL against the logical table `file`
- first asks `Use multiline editor?`
- if `No`, it uses a normal single-line prompt and `Enter` submits
- if `Yes`, it opens an editor seeded with compact query context comments:
  - logical table name
  - detected format and selected source when relevant
  - schema summary
  - small sample rows summary
- comment lines that start with `#` are ignored when the editor content is submitted
- the cleaned intent is shown back before Codex drafting, and drafting only continues after explicit confirmation

### Source binding

Interactive `data query` follows the same source contract as direct CLI query:

- CSV, TSV, and Parquet use one implicit source
- SQLite requires choosing a table or view
- Excel requires choosing a sheet
- the selected source is always exposed to SQL as the logical table `file`

### Output rules

Interactive output choices map directly to the non-interactive `data query` contract:

- table output reuses bounded `--rows`
- JSON stdout reuses `--json` with optional pretty printing
- file output reuses `--output <path>` with `.json` or `.csv`
- JSON stdout and file output are mutually exclusive

### Notes

- SQL is always shown before execution
- `Codex Assistant` remains advisory only; it never executes SQL automatically
- SQL execution failures return you to revise or regenerate instead of silently retrying
