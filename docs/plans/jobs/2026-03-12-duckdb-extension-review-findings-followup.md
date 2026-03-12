---
title: "Fix DuckDB extension lifecycle review findings"
created-date: 2026-03-12
status: completed
agent: codex
---

## Goal

Address the follow-up review findings in the DuckDB extension lifecycle implementation around reinstall behavior and cache-path reporting.

## What Changed

- changed DuckDB extension probing to read the real `install_path` from `duckdb_extensions()` instead of reconstructing a cache path from runtime/version/platform assumptions
- kept user-facing path sanitization in place while making the reported cache file and directory reflect DuckDB's actual install location
- changed the installed-but-unloadable remediation path to use `FORCE INSTALL` so explicit repair commands and `--install-missing-extension` can refresh a broken cached extension
- added regression coverage for:
  - installed-but-broken managed extensions that require a force reinstall
  - DuckDB-reported install paths that do not match the default `$HOME/.duckdb/...` layout

## Files

- `src/cli/duckdb/extensions.ts`
- `test/data-duckdb-extensions.test.ts`
- `docs/guides/data-duckdb-usage.md`

## Verification

- `bun test test/data-duckdb-extensions.test.ts test/cli-actions-data-query.test.ts test/cli-actions-doctor-markdown-video-deferred.test.ts test/cli-command-data-query.test.ts test/cli-interactive-routing.test.ts`

## Related Plans

- `docs/plans/plan-2026-03-12-duckdb-extension-lifecycle-for-data-query.md`

