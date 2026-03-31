---
title: "Complete data query workspace Phase 5 and Phase 6"
created-date: 2026-03-31
status: completed
agent: codex
---

## Goal

Complete the remaining executable work from `docs/plans/plan-2026-03-31-data-query-workspace-implementation.md` by finishing the fixture/docs/test pass and landing DuckDB-file workspace support for `data query`.

## Scope

- `src/cli/duckdb/query/`
- `src/cli/actions/data-query.ts`
- `src/cli/actions/data-query-codex.ts`
- `src/cli/actions/doctor.ts`
- `src/cli/commands/data/query.ts`
- shared prompt/source-selection helpers that now also cover DuckDB-file source families
- `scripts/generate-data-query-fixtures.mjs`
- query, Codex, extract, doctor, interactive, and UX tests under `test/`
- query and extract guides under `docs/guides/`
- checklist/status updates in `docs/plans/plan-2026-03-31-data-query-workspace-implementation.md`

## Constraints

- preserve the current single-source `file` shorthand for non-workspace runs
- keep generic `*.db` paths explicit-only through `--input-format`
- keep Excel workspace support deferred
- keep multi-file relation assembly separate from workspace relation binding

## What Changed

- added `.duckdb` input detection and `duckdb` input-format support to the shared query source family
- added DuckDB-file source listing against attached catalogs, including schema-qualified selectors where required
- extended single-source and workspace query preparation to support DuckDB-file inputs
- kept workspace relation binding explicit for SQLite and DuckDB-file while preserving the old single-source `file` shorthand elsewhere
- added DuckDB-file direct query, workspace query, Codex drafting, source-listing, interactive workspace, and doctor coverage
- extended the deterministic data-query fixture generator with `multi.duckdb`
- updated the query, Codex, interactive query, and extract guides with:
  - support matrices
  - DuckDB-file examples
  - clearer separation between workspace relation binding and future multi-file relation assembly
- updated the active workspace implementation plan so:
  - Phase 5 is complete
  - Phase 6 is complete
  - the plan status is now `completed`
- landed direct `data extract` DuckDB-file parity through the shared source-family path and documented it in the extract guide

## Verification

- `bun test test/data-query-fixture-generator.test.ts test/cli-actions-data-query.test.ts test/cli-command-data-query.test.ts test/cli-actions-data-query-codex.test.ts test/cli-command-data-query-codex.test.ts test/cli-actions-data-extract.test.ts test/cli-command-data-extract.test.ts test/cli-interactive-routing.test.ts test/cli-actions-doctor-markdown-video-deferred.test.ts test/cli-ux.test.ts`
- `bun run lint`

## Related Plans

- `docs/plans/plan-2026-03-31-data-query-workspace-implementation.md`
- `docs/plans/plan-2026-03-31-data-extract-duckdb-file-parity.md`
- `docs/plans/plan-2026-03-18-data-extract-shaped-table-materialization.md`

## Related Research

- `docs/researches/research-2026-03-31-multi-source-query-workspace-contract.md`
