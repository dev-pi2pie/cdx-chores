## Interactive `data query`

Use interactive mode when you want the CLI to inspect the input first, then help you author or review SQL before execution.

For the shared JSON artifact contract used by reviewed semantic header suggestions, see `docs/guides/data-schema-and-mapping-usage.md`.

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
4. for Excel, optionally enter a `range` before schema inspection
5. inspect schema and sample rows from the current shaped source
6. when a raw whole-sheet Excel schema looks strongly suspicious, choose how to continue:
   - keep as-is
   - enter a range manually
   - ask Codex to suggest shaping
7. after accepted source-shape changes, re-inspect before SQL authoring
8. when generated placeholder columns are present, optionally review semantic header suggestions before SQL authoring
9. choose one mode:
   - `manual`
   - `formal-guide`
   - `Codex Assistant`
10. review the generated SQL
11. explicitly confirm execution
12. choose one output mode:
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
- Excel also supports optional `range` shaping before SQL authoring
- if whole-sheet Excel introspection looks structurally suspicious, the flow can keep the current shape, accept a manual range, or ask Codex to suggest shaping before continuing
- merged-sheet whole-sheet views that collapse into one visible column can also trigger reviewed shaping before SQL authoring
- the selected source is always exposed to SQL as the logical table `file`

### Interactive Header Review

When the current shaped source exposes generated placeholder columns such as `column_1`, `column_2`, ... the interactive flow can review semantic header suggestions before SQL authoring.

That placeholder contract is shared even when the underlying engine originally exposes headerless columns with names such as `column0`, `column1`, ... .

The first review surface stays intentionally small:

- `Accept all`
- `Edit one`
- `Keep generated names`

Accepted suggestions are re-inspected before SQL authoring continues.

Interactive review persistence:

- reviewed source-shape and semantic header decisions stay in memory for the current interactive session
- interactive mode does not currently write source-shape or header-mapping JSON artifacts
- use direct CLI reviewed flows when you want reusable artifact files

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
