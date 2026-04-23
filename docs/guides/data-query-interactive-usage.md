## Interactive `data query`

Use interactive mode when you want the CLI to inspect the input first, then help you author or review SQL before execution.

This is the interactive lane to prefer when `data extract` is too narrow for the transformation you need and you want output control without dropping to raw CLI flags immediately.

If the main task is multi-file assembly rather than SQL authoring, use `data stack` first and then query the merged output.

The current interactive flow mirrors the same shipped product split as the direct CLI: in-session shaping and header review can happen before SQL authoring, but reusable reviewed source-shape and header-mapping artifacts are still produced by the direct CLI reviewed flows.

For the shared JSON artifact contract used by reviewed semantic header suggestions, see `docs/guides/data-schema-and-mapping-usage.md`.
For reviewed source-shape artifacts and the shape-first direct CLI relationship, see `docs/guides/data-source-shape-usage.md`.
For assembling many local files or directories into one table before later SQL, see `docs/guides/data-stack-usage.md`.

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
3. for CSV and TSV, decide whether the input should be treated as headerless
4. when SQLite or DuckDB-file exposes multiple logical sources, choose query scope:
   - single-source
   - workspace
   - selecting workspace and binding even one relation still uses workspace aliasing; SQL review must target the chosen relation name rather than any implicit `file`
5. in single-source mode, select a SQLite table, DuckDB source, or Excel sheet when required
6. for Excel, optionally enter a `range` before schema inspection
7. inspect schema and sample rows from the current shaped source
8. when a raw whole-sheet Excel schema looks strongly suspicious, choose how to continue:
   - keep as-is
   - enter a range manually
   - ask Codex to suggest shaping
9. after accepted source-shape changes, re-inspect before SQL authoring
10. when generated placeholder columns are present, optionally review semantic header suggestions before SQL authoring
11. choose one mode:
   - single-source:
     - `manual`
     - `formal-guide`
     - `Codex Assistant`
   - workspace:
     - `manual`
     - `Codex Assistant`
12. review the generated SQL
13. explicitly confirm execution
14. if execution is declined or fails, choose the next step at SQL review:
   - revise within the current mode
   - use a mode-specific recovery action when available
   - change mode
   - cancel
15. choose one output mode:
   - terminal table
   - JSON stdout
   - file output
16. from output selection, either continue with the selected output, go back to SQL review, or cancel

### Support matrix

| Input family | Single-source interactive query | Workspace interactive query | Notes |
| --- | --- | --- | --- |
| CSV / TSV | yes | no | one logical table only |
| Parquet | yes | no | one logical table only |
| SQLite | yes | yes | scope chooser appears when multiple sources exist |
| DuckDB-file | yes | yes | scope chooser appears when multiple sources exist |
| Excel | yes | no | workbook workspace support remains deferred |

### Mode behavior

`manual`

- asks for one SQL string directly
- first pass stays single-line
- in workspace mode, SQL must target explicit relation names rather than the implicit single-source `file`
- selecting one relation in workspace mode still counts as workspace mode; SQL must use that alias
- SQL review actions use:
  - `Edit SQL`
  - `Change mode`
  - `Cancel`

`formal-guide`

- asks for columns, guided filters, optional aggregate summary intent, optional ordering, and optional SQL-level result limit
- builds deterministic SQL for the logical table `file`
- current guided filter set includes:
  - text matching:
    - `contains`
    - `starts with`
    - `ends with`
  - null checks:
    - `is null`
    - `is not null`
  - boolean-specialized checks:
    - `is true`
    - `is false`
  - emptiness checks:
    - `is empty`
    - `is not empty`
- `Maximum result rows (optional)` compiles to SQL `limit n`
- `Rows to show (optional)` remains separate and only bounds terminal table output
- SQL review actions use:
  - `Edit formal-guide answers`
  - `Change mode`
  - `Cancel`
- this mode is currently single-source only

`Codex Assistant`

- captures natural-language intent and drafts SQL against the current single-source table or workspace relations
- first asks `Use multiline editor?`
- if `No`, it uses a normal single-line prompt and `Enter` submits
- if `Yes`, it opens an editor seeded with compact query context comments:
  - single-source mode:
    - logical table name
    - detected format and selected source when relevant
    - schema summary
    - small sample rows summary
  - workspace mode:
    - bound relation names
    - per-relation schema summary
    - per-relation small sample rows summary
- comment lines that start with `#` are ignored when the editor content is submitted
- the cleaned intent is shown back before Codex drafting, and drafting only continues after explicit confirmation
- SQL review actions use:
  - `Revise intent`
  - `Regenerate SQL`
  - `Change mode`
  - `Cancel`

### Source binding

Interactive `data query` follows the same source contract as direct CLI query:

- CSV, TSV, and Parquet use one implicit source
- CSV and TSV can also switch into explicit headerless mode before SQL authoring
- SQLite requires choosing a table or view
- DuckDB-file requires choosing a table or view selector in single-source mode
- SQLite and DuckDB-file can switch into workspace mode when multiple sources are available
- Excel requires choosing a sheet
- Excel also supports optional `range` shaping before SQL authoring
- if whole-sheet Excel introspection looks structurally suspicious, the flow can keep the current shape, accept a manual range, or ask Codex to suggest shaping before continuing
- reviewed source-shape suggestions can now include `body-start-row` when a merged header band needs an explicit body boundary
- merged-sheet whole-sheet views that collapse into one visible column can also trigger reviewed shaping before SQL authoring
- in single-source mode, the selected source is exposed to SQL as the logical table `file`
- in workspace mode, SQL must target the explicit relation bindings chosen during workspace setup
- workspace mode does not inject `file` automatically, but interactive alias entry does allow `file` when you deliberately choose it
- when the selected backend object is literally named `file`, keeping the default workspace relation name `file` is valid

Workspace relation binding remains distinct from multi-file relation assembly. File lists, globs, and `union_by_name`-style multi-file scans are still a separate future area.

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
- accepted in-memory source shapes may include `range`, `header-row`, and `body-start-row`
- accepted in-memory CSV or TSV interpretation may include `--no-header`
- interactive mode does not currently write source-shape or header-mapping JSON artifacts
- use direct CLI reviewed flows when you want reusable artifact files:
  - `data extract --codex-suggest-shape`
  - `data query --codex-suggest-headers`
  - `data extract --codex-suggest-headers`

### Output rules

Interactive output choices map directly to the non-interactive `data query` contract:

- table output reuses bounded `--rows`
- JSON stdout reuses `--json` with optional pretty printing
- file output reuses `--output <path>` with `.json` or `.csv`
- JSON stdout and file output are mutually exclusive
- when no SQL `limit` is set, table output still uses bounded preview-style execution
- output review wording distinguishes:
  - SQL-level limit
  - table-preview rows

### Session tips

Interactive `data query` now uses one randomized flow-entry tip in TTY runs.

The tip is chosen from a small `data query`-specific pool, so one run may show abort guidance while another may show a short usage hint.

Current examples include:

- `Ctrl+C` aborts the current interactive session
- `manual` is the better lane for joins or custom SQL
- SQL `limit` and preview rows are separate controls
- `Rows to show` affects only terminal preview

### Notes

- SQL is always shown before execution
- `Codex Assistant` remains advisory only; it never executes SQL automatically
- checkpoint backtracking currently starts at:
  - mode selection
  - SQL review
  - output selection
- SQL execution failures return you to the shared SQL-review checkpoint instead of silently retrying
