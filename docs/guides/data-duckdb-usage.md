## `data duckdb`

`data duckdb` is the explicit DuckDB lifecycle lane for inspecting and installing the DuckDB extensions used by `data query` and `data extract`.

Current first-pass scope:

- read-only DuckDB extension inspection through `doctor`
- explicit install commands for managed extensions
- managed extensions:
  - `sqlite`
  - `excel`
- no uninstall command in the current implementation

### Commands

Inspect current extension state:

```bash
cdx-chores data duckdb doctor
cdx-chores data duckdb doctor --json
```

Install one managed extension:

```bash
cdx-chores data duckdb extension install sqlite
cdx-chores data duckdb extension install excel
```

Install all managed extensions for the current DuckDB runtime:

```bash
cdx-chores data duckdb extension install --all-supported
```

### What `doctor` shows

`data duckdb doctor` is backend-oriented and reports:

- current DuckDB runtime version
- per-extension installed state
- per-extension loadability
- per-extension installability
- per-extension cache path information reported by DuckDB when available

User-facing cache paths are sanitized to use `$HOME/.duckdb/...` instead of revealing machine-specific absolute home paths.

### Relationship to `data query` and `data extract`

Use `data query` when you already know the SQL you want to run.

Use `data extract` when you want one shaped table materialized without SQL.

Use `data duckdb` when you need to inspect or repair DuckDB extension state before running `data query` or `data extract`.

If you want the query command itself to attempt one install-and-retry pass, use:

```bash
cdx-chores data query <input> --install-missing-extension --sql "<query>"
```

That flag only applies to extension-backed query formats:

- `sqlite`
- `excel`

Built-in DuckDB query formats such as `csv`, `tsv`, and `parquet` reject `--install-missing-extension`.

`data extract` does not currently expose an `--install-missing-extension` retry flag, so the intended repair flow for extract remains:

```bash
cdx-chores data duckdb doctor
cdx-chores data duckdb extension install sqlite
cdx-chores data duckdb extension install excel
```

### Versioned cache note

DuckDB caches extensions by runtime version under a path like:

```text
$HOME/.duckdb/extensions/<duckdb-version>/
```

That means one extension can be installed for the current runtime while another extension still exists only for an older DuckDB version. When that happens:

- top-level `cdx-chores doctor` reports the format-level capability difference
- `cdx-chores data duckdb doctor` shows the backend-oriented extension state and the DuckDB-reported install path when one exists
- `cdx-chores data duckdb extension install <name>` is the primary repair path

Manual cache cleanup should be treated as an advanced fallback, not the primary workflow.
