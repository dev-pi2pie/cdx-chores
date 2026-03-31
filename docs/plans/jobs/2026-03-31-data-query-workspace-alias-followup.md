---
title: "Implement data query workspace alias follow-up"
created-date: 2026-03-31
modified-date: 2026-03-31
status: completed
agent: codex
---

## Goal

Implement the follow-up workspace alias contract so `data query` keeps implicit `file` only in single-source mode while allowing explicit workspace `file` bindings through `--relation`.

## Scope

- `src/cli/options/parsers.ts`
- `src/cli/duckdb/query/prepare-workspace.ts`
- `src/cli/interactive/data-query/source-selection.ts`
- `src/cli/commands/data/query.ts`
- query and Codex command/action coverage under `test/`
- interactive routing coverage under `test/`
- query, Codex, and interactive guides under `docs/guides/`
- checklist/status updates in `docs/plans/plan-2026-03-31-data-query-workspace-alias-followup.md`

## Constraints

- preserve implicit `file` in single-source mode
- allow explicit `file` in workspace mode
- keep `--relation` as the only workspace-binding surface
- keep exact source matching and explicit aliasing rules
- do not introduce `--workspace`
- preserve legitimate source selectors that contain commas when `--relation` bundles are used

## What Changed

- removed the workspace-only validation that rejected the alias `file`
- kept single-source query and Codex behavior unchanged so the implicit logical table remains `file`
- extended `--relation` parsing so one flag value may contain multiple comma-separated bindings
- fixed bundle parsing so quoted or escaped commas inside one source selector remain part of the same binding
- normalized workspace source resolution so quoted source names still map to the matching available SQLite or DuckDB source when appropriate
- kept workspace duplicate-alias and malformed-alias failures deterministic after parser expansion
- updated interactive workspace alias entry so `file` is accepted when chosen explicitly
- updated direct query, Codex drafting, interactive, and parser tests for:
  - explicit workspace `file`
  - comma-separated `--relation` bundles
  - quoted DuckDB relation sources that contain commas
  - duplicate aliases inside bundled and mixed bundled/repeated forms
- added regression coverage for quoted and escaped comma-containing `--relation` source selectors
- updated the query, Codex, and interactive guides to distinguish implicit single-source `file` from explicit workspace `file`
- updated the follow-up plan status to `completed` and marked its checklist items done
- ran maintainability, test, and docs reviewer passes and addressed the findings they reported before closing the change
- ran formatter remediation after the parser follow-up so the touched files match repository formatting rules

## Verification

- `bun test test/cli-options-parsers.test.ts test/cli-command-data-query.test.ts test/cli-command-data-query-codex.test.ts test/cli-actions-data-query.test.ts test/cli-actions-data-query-codex.test.ts test/cli-interactive-routing.test.ts`
- `bun test test/cli-command-data-query.test.ts`
- `bun test test/cli-options-parsers.test.ts test/cli-command-data-query.test.ts`
- `oxfmt --check src test scripts package.json tsconfig.json .oxlintrc.json .oxfmtrc.json`

## Related Plans

- `docs/plans/plan-2026-03-31-data-query-workspace-alias-followup.md`
- `docs/plans/plan-2026-03-31-data-query-workspace-implementation.md`

## Related Research

- `docs/researches/research-2026-03-31-workspace-file-alias-reservation-reconsideration.md`
- `docs/researches/research-2026-03-31-multi-source-query-workspace-contract.md`
