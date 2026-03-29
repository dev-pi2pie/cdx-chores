---
title: "TypeScript refactor scan for remaining structural hotspots"
created-date: 2026-03-19
modified-date: 2026-03-20
status: completed
agent: codex
---

## Goal

Identify the highest-value remaining TypeScript refactor targets in the repository after the previously completed CLI action and interactive module splits.

## Key Findings

### 1. `src/cli/interactive/data-query.ts` is the clearest remaining hotspot

- At roughly 1.4k lines, it mixes source selection, Excel source-shape review, header review, SQL authoring, query execution, output prompting, and DuckDB remediation in one module.
- This is not just a size issue. The file combines multiple user workflows and fallback paths that will keep colliding as data-query features grow.
- Recommended target shape:
  - `src/cli/interactive/data-query/index.ts`
  - `src/cli/interactive/data-query/source-selection.ts`
  - `src/cli/interactive/data-query/source-shape.ts`
  - `src/cli/interactive/data-query/header-review.ts`
  - `src/cli/interactive/data-query/sql/manual.ts`
  - `src/cli/interactive/data-query/sql/formal-guide.ts`
  - `src/cli/interactive/data-query/sql/codex.ts`
  - `src/cli/interactive/data-query/execution.ts`
  - `src/cli/interactive/data-query/duckdb-remediation.ts`
  - `src/cli/interactive/data-query/types.ts`

### 2. `src/command.ts` should be split before it grows further

- The file currently owns CLI bootstrap, global argument normalization, option parsers, and registration for every command family.
- This is a good next refactor because it is structurally large but behaviorally straightforward.
- Recommended target shape:
  - `src/cli/commands/index.ts`
  - `src/cli/commands/data.ts`
  - `src/cli/commands/rename.ts`
  - `src/cli/commands/markdown.ts`
  - `src/cli/commands/video.ts`
  - `src/cli/options/parsers.ts`
  - `src/cli/options/common.ts`

### 3. `src/adapters/codex/document-rename-titles.ts` is still too concentrated

- The adapter mixes file-type-specific evidence extraction for markdown, text, JSON, YAML, TOML, HTML, XML, PDF, and DOCX with prompt building, batching, retries, and Codex execution.
- The module already contains natural split points by file type and by orchestration concern.
- Recommended target shape:
  - `src/adapters/codex/document-rename/index.ts`
  - `src/adapters/codex/document-rename/types.ts`
  - `src/adapters/codex/document-rename/prompt.ts`
  - `src/adapters/codex/document-rename/batch.ts`
  - `src/adapters/codex/document-rename/extractors/markdown.ts`
  - `src/adapters/codex/document-rename/extractors/text.ts`
  - `src/adapters/codex/document-rename/extractors/structured.ts`
  - `src/adapters/codex/document-rename/extractors/html.ts`
  - `src/adapters/codex/document-rename/extractors/xml.ts`
  - `src/adapters/codex/document-rename/extractors/pdf.ts`
  - `src/adapters/codex/document-rename/extractors/docx.ts`

### 4. `src/cli/duckdb/query.ts` is a domain-service bottleneck

- The file owns format detection, Excel range parsing, source resolution, prepared relation construction, execution, introspection, and extension inspection.
- Existing folderized patterns in `src/cli/duckdb/header-mapping/` and `src/cli/duckdb/source-shape/` show the repo already has a good template for this split.
- Recommended target shape:
  - `src/cli/duckdb/query/index.ts`
  - `src/cli/duckdb/query/types.ts`
  - `src/cli/duckdb/query/formats.ts`
  - `src/cli/duckdb/query/excel-range.ts`
  - `src/cli/duckdb/query/source-resolution.ts`
  - `src/cli/duckdb/query/prepare-source.ts`
  - `src/cli/duckdb/query/execute.ts`
  - `src/cli/duckdb/query/introspection.ts`

### 5. `src/cli/fs-utils.ts` has a naming and ownership problem

- The file is not just filesystem utilities. It contains display-path helpers, safe file writes, rename-template parsing support, rename planning, and rename application.
- This is a boundary smell: it behaves like rename-domain infrastructure while presenting itself as a generic utility bucket.
- Recommended target shape:
  - `src/cli/path-utils.ts`
  - `src/cli/file-io.ts`
  - `src/cli/rename/planner.ts`
  - `src/cli/rename/apply.ts`

### 6. Data workflow duplication exists across action and interactive layers

- The same concepts recur across `src/cli/actions/data-extract.ts`, `src/cli/actions/data-query.ts`, and `src/cli/interactive/data.ts`:
  - reusable header-mapping flow
  - reusable source-shape flow
  - DuckDB extension remediation
  - output/write decisions
  - Codex-assisted workflow setup
- Recommended target shape:
  - `src/cli/data-workflows/header-mapping-flow.ts`
  - `src/cli/data-workflows/source-shape-flow.ts`
  - `src/cli/data-workflows/duckdb-remediation.ts`
  - `src/cli/data-workflows/output.ts`
  - `src/cli/data-workflows/interactive-session.ts`

### 7. `src/cli/interactive/rename-cleanup.ts` is a secondary refactor target

- The file mixes prompt flow, analyzer-review rendering, settings derivation, and apply orchestration.
- It is smaller than the data-query hotspot, but it follows the same workflow-concentration pattern.
- Recommended target shape:
  - `src/cli/interactive/rename-cleanup/index.ts`
  - `src/cli/interactive/rename-cleanup/prompts.ts`
  - `src/cli/interactive/rename-cleanup/analyzer-review.ts`
  - `src/cli/interactive/rename-cleanup/settings.ts`
  - `src/cli/interactive/rename-cleanup/apply-flow.ts`

## Implications or Recommendations

### Refactor priority

1. Split `src/command.ts`.
2. Extract shared data workflow helpers for query/extract.
3. Split `src/cli/interactive/data-query.ts`.
4. Split `src/cli/duckdb/query.ts`.
5. Split `src/adapters/codex/document-rename-titles.ts`.
6. Clean up `src/cli/fs-utils.ts`.

### Why this order

- `src/command.ts` is lower-risk than the data-query hotspot and improves repo navigation immediately.
- Shared data workflow extraction reduces duplication before the larger interactive/data-query split.
- `src/cli/interactive/data-query.ts` and `src/cli/duckdb/query.ts` should be handled as adjacent work because their responsibilities overlap.
- `src/adapters/codex/document-rename-titles.ts` is large, but more isolated than the CLI/data workflow bottlenecks.
- `src/cli/fs-utils.ts` should be cleaned up after the rename and data boundaries are more stable, unless its naming/ownership ambiguity starts causing active mistakes.

### Lower-priority candidates

- `src/cli/prompts/path-inline.ts` is still large, but recent prompt-module work already gave it supporting modules and it appears more cohesive than the top hotspots.
- `src/cli/actions/rename/cleanup.ts` and `src/cli/rename-preview.ts` are above the preferred file-size range, but they are not the main structural risk right now.

## Follow-up Scan (2026-03-20)

The highest-risk hotspots shifted after the recent command, interactive, and DuckDB folder splits landed.

Current follow-up priorities:

1. `src/cli/duckdb/query/prepare-source.ts`
2. `src/cli/interactive/data.ts`
3. `src/cli/actions/data-extract.ts`
4. `src/cli/commands/data.ts`
5. `src/cli/rename/planner.ts`

Updated notes:

- `src/cli/duckdb/query/prepare-source.ts` is now the clearest data-layer hotspot. It combines format-specific validation, DuckDB extension setup, Excel range normalization, retry behavior, temporary-view creation, header/body splitting, and final prepared-source assembly.
- `src/cli/interactive/data.ts` is now the clearest interactive hotspot. It mixes convert, preview, parquet preview, extract, contains-filter prompting, and the top-level action router in one file even though `src/cli/interactive/data-query/` is already split into focused modules.
- `src/cli/actions/data-extract.ts` is no longer just a thin action wrapper. It owns option validation, output serialization, Codex source-shape suggestion flow, and extraction orchestration. That is enough mixed responsibility to justify a split.
- `src/cli/commands/data.ts` is structurally repetitive rather than algorithmically complex. It is a good low-risk split candidate into per-subcommand registration helpers.
- `src/cli/rename/planner.ts` remains large because it combines template parsing, serial planning, directory walking, batch planning, and single-file planning. This is a valid refactor target, but it is slightly lower-risk and lower-urgency than the data workflow files above.

Current recommendation:

- use a targeted `ts_structure_refactorer` pass now, but scope it to the data workflow surface first rather than the entire `src/` tree
- keep `src/cli/prompts/path-inline.ts` and `src/cli/actions/rename/codex.ts` deferred for now because they are large but comparatively cohesive after prior supporting-module splits

## Related Plans

- `docs/plans/plan-2026-03-19-typescript-structural-refactor-sequencing.md`
- `docs/plans/archive/plan-2026-02-25-cli-actions-modularization.md`
- `docs/plans/archive/plan-2026-03-02-interactive-module-folder-refactor.md`

## References

- `docs/plans/archive/plan-2026-02-25-cli-actions-modularization.md`
- `docs/plans/archive/plan-2026-03-02-interactive-module-folder-refactor.md`
- `docs/plans/plan-2026-03-10-data-query-interactive-flow-implementation.md`
- `docs/plans/plan-2026-03-18-data-extract-interactive-and-public-smoke-fixtures.md`
