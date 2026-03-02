---
title: "Test suite audit for redundancy and modularization"
created-date: 2026-03-02
status: completed
agent: codex
---

## Goal

Review the current test suite for redundant coverage, identify oversized test files, and note production modules whose size is driving test complexity.

## Key Findings

- The rename workflow remains the main concentration point in both source and tests.
  - `src/cli/actions/rename.ts` is 1180 lines and still owns batch rename, single-file rename, and apply flows.
  - The largest rename-focused test files are:
    - `test/cli-actions-rename-batch-core.test.ts` (684 lines)
    - `test/cli-actions-rename-apply.test.ts` (601 lines)
    - `test/cli-actions-rename-file.test.ts` (413 lines)
- Preview behavior has both direct unit coverage and higher-level action coverage.
  - `test/cli-rename-preview.test.ts` directly tests preview truncation, changed-row preference, and skipped-item summarization.
  - `test/cli-actions-rename-batch-core.test.ts` rechecks the same behaviors through `actionRenameBatch`.
- Inline path prompting is split across low-level state/suggestion tests and a large controller integration file.
  - `test/cli-path-inline-state.test.ts` covers state transitions.
  - `test/cli-path-suggestions.test.ts` covers suggestion resolution rules.
  - `test/cli-path-sibling-preview.test.ts` covers sibling candidate generation.
  - `test/cli-path-inline.test.ts` still replays several of those behaviors through the full prompt controller.

## Implications or Recommendations

- Keep one end-to-end preview assertion in `test/cli-actions-rename-batch-core.test.ts`, but move most preview-shaping confidence to `test/cli-rename-preview.test.ts`.
  - Good candidates to trim or merge:
    - compact truncation behavior
    - changed-row preference in compact previews
    - detailed skipped-item rendering shape
- Split `test/cli-actions-rename-batch-core.test.ts` by responsibility instead of keeping one mixed bucket.
  - Suggested files:
    - `test/cli-actions-rename-batch-filters.test.ts`
    - `test/cli-actions-rename-batch-recursion.test.ts`
    - `test/cli-actions-rename-batch-preview.test.ts`
- Split `test/cli-actions-rename-apply.test.ts` into replay-success and CSV-validation files.
  - The file mixes one happy-path replay flow with a long set of schema/validation failures.
- Reduce controller-level duplication in `test/cli-path-inline.test.ts`.
  - Keep controller-only contracts there:
    - raw-session lifecycle
    - asynchronous late-resolution guard
    - end-to-end key handling
  - Rely on lower-level files for:
    - sibling preview state transitions
    - suggestion ordering/filtering rules
- Refactor `src/cli/actions/rename.ts` before growing rename tests further.
  - Suggested extraction targets:
    - codex analyzer orchestration
    - dry-run preview/report printing
    - plan CSV row creation/writing
    - shared output summary formatting for batch vs file flows

## Related Plans

- `docs/plans/jobs/2026-02-27-test-suite-second-pass-redundancy-audit.md`
- `docs/plans/jobs/2026-02-27-test-suite-rename-action-split-refactor.md`
- `docs/plans/jobs/2026-03-02-refactor-rename-timestamp-tests.md`

## References

- `test/cli-actions-rename-batch-core.test.ts`
- `test/cli-actions-rename-apply.test.ts`
- `test/cli-actions-rename-file.test.ts`
- `test/cli-path-inline.test.ts`
- `test/cli-path-inline-state.test.ts`
- `test/cli-path-sibling-preview.test.ts`
- `test/cli-path-suggestions.test.ts`
- `test/cli-rename-preview.test.ts`
- `src/cli/actions/rename.ts`
