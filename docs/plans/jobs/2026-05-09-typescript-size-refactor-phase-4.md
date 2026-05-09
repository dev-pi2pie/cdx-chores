---
title: "TypeScript size refactor phase 4"
created-date: 2026-05-09
modified-date: 2026-05-09
status: completed
agent: codex
---

## Goal

Implement Phase 4 from `docs/plans/plan-2026-05-09-typescript-size-refactor-implementation.md` by splitting the data-query action and Codex query drafting core into concise modules without changing CLI behavior, prompt wording, or public imports.

## What Changed

- Replaced `src/cli/actions/data-query.ts` with `src/cli/actions/data-query/index.ts` as the public action facade.
- Extracted option and format validation into `src/cli/actions/data-query/validate.ts`.
- Extracted source-shape replay, single-source setup, and workspace preparation into `src/cli/actions/data-query/shape-resolution.ts`.
- Extracted header-mapping replay and Codex header suggestion orchestration into `src/cli/actions/data-query/header-suggestion.ts`.
- Extracted JSON/table/file output handling into `src/cli/actions/data-query/output.ts`.
- Kept `actionDataQuery` and `DataQueryOptions` available from the existing `src/cli/actions/data-query` import surface.
- Replaced `src/cli/data-query/codex.ts` with a thin facade over `view.ts`, `prompt.ts`, `parse.ts`, `render.ts`, and `runner.ts`.
- Preserved the existing Codex query prompt wording, editor template wording, structured response parsing, and draft rendering surface.
- Split the data-query action and Codex action/command tests into behavior-owned suites while preserving all existing assertions.

## Review

- `ts_structure_refactorer` implemented the Phase 4 split with ownership limited to `src/cli/actions/data-query.ts`, `src/cli/actions/data-query/**`, and `src/cli/data-query/**`.
- `ts_structure_refactorer` reported that `actionDataQuery`, `DataQueryOptions`, and the existing `src/cli/data-query/codex` exports remain stable through facades.
- `test_reviewer` found missing malformed/incomplete Codex draft payload coverage after the `parse.ts` split. The follow-up added action-level regression tests for malformed JSON and missing SQL fields.

## Verification

```text
bun test test/cli-actions-data-query.test.ts test/cli-actions-data-query-workspace.test.ts test/cli-actions-data-query-headers.test.ts test/cli-actions-data-query-header-artifacts.test.ts test/cli-actions-data-query-shape.test.ts test/cli-actions-data-query-validation.test.ts test/cli-actions-data-query-artifact-validation.test.ts test/cli-actions-data-query-codex.test.ts test/cli-actions-data-query-codex-workspace.test.ts test/cli-actions-data-query-codex-prompt.test.ts test/cli-actions-data-query-codex-validation.test.ts test/cli-command-data-query-codex.test.ts test/cli-command-data-query-codex-workspace.test.ts test/cli-command-data-query-codex-validation.test.ts
bun test test/cli-actions-data-query-codex-validation.test.ts
bun run lint
bun run format:check
```

Results:

- Focused Phase 4 split tests: 78 pass, 0 fail
- Codex parse coverage follow-up: included in final focused validation pass, 259 pass, 0 fail across Phase 4/5 focused suites
- Lint: 0 warnings, 0 errors
- Format check: passed

## Related Research

- `docs/researches/research-2026-05-09-typescript-size-refactor-scan.md`

## Related Plans

- `docs/plans/plan-2026-05-09-typescript-size-refactor-implementation.md`
