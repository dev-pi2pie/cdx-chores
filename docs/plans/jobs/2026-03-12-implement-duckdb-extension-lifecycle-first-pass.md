---
title: "Implement DuckDB extension lifecycle first pass"
created-date: 2026-03-12
status: completed
agent: codex
---

## Goal

Implement the first-pass DuckDB extension lifecycle improvements for `data query`, keeping `doctor` read-only while adding explicit CLI remediation paths and interactive guidance.

## Changes

- added shared DuckDB extension lifecycle helpers in `src/cli/duckdb/extensions.ts`
- added `--install-missing-extension` to `data query`
- kept install-attempt progress on stderr so stdout query payload contracts remain unchanged
- added `data duckdb doctor`
- added `data duckdb extension install <name>`
- added `data duckdb extension install --all-supported`
- updated top-level `doctor` to expose DuckDB runtime version in JSON payload and suggest the explicit install command for installable missing extensions
- updated interactive `data query` flows to print the exact CLI remediation command when an installable managed extension is missing
- shortened the manual troubleshooting section in `docs/guides/data-query-usage.md` and redirected users to the new CLI lifecycle surface
- added `docs/guides/data-duckdb-usage.md` for the dedicated DuckDB lifecycle command family
- marked the lifecycle plan as completed after landing the first-pass implementation

## Verification

- `bun test test/data-duckdb-extensions.test.ts test/cli-actions-data-query.test.ts test/cli-actions-doctor-markdown-video-deferred.test.ts test/cli-command-data-query.test.ts test/cli-interactive-routing.test.ts`
- `bun x tsc --noEmit`

## Related Plans

- `docs/plans/plan-2026-03-12-duckdb-extension-lifecycle-for-data-query.md`
- `docs/plans/plan-2026-03-10-data-query-cli-implementation.md`
- `docs/plans/plan-2026-03-10-data-query-codex-cli-drafting.md`

## Related Research

- `docs/researches/research-2026-03-09-data-query-scope-and-contract.md`
