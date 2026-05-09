---
title: "TypeScript size refactor scan"
created-date: 2026-05-09
status: completed
agent: codex
---

## Goal

Review current `src/` and `test/` TypeScript files that are larger than 300 lines and identify the safest concise modularization route.

This is research only. It records the current size signal, the read-only `ts_structure_planner` recommendation, and the implementation boundaries that should be preserved before any files move.

## Scope

In scope:

- `src/` and `test/` TypeScript files over 300 lines
- mixed-responsibility source files where size creates maintenance risk
- large test files that should be split by behavior surface
- behavior-preserving module boundaries with stable `index.ts` facades

Out of scope:

- implementation changes
- command behavior changes
- prompt wording changes
- broad package layout changes outside the oversized-file refactor

## Method

Inputs used:

- `wc -l` scan over TypeScript files in `src/` and `test/`
- quick symbol/import inspection of the largest source and test files
- read-only `ts_structure_planner` review of the oversized-file list
- prior repo convention that nontrivial refactors should start with research before implementation

## Current Inventory

Current scan found 32 `src` files and 30 `test` files over 300 lines.

### Source Files Over 300 Lines

| Lines | File |
| ---: | --- |
| 627 | `src/cli/rename/planner.ts` |
| 622 | `src/cli/interactive/rename-cleanup.ts` |
| 587 | `src/cli/actions/rename/codex.ts` |
| 506 | `src/cli/prompts/path-inline.ts` |
| 503 | `src/cli/interactive/data-query/sql/formal-guide.ts` |
| 483 | `src/cli/interactive/data-query/source-shape.ts` |
| 477 | `src/cli/data-query/codex.ts` |
| 463 | `src/cli/duckdb/xlsx-sources.ts` |
| 444 | `src/cli/data-stack/plan/parse.ts` |
| 429 | `src/cli/actions/data-query.ts` |
| 428 | `src/cli/interactive/data/extract.ts` |
| 421 | `src/cli/interactive/rename.ts` |
| 419 | `src/cli/data-stack/codex-report/validation.ts` |
| 405 | `src/cli/interactive/data/stack/source-discovery.ts` |
| 381 | `src/cli/actions/markdown.ts` |
| 378 | `src/cli/prompts/text-inline.ts` |
| 365 | `src/cli/rename-plan-csv.ts` |
| 363 | `src/cli/rename-preview.ts` |
| 360 | `src/cli/commands/rename.ts` |
| 357 | `src/cli/duckdb/header-mapping/artifact.ts` |
| 355 | `src/cli/duckdb/extensions.ts` |
| 345 | `src/cli/actions/font-check.ts` |
| 344 | `src/cli/data-preview/source.ts` |
| 344 | `src/cli/actions/rename/cleanup.ts` |
| 321 | `src/cli/data-stack/rows.ts` |
| 318 | `src/cli/interactive/data/stack/codex-review.ts` |
| 317 | `src/utils/exif.ts` |
| 315 | `src/fonts/coverage.ts` |
| 314 | `src/cli/interactive/data-query/execution.ts` |
| 311 | `src/cli/markdown-pdf/profile/normalize.ts` |
| 311 | `src/cli/duckdb/query/prepare-source.ts` |
| 310 | `src/cli/actions/rename/cleanup-planner.ts` |

### Test Files Over 300 Lines

| Lines | File |
| ---: | --- |
| 2855 | `test/fonts.test.ts` |
| 2789 | `test/cli-interactive-routing.test.ts` |
| 1626 | `test/cli-actions-md-to-pdf.test.ts` |
| 1226 | `test/cli-actions-data-query.test.ts` |
| 1099 | `test/cli-command-data-query.test.ts` |
| 930 | `test/cli-actions-data-extract.test.ts` |
| 833 | `test/cli-interactive-rename.test.ts` |
| 743 | `test/cli-command-data-extract.test.ts` |
| 675 | `test/cli-command-data-query-codex.test.ts` |
| 655 | `test/cli-actions-data-stack/validation.test.ts` |
| 637 | `test/cli-actions-video-gif.test.ts` |
| 564 | `test/cli-ux.test.ts` |
| 527 | `test/cli-actions-data-query-codex.test.ts` |
| 515 | `test/helpers/interactive-harness/mocks/data-query.ts` |
| 485 | `test/cli-command-data-stack/options.test.ts` |
| 447 | `test/cli-actions-doctor-markdown-video-deferred.test.ts` |
| 446 | `test/cli-actions-rename-cleanup-single.test.ts` |
| 434 | `test/data-source-shape.test.ts` |
| 429 | `test/data-stack-codex-report/apply.test.ts` |
| 429 | `test/cli-text-inline.test.ts` |
| 422 | `test/release-scripts.test.ts` |
| 414 | `test/cli-interactive-data-stack/discovery.test.ts` |
| 414 | `test/cli-fs-utils-rename-template.test.ts` |
| 404 | `test/cli-actions-rename-apply-validation.test.ts` |
| 396 | `test/adapters-docx-ooxml-metadata.test.ts` |
| 388 | `test/cli-interactive-data-stack/dry-run-write.test.ts` |
| 381 | `test/cli-path-inline.test.ts` |
| 362 | `test/cli-actions-rename-file.test.ts` |
| 360 | `test/cli-interactive-data-stack/codex-review.test.ts` |
| 311 | `test/data-stack-codex-report/validation.test.ts` |

## Key Findings

### 1. Rename is the highest-value first refactor lane

The largest current source hotspots are in rename:

- `src/cli/rename/planner.ts`
- `src/cli/interactive/rename-cleanup.ts`
- `src/cli/actions/rename/codex.ts`
- `src/cli/interactive/rename.ts`

The problem is not only file length. These files mix planning, template parsing, traversal, Codex candidate selection, progress UI, summaries, prompt flow, analyzer review, artifact handling, and apply-now behavior.

Recommended direction:

- split leaf planning and Codex analyzer modules before the interactive modules
- keep public entrypoints stable through folder `index.ts` facades
- reduce interactive files to orchestration once pure helpers have moved
- split rename tests alongside the source slices

### 2. Data-query is the next mixed-responsibility lane

The data-query files over 300 lines combine action orchestration, source shape collection, Codex prompt construction, SQL guide prompting, rendering, and optional extension behavior.

Primary candidates:

- `src/cli/actions/data-query.ts`
- `src/cli/data-query/codex.ts`
- `src/cli/interactive/data-query/source-shape.ts`
- `src/cli/interactive/data-query/sql/formal-guide.ts`
- `src/cli/interactive/data/extract.ts`
- `src/cli/duckdb/xlsx-sources.ts`

Recommended direction:

- split direct action validation, shape resolution, header suggestions, output writing, and facade exports
- split Codex prompt/view/parse/render/runner responsibilities
- split interactive source-shape prompting and introspection rendering
- split formal SQL guide operators, SQL builder, and prompt collection
- split large query/extract tests by action vs command and behavior surface

### 3. Some large modules are cohesive enough to defer

Several files are above the threshold but should not lead the refactor only because of size:

- `src/cli/prompts/path-inline.ts`
- `src/cli/prompts/text-inline.ts`
- `src/cli/data-stack/plan/parse.ts`
- `src/cli/data-stack/codex-report/validation.ts`
- `src/cli/data-stack/rows.ts`
- `src/cli/markdown-pdf/profile/normalize.ts`
- `src/cli/duckdb/query/prepare-source.ts`
- `src/fonts/coverage.ts`
- `src/utils/exif.ts`

The prompt modules are state-machine heavy and regression-prone. The data-stack and Markdown PDF modules are mostly cohesive contract code after prior refactors. These should be touch-driven follow-ups unless a concrete change requires movement.

### 4. Test splitting should follow behavior, not line ranges

The largest tests should not be split mechanically. Split them by product surface and assertion contract.

Recommended examples:

- `test/fonts.test.ts` into discovery, CLI, and coverage suites
- `test/cli-actions-md-to-pdf.test.ts` into options, profile, recipe, actions, and commands suites
- `test/cli-interactive-routing.test.ts` by top-level menu family after feature-specific tests are already owned elsewhere
- data-query and data-extract tests by action vs command, then single-source, workspace, header mapping, output, and failure modes
- rename interactive tests by cleanup, Codex cleanup, batch flow, and template prompt behavior

## Refactor Priority

Recommended order:

1. Rename core: `src/cli/rename/planner.ts` and `src/cli/actions/rename/codex.ts`
2. Rename interactive: `src/cli/interactive/rename-cleanup.ts`, then `src/cli/interactive/rename.ts`
3. Data-query action and Codex core: `src/cli/actions/data-query.ts`, then `src/cli/data-query/codex.ts`
4. Data-query interactive: source-shape, formal-guide, and extract flows
5. Secondary command families: Markdown action and large Markdown PDF/font tests
6. High-risk prompt state machines only after stronger surrounding tests are cleaner

## Implementation Recommendations

- Preserve current public import surfaces with `index.ts` facades.
- Keep domain modules pure where practical and keep interactive modules focused on prompts and terminal flow.
- Avoid deep imports from newly extracted internals outside the owning feature folder.
- Do not mix prompt wording changes with behavior-preserving refactors.
- Pair each source split with focused tests for that feature lane.
- Prefer smaller commits or phases over one broad repo-wide movement.

## Related Plans

- `docs/plans/plan-2026-05-09-typescript-size-refactor-implementation.md`

## References

- `docs/researches/research-2026-04-27-data-stack-typescript-refactor-scan.md`
- `docs/plans/plan-2026-04-27-data-stack-typescript-refactor-implementation.md`
- `DOCUMENTATION_POLICY.md`
