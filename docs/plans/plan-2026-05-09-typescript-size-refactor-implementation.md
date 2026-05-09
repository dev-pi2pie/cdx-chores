---
title: "TypeScript size refactor implementation"
created-date: 2026-05-09
modified-date: 2026-05-09
status: completed
agent: codex
---

## Goal

Refactor the current oversized TypeScript source and test files into concise, modular files without changing CLI behavior, prompt wording, output contracts, or public import surfaces.

This plan turns the size scan into a phased implementation path. It intentionally starts with the highest-value mixed-responsibility rename modules, then moves through data-query, tests, and lower-risk secondary cleanups.

## Related Research

- `docs/researches/research-2026-05-09-typescript-size-refactor-scan.md`
- `docs/researches/research-2026-04-27-data-stack-typescript-refactor-scan.md`
- `docs/researches/research-2026-03-19-typescript-refactor-scan.md`

## Related Plans

- `docs/plans/plan-2026-04-27-data-stack-typescript-refactor-implementation.md`
- `docs/plans/plan-2026-03-19-typescript-structural-refactor-sequencing.md`

## Implementation Records

- `docs/plans/jobs/2026-05-09-typescript-size-refactor-phase-1.md`
- `docs/plans/jobs/2026-05-09-typescript-size-refactor-phase-2.md`
- `docs/plans/jobs/2026-05-09-typescript-size-refactor-phase-3.md`
- `docs/plans/jobs/2026-05-09-typescript-size-refactor-phase-4.md`
- `docs/plans/jobs/2026-05-09-typescript-size-refactor-phase-5.md`
- `docs/plans/jobs/2026-05-09-typescript-size-refactor-phase-6.md`
- `docs/plans/jobs/2026-05-09-typescript-size-refactor-phase-7.md`
- `docs/plans/jobs/2026-05-09-typescript-size-refactor-phase-8.md`

## Why This Plan

The current line-count scan shows many files above 300 lines, but not every large file should move first. The highest-value targets are files where size also reflects mixed responsibilities and day-to-day maintenance risk.

The plan follows these rules:

- split feature lanes, not random line ranges
- keep existing imports stable through folder `index.ts` facades
- separate pure logic from interactive terminal flow
- keep test movement paired with the behavior it protects
- defer cohesive contract modules and prompt state machines unless a concrete change requires them

## Scope

In scope:

- behavior-preserving module splits for rename, data-query, data-extract, Markdown action, and selected utility modules
- test suite splits for the large rename, data-query, data-extract, font, Markdown PDF, and routing suites
- helper extraction where repeated setup hides the assertion contract
- focused validation after each phase

Out of scope:

- command behavior changes
- prompt copy changes
- output format changes
- artifact schema changes
- dependency upgrades
- broad package layout changes outside the affected feature folders

## Implementation Rules

- Use folder modules with `index.ts` facades when replacing a public file path.
- Preserve current exported function names and current caller import style where practical.
- Do not introduce deep imports from extracted internals outside the owning feature folder.
- Keep `src/cli/actions/*` as direct action orchestration.
- Keep `src/cli/interactive/*` as prompt and terminal orchestration.
- Keep domain helpers under their existing feature folders.
- Run focused tests after each slice before widening.
- Run `bun run lint`, `bun run format:check`, and `bun run build` before closeout.

## Phase Checklist

### Phase 1: Split rename planner core

- [x] move `src/cli/rename/planner.ts` to `src/cli/rename/planner/index.ts`
- [x] extract template parsing and token validation into `src/cli/rename/planner/pattern.ts`
- [x] extract directory traversal and candidate entry collection into `src/cli/rename/planner/entries.ts`
- [x] extract serial allocation helpers into `src/cli/rename/planner/serial.ts`
- [x] extract base-name rendering and collision-safe naming into `src/cli/rename/planner/render.ts`
- [x] keep `planBatchRename` and `planSingleRename` as the public facade exports
- [x] verify rename planner, template, preview, and apply tests

Focused verification:

```bash
bun test test/cli-fs-utils-rename-template.test.ts test/cli-rename-preview.test.ts test/cli-actions-rename-file.test.ts test/cli-actions-rename-apply-validation.test.ts
bun run lint
```

### Phase 2: Split rename Codex action

- [x] move `src/cli/actions/rename/codex.ts` to `src/cli/actions/rename/codex/index.ts`
- [x] extract file eligibility and candidate selection into `src/cli/actions/rename/codex/candidates.ts`
- [x] extract analyzer construction and execution into `src/cli/actions/rename/codex/analyzer.ts`
- [x] extract progress lifecycle into `src/cli/actions/rename/codex/progress.ts`
- [x] extract terminal summaries into `src/cli/actions/rename/codex/summary.ts`
- [x] preserve exported option/result types used by callers and tests
- [x] verify rename Codex action tests

Focused verification:

```bash
bun test test/cli-actions-rename-codex-internals.test.ts test/cli-actions-rename-file.test.ts test/cli-actions-rename-batch-codex-auto.test.ts test/cli-actions-rename-batch-codex-docs.test.ts test/cli-actions-rename-batch-codex-images.test.ts
bun run lint
```

### Phase 3: Split rename interactive flow

- [x] move cleanup prompt and analyzer review helpers out of `src/cli/interactive/rename-cleanup.ts`
- [x] create `src/cli/interactive/rename-cleanup/settings-prompts.ts`
- [x] create `src/cli/interactive/rename-cleanup/analyzer-review.ts`
- [x] create `src/cli/interactive/rename-cleanup/codex-suggestion.ts`
- [x] create `src/cli/interactive/rename-cleanup/artifact-retention.ts`
- [x] keep `runInteractiveRenameCleanup` as the facade export
- [x] extract `src/cli/interactive/rename.ts` pattern, batch, file, and cleanup branches only after cleanup is stable
- [x] split `test/cli-interactive-rename.test.ts` into behavior-owned rename interactive suites

Focused verification:

```bash
bun test test/cli-interactive-rename.test.ts test/cli-interactive-rename-cleanup.test.ts test/cli-interactive-rename-cleanup-codex.test.ts test/cli-interactive-rename-cleanup-codex-timestamp.test.ts test/cli-interactive-rename-cleanup-analyzer-review.test.ts test/cli-interactive-rename-cleanup-analyzer-rendering.test.ts test/cli-interactive-rename-cleanup-retention.test.ts test/cli-actions-rename-cleanup-single.test.ts test/cli-actions-rename-cleanup-codex.test.ts
bun run lint
```

### Phase 4: Split data-query action and Codex core

- [x] move `src/cli/actions/data-query.ts` to `src/cli/actions/data-query/index.ts`
- [x] extract option validation into `src/cli/actions/data-query/validate.ts`
- [x] extract source shape and workspace resolution into `src/cli/actions/data-query/shape-resolution.ts`
- [x] extract header suggestion handling into `src/cli/actions/data-query/header-suggestion.ts`
- [x] extract result output writing/rendering into `src/cli/actions/data-query/output.ts`
- [x] keep `actionDataQuery` as the facade export
- [x] split `src/cli/data-query/codex.ts` into `view.ts`, `prompt.ts`, `parse.ts`, `render.ts`, and `runner.ts`
- [x] verify action and Codex query suites

Focused verification:

```bash
bun test test/cli-actions-data-query*.test.ts test/cli-command-data-query-codex*.test.ts
bun run lint
```

### Phase 5: Split data-query interactive and extract flow

- [x] split `src/cli/interactive/data-query/source-shape.ts` into Excel prompts, introspection rendering, suspicion detection, and Codex shape collection
- [x] split `src/cli/interactive/data-query/sql/formal-guide.ts` into operators, SQL builder, and prompt collection
- [x] split `src/cli/interactive/data/extract.ts` into session, review, output, and facade modules
- [x] split `test/helpers/interactive-harness/mocks/data-query.ts` into focused query, workspace, Codex, and source-shape helpers
- [x] split data-query and data-extract command/action tests by behavior surface

Focused verification:

```bash
bun test test/cli-command-data-query.test.ts test/cli-command-data-query-workspace.test.ts test/cli-command-data-query-duckdb-sources.test.ts test/cli-command-data-query-shape.test.ts test/cli-command-data-query-source-shape.test.ts test/cli-command-data-query-validation.test.ts test/cli-command-data-query-headers.test.ts test/cli-command-data-query-duckdb-lifecycle.test.ts test/cli-actions-data-extract*.test.ts test/cli-command-data-extract*.test.ts test/data-source-shape.test.ts
bun run lint
```

### Phase 6: Split large behavior-owned test suites

- [x] split `test/fonts.test.ts` into discovery, CLI, and coverage suites
- [x] split `test/cli-actions-md-to-pdf.test.ts` into options, profile, recipe, actions, and commands suites
- [x] split `test/cli-interactive-routing.test.ts` by top-level menu family after feature-specific routing coverage is preserved
- [x] keep one smoke case per major top-level route in the shared routing suite
- [x] avoid changing assertions while moving tests unless a helper extraction makes the assertion clearer

Focused verification:

```bash
bun test test/fonts*.test.ts test/cli-actions-md-to-pdf*.test.ts test/cli-interactive-routing*.test.ts
bun run lint
```

### Phase 7: Secondary source cleanups

- [x] split `src/cli/actions/markdown.ts` into per-command action modules
- [x] split `src/cli/duckdb/xlsx-sources.ts` into ZIP, workbook, and worksheet helpers
- [x] review `src/cli/commands/rename.ts`, `src/cli/rename-plan-csv.ts`, and `src/cli/rename-preview.ts` after rename phases land
- [x] leave prompt state machines (`path-inline.ts`, `text-inline.ts`) untouched unless surrounding tests are cleaner and a concrete change requires movement

Focused verification:

```bash
bun test
bun run lint
bun run format:check
bun run build
```

### Phase 8: Final review and closeout

- [x] rerun the over-300-line scan and record remaining intentional exceptions
- [x] review public import surfaces for accidental deep imports
- [x] review test layout for duplicated setup or scattered behavior coverage
- [x] update this plan checklist and create implementation job records as phases land
- [x] record final validation evidence

Closeout verification:

```bash
bun test
bun run lint
bun run format:check
bun run build
git diff --check
```

Phase 8 closeout:

- The final over-300-line scan found 21 `src` files and 20 `test` files still above the threshold. The remaining `src` files are intentional exceptions for now: prompt state machines, data-stack contracts, narrow command/action modules, or cohesive utility modules already called out in the deferral list.
- Public import-surface review found no accidental deep imports into newly extracted internals. The only direct test import into an extracted rename module is the intentional `src/cli/actions/rename/codex/testing` facade.
- Test-layout review found that the largest pre-refactor suites were already split by behavior surface. The exact remaining over-threshold test inventory is recorded in the Phase 8 job record and deferred as behavior-owned data-stack, video, UX, release, prompt-state-machine, or narrow fixture-heavy coverage rather than Phase 8 movement.
- Final evidence is recorded in `docs/plans/jobs/2026-05-09-typescript-size-refactor-phase-8.md`.

## Intentional Deferrals

- `src/cli/prompts/path-inline.ts` and `src/cli/prompts/text-inline.ts` are state-machine modules. Refactor them only with strong focused coverage and a concrete need.
- `src/cli/data-stack/plan/parse.ts` and `src/cli/data-stack/codex-report/validation.ts` are contract-heavy modules from a recent refactor. Keep them stable unless data-stack work resumes.
- `src/cli/markdown-pdf/profile/normalize.ts`, `src/fonts/coverage.ts`, and `src/utils/exif.ts` are cohesive enough to defer.

## Review Notes

- The first implementation wave should be rename-only. Mixing rename, data-query, and Markdown PDF movement in one branch would make review too expensive.
- Test splits should generally follow source splits, except for very large suites where moving tests first can make later source work easier to verify.
- Any behavior change discovered during refactor should become a separate fix or follow-up plan rather than being hidden inside a file split.
