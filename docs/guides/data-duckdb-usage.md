---
title: "Data DuckDB Usage"
created-date: 2026-03-12
modified-date: 2026-11-06
status: completed
agent: codex
---

## `data duckdb`

`data duckdb` is the explicit DuckDB lifecycle lane for inspecting and installing the DuckDB extensions used by `data query` and `data extract`.

Current stable scope:

- DuckDB extension inspection through `doctor`
- explicit install commands for managed extensions
- managed extensions:
  - `sqlite`
  - `excel`
- no uninstall command in the current stable contract

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

This backend view is separate from top-level `cdx-chores doctor`, which reports workflow-level capability impact.

Reported installability is inferred from extension load errors. Actual cache-write and network failures are reported during explicit installation.

Inspection and ordinary query, extract and Parquet preview connections disable automatic extension installation and loading. Managed SQLite and Excel extensions are loaded explicitly from the matching cache. Missing extensions produce installation guidance without downloading or populating that cache. Use the explicit install commands or the query opt-in flag to authorize installation.

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

### DuckDB 2 migration

The `0.2.2-canary.2` baseline uses `@duckdb/node-api@2.0.0-r.1` with DuckDB `2.0.0`. Install matching extensions for the new runtime using the explicit commands above. An older runtime's cache does not satisfy that requirement.

Submitted SQL, including saved queries and Codex drafts, runs with DuckDB 2 semantics. Review these changes before replaying older SQL:

| Earlier behavior | DuckDB 2 behavior | Migration |
| --- | --- | --- |
| `~` matches the whole string | Matches a substring | Use `regexp_full_match` for whole-string matching. |
| `x -> x + 1` lambda | Disabled by default | Use `lambda x: x + 1`. |
| `2 * 3!` returns `720` | Returns `12` | Use `(2 * 3)!` for `720`. |
| `X'AB'` / `B'101'` are text | Produce `BLOB` / `BIT` | Use ordinary strings when text is intended. |
| Untyped CTAS `NULL` infers `INTEGER` | Infers a NULL-only type | Cast `NULL` to the intended column type. |
| Integer division/modulo by zero returns NULL | Raises an error | Use `TRY(...)` when NULL is intended. |
| Binder errors leave an explicit transaction usable | Abort the transaction | Roll back before continuing. |
| `preserve_identifier_case` is Boolean | Uses string values | Use `preserve_case` / `lowercase`. Boolean aliases still work. |

Queries are not automatically rewritten. See the [official migration guide](https://duckdb.org/docs/2.0/operations_manual/migration) for additional changes and the [data query guide](data-query-usage.md) for command usage.

DuckDB input files are attached read-only. DuckDB 2 reads older-format files without converting the source. New databases created with its default storage are unreadable by DuckDB 1.x. For files that must be read by 1.5.6, explicitly create them with `STORAGE_VERSION 'v1.5.6'`. This selects a file format independently of dependency pinning. The installed engine checks whether it supports the supplied target. See [storage compatibility](https://duckdb.org/docs/2.0/internals/storage).
