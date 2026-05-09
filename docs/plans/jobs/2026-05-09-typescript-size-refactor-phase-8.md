---
title: "TypeScript size refactor phase 8"
created-date: 2026-05-09
modified-date: 2026-05-09
status: completed
agent: codex
---

## Goal

Complete Phase 8 from `docs/plans/plan-2026-05-09-typescript-size-refactor-implementation.md` by closing the size-refactor plan with a fresh oversized-file scan, import-surface review, test-layout review, reviewer passes, and final validation evidence.

## What Changed

- Marked Phase 8 complete in the implementation plan.
- Linked this Phase 8 job record from the plan's implementation records.
- Recorded the final over-300-line scan and remaining intentional exceptions.
- Recorded public import-surface and test-layout review outcomes.
- Routed the legacy interactive data-query export facade through `src/cli/interactive/data-query/index.ts` instead of re-exporting its submodules one by one.
- Moved `src/cli/interactive/data-query/source-selection.ts` off a direct `duckdb/query/formats` import and onto the public `duckdb/query` facade.
- Kept the interactive harness public helper facade limited to the runner and result/scenario types.
- Kept the data-query interactive harness mock aligned with production label wording by reusing `getMultiObjectSourceDisplayLabel` from the public `duckdb/query` facade.
- Replaced brittle menu-label-based harness mock gating with an explicit data-query fixture predicate.
- Removed the brittle in-process mock-gating test because installing broad Bun module mocks in one test process contaminated unrelated action suites. The retained coverage path is the subprocess interactive harness routing suites, which load the harness mocks in an isolated process and exercise data-query/data-extract flows through the real harness setup.
- Added direct import-surface coverage for the legacy flat `src/cli/interactive/data-query.ts` facade.

## Final Over-300-Line Scan

Command:

```bash
find src test -name '*.ts' -o -name '*.tsx' | sort | while read f; do lines=$(wc -l < "$f"); if [ "$lines" -gt 300 ]; then case "$f" in src/*) kind=src ;; test/*) kind=test ;; esac; printf '%s\t%s\t%s\n' "$kind" "$lines" "$f"; fi; done | sort -k1,1 -k2,2nr
```

Results:

- `src`: 21 files over 300 lines
- `test`: 20 files over 300 lines

Remaining `src` exceptions:

| Lines | File | Closeout decision |
| ---: | --- | --- |
| 506 | `src/cli/prompts/path-inline.ts` | Prompt state machine; keep deferred until a concrete prompt change needs movement. |
| 444 | `src/cli/data-stack/plan/parse.ts` | Data-stack contract parser from a recent refactor; keep stable. |
| 419 | `src/cli/data-stack/codex-report/validation.ts` | Data-stack report contract validation; keep stable. |
| 405 | `src/cli/interactive/data/stack/source-discovery.ts` | Data-stack interactive flow; defer to a data-stack-specific pass. |
| 378 | `src/cli/prompts/text-inline.ts` | Prompt state machine; keep deferred until a concrete prompt change needs movement. |
| 365 | `src/cli/rename-plan-csv.ts` | Narrow CSV plan serializer/parser surface; reviewed in Phase 7. |
| 363 | `src/cli/rename-preview.ts` | Narrow preview renderer surface; reviewed in Phase 7. |
| 360 | `src/cli/commands/rename.ts` | Command wiring surface; reviewed in Phase 7. |
| 357 | `src/cli/duckdb/header-mapping/artifact.ts` | Cohesive artifact read/write contract; defer until header-mapping work resumes. |
| 355 | `src/cli/duckdb/extensions.ts` | Cohesive DuckDB extension lifecycle helper; defer until DuckDB lifecycle work resumes. |
| 345 | `src/cli/actions/font-check.ts` | Narrow font-check action; defer until font work resumes. |
| 344 | `src/cli/actions/rename/cleanup.ts` | Behavior-owned cleanup action; keep stable after earlier rename cleanup splits. |
| 344 | `src/cli/data-preview/source.ts` | Cohesive data-preview source handling; defer until preview work resumes. |
| 321 | `src/cli/data-stack/rows.ts` | Cohesive row-shape helper; defer to data-stack-specific pass. |
| 318 | `src/cli/interactive/data/stack/codex-review.ts` | Data-stack Codex review flow; defer to data-stack-specific pass. |
| 317 | `src/utils/exif.ts` | Cohesive EXIF utility; defer. |
| 315 | `src/fonts/coverage.ts` | Cohesive coverage helper; already identified as a deferral. |
| 314 | `src/cli/interactive/data-query/execution.ts` | Narrow interactive execution orchestration; not a priority after Phase 4 and Phase 5 splits. |
| 311 | `src/cli/duckdb/query/prepare-source.ts` | Cohesive source-preparation contract; defer. |
| 311 | `src/cli/markdown-pdf/profile/normalize.ts` | Cohesive profile normalization contract; already identified as a deferral. |
| 310 | `src/cli/actions/rename/cleanup-planner.ts` | Behavior-owned cleanup planner; keep stable after earlier rename cleanup splits. |

Remaining `test` exceptions:

- The largest pre-refactor suites were split during earlier phases: fonts, Markdown PDF, routing, data-query, data-extract, and rename interactive coverage now have behavior-owned suites.
- Remaining over-threshold tests are intentionally deferred because they are behavior-owned data-stack, video, UX, release-script, prompt-state-machine, fixture-heavy, or narrow regression suites.
- No Phase 8-only test movement was made because the remaining candidates need feature-specific plans to avoid hiding assertion changes inside closeout work.

| Lines | File | Closeout decision |
| ---: | --- | --- |
| 655 | `test/cli-actions-data-stack/validation.test.ts` | Behavior-owned data-stack validation matrix; defer to a data-stack-specific test split. |
| 637 | `test/cli-actions-video-gif.test.ts` | Behavior-owned GIF conversion suite; defer until video work resumes. |
| 597 | `test/cli-fs-utils-rename-template.test.ts` | Rename planner/template regression matrix; keep stable after Phase 1 splits. |
| 564 | `test/cli-ux.test.ts` | CLI command-help and UX smoke matrix across command families; defer to a CLI UX pass. |
| 557 | `test/cli-actions-doctor-markdown-video-deferred.test.ts` | Shared deferred/doctor/Markdown/video failure-path suite; keep stable after Phase 7 additions. |
| 485 | `test/cli-command-data-stack/options.test.ts` | Data-stack command option matrix; defer to a data-stack-specific test split. |
| 446 | `test/cli-actions-rename-cleanup-single.test.ts` | Rename cleanup single-file behavior matrix; keep stable after rename cleanup phases. |
| 434 | `test/data-source-shape.test.ts` | Source-shape artifact contract suite; defer until source-shape contract work resumes. |
| 429 | `test/cli-text-inline.test.ts` | Text prompt state-machine suite; paired with deferred `text-inline.ts`. |
| 429 | `test/data-stack-codex-report/apply.test.ts` | Data-stack report application contract suite; defer to a data-stack-specific pass. |
| 428 | `test/cli-actions-rename-file.test.ts` | Rename file action behavior matrix; keep stable after rename action splits. |
| 422 | `test/release-scripts.test.ts` | Release-script workflow suite; outside this refactor lane. |
| 414 | `test/cli-interactive-data-stack/discovery.test.ts` | Data-stack interactive discovery suite; defer to a data-stack-specific test split. |
| 404 | `test/cli-actions-rename-apply-validation.test.ts` | Rename apply validation matrix; keep stable after rename phases. |
| 396 | `test/adapters-docx-ooxml-metadata.test.ts` | Fixture-heavy DOCX metadata adapter suite; outside this refactor lane. |
| 388 | `test/cli-interactive-data-stack/dry-run-write.test.ts` | Data-stack interactive write-flow suite; defer to a data-stack-specific test split. |
| 381 | `test/cli-path-inline.test.ts` | Path prompt state-machine suite; paired with deferred `path-inline.ts`. |
| 361 | `test/data-query-xlsx-sources.test.ts` | XLSX source metadata regression suite; keep stable after Phase 7 module split. |
| 360 | `test/cli-interactive-data-stack/codex-review.test.ts` | Data-stack interactive Codex review suite; defer to a data-stack-specific test split. |
| 311 | `test/data-stack-codex-report/validation.test.ts` | Data-stack report validation contract suite; defer to a data-stack-specific pass. |

## Import-Surface Review

Commands:

```bash
rg -n "from ['\"]\\.\\.?/.+/(planner|codex|data-query|rename-cleanup|xlsx-sources)(/|['\"])" src test
rg -n "from ['\"]\\.\\.?/.+/(actions/markdown|duckdb/xlsx-sources|actions/data-query|data-query/codex|rename/planner|actions/rename/codex|interactive/rename-cleanup)(/[^'\"]+)" src test
```

Outcome:

- No accidental deep imports into newly extracted implementation internals were found.
- The only direct test import into an extracted rename module is `src/cli/actions/rename/codex/testing`, which is an intentional test facade.
- Runtime callers continue to import through public facades such as `src/cli/actions/markdown.ts`, `src/cli/duckdb/xlsx-sources.ts`, `src/cli/actions/data-query/index.ts`, `src/cli/data-query/codex/index.ts`, and `src/cli/rename/planner/index.ts`.
- The Phase 8 structural cleanup removed one data-query interactive deep import by using the public `duckdb/query` facade.

## Review

- `ts_structure_refactorer`: found and implemented a small facade cleanup in interactive data-query and interactive harness test helpers. The duplicate `src/cli/duckdb/query.ts` re-export from the worker patch was removed locally because the facade already re-exports `getMultiObjectSourceDisplayLabel`.
- `maintainability_reviewer`: found brittle menu-label-based mock gating, duplicated multi-object source labels in the mock, and unclear dual barrel ownership. Follow-up fixes replaced menu-label checks with an explicit data-query fixture predicate, reuse the production label helper through the public facade, remove the extra public harness exports, and document compatibility facades.
- `test_reviewer`: initially returned no material test coverage gaps. Final re-review found that the legacy flat interactive data-query facade lacked direct import-surface coverage. Follow-up fixes added `test/cli-interactive-data-query-facade.test.ts`.
- `docs_reviewer`: found that the plan and job record were marked complete before final reviewer and validation evidence had been recorded. Follow-up fixes replaced pending reviewer/validation notes with the concrete outcomes in this record.
- Final docs re-review found that the mock-gating replacement coverage path and remaining over-threshold test inventory were under-specified. Follow-up fixes recorded the subprocess harness coverage path and exact deferred test list above.

## Verification

Closeout commands:

```text
bun test
bun run lint
bun run format:check
bun run build
git diff --check
```

Results:

- Focused interactive data-query/extract routing and facade tests: 16 pass, 0 fail
- Full test suite after reviewer fixes: 1056 pass, 0 fail, 4787 expect calls, 174 files
- Lint: 0 warnings, 0 errors
- Format check: passed
- Build: passed; embedded version unchanged at `0.1.3-canary.4`
- Diff whitespace check: passed
