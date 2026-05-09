---
title: "TypeScript size refactor phase 5"
created-date: 2026-05-09
modified-date: 2026-05-09
status: completed
agent: codex
---

## Goal

Implement Phase 5 from `docs/plans/plan-2026-05-09-typescript-size-refactor-implementation.md` by splitting data-query interactive source-shape, formal SQL guide, data extract, and interactive harness mock modules into concise behavior-owned modules.

## What Changed

- Replaced `src/cli/interactive/data-query/source-shape.ts` with `src/cli/interactive/data-query/source-shape/index.ts` as the public facade.
- Extracted Excel range/header/body-start prompts into `src/cli/interactive/data-query/source-shape/excel-prompts.ts`.
- Extracted introspection summary rendering into `src/cli/interactive/data-query/source-shape/introspection-rendering.ts`.
- Extracted suspicious Excel shape detection into `src/cli/interactive/data-query/source-shape/suspicion.ts`.
- Extracted Codex source-shape suggestion review into `src/cli/interactive/data-query/source-shape/codex-shape.ts`.
- Replaced `src/cli/interactive/data-query/sql/formal-guide.ts` with a folder facade and split operator selection, SQL building, and prompt collection into focused modules.
- Replaced `src/cli/interactive/data/extract.ts` with a folder facade and split session collection, review checkpoint, output checkpoint, and shared extract types into focused modules.
- Replaced `test/helpers/interactive-harness/mocks/data-query.ts` with a folder facade and split query, workspace, Codex, header-mapping, and source-shape mocks into focused helpers.
- Split the data-query command, data-extract action, and data-extract command suites into behavior-owned files; the largest split suite is now below 300 lines.
- Kept existing imports stable through folder `index.ts` facades.

## Review

- Phase 5 was implemented locally after Phase 4 landed in the workspace.
- Extra interactive routing and formal-guide tests were run because the split touched interactive helper boundaries beyond the plan's minimum focused command.
- `maintainability_reviewer` found that the interactive harness Codex mock duplicated production Codex prompt/template assembly and that the harness installed all data-query mock families for every scenario. The follow-up made the Codex mock reuse the production prompt/template helpers and made data-query mock installation scenario-aware.
- `test_reviewer` found missing non-count formal-guide aggregate coverage and missing direct coverage for the scenario-aware harness mock gate. The follow-up added aggregate SQL builder tests and `test/interactive-harness-mock-gating.test.ts`.

## Verification

```text
bun test test/cli-command-data-query.test.ts test/cli-command-data-query-workspace.test.ts test/cli-command-data-query-duckdb-sources.test.ts test/cli-command-data-query-shape.test.ts test/cli-command-data-query-source-shape.test.ts test/cli-command-data-query-validation.test.ts test/cli-command-data-query-headers.test.ts test/cli-command-data-query-duckdb-lifecycle.test.ts test/cli-actions-data-extract.test.ts test/cli-actions-data-extract-sources.test.ts test/cli-actions-data-extract-review.test.ts test/cli-actions-data-extract-source-shape-review.test.ts test/cli-actions-data-extract-source-shape-reuse.test.ts test/cli-actions-data-extract-validation.test.ts test/cli-command-data-extract.test.ts test/cli-command-data-extract-shape.test.ts test/cli-command-data-extract-source-shape.test.ts test/cli-command-data-extract-review.test.ts test/data-source-shape.test.ts
bun test test/cli-command-data-query-workspace.test.ts test/cli-command-data-query-duckdb-sources.test.ts test/cli-command-data-query-shape.test.ts test/cli-command-data-query-source-shape.test.ts
bun test test/cli-interactive-routing.test.ts test/cli-interactive-data-query-formal-guide.test.ts test/interactive-harness-mock-gating.test.ts
bun run lint
bun run format:check
```

Results:

- Focused Phase 5 split tests: 99 pass, 0 fail
- Follow-up data-query command split tests: 21 pass, 0 fail
- Additional interactive routing/formal-guide/mock-gating tests after review fixes: 86 pass, 0 fail
- Final combined Phase 4/5 focused validation: 259 pass, 0 fail
- Lint: 0 warnings, 0 errors
- Format check: passed

## Related Research

- `docs/researches/research-2026-05-09-typescript-size-refactor-scan.md`

## Related Plans

- `docs/plans/plan-2026-05-09-typescript-size-refactor-implementation.md`
