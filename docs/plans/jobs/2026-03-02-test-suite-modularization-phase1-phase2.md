---
title: "Test suite modularization phase 1 and phase 2"
created-date: 2026-03-02
modified-date: 2026-03-02
status: completed
agent: codex
---

## Goal

Execute Phase 1 and the first high-value Phase 2 split from `docs/plans/archive/plan-2026-03-02-test-suite-modularization-and-redundancy-reduction.md` by turning the rename batch test inventory into a literal keep/move/remove matrix and then splitting `test/cli-actions-rename-batch-core.test.ts` into focused files.

## Scope

- `test/cli-actions-rename-batch-core.test.ts`
- new focused batch test files for recursion, filters, and preview behavior
- Phase 1 keep/move/remove decisions for the current batch-core tests

## Decision Matrix

| Current test case | Decision | Target | Reason |
| --- | --- | --- | --- |
| `dry-run previews renames and returns counts` | keep | `test/cli-actions-rename-batch-core.test.ts` | core happy-path smoke coverage |
| `without prefix omits the old implicit file prefix` | keep | `test/cli-actions-rename-batch-core.test.ts` | core naming contract |
| `excludes hidden/system junk files by default` | move | `test/cli-actions-rename-batch-filters.test.ts` | filter behavior |
| `applies renames when dryRun is false` | keep | `test/cli-actions-rename-batch-core.test.ts` | core apply smoke coverage |
| `handles an empty directory` | keep | `test/cli-actions-rename-batch-core.test.ts` | core empty-state coverage |
| `supports recursive traversal and skips symlinks with audit reasons` | move | `test/cli-actions-rename-batch-recursion.test.ts` | recursion/symlink behavior |
| `limits recursive traversal with maxDepth` | move | `test/cli-actions-rename-batch-recursion.test.ts` | recursion depth behavior |
| `dry-run truncates large rename previews and emphasizes the plan csv` | move | `test/cli-actions-rename-batch-preview.test.ts` | action-level preview integration |
| `dry-run keeps full rename previews on non-tty output` | move | `test/cli-actions-rename-batch-preview.test.ts` | action-level preview integration |
| `dry-run keeps changed rows visible when unchanged rows would fill the compact window` | remove | covered by `test/cli-rename-preview.test.ts` | direct preview unit coverage already owns this contract |
| `can render detailed skipped-item output separately from the default summary` | move | `test/cli-actions-rename-batch-preview.test.ts` | preview flag wiring |
| `rejects invalid previewSkips values` | move | `test/cli-actions-rename-batch-preview.test.ts` | preview option validation |
| `requires --recursive when maxDepth is provided` | move | `test/cli-actions-rename-batch-recursion.test.ts` | recursion option validation |
| `rejects negative maxDepth` | move | `test/cli-actions-rename-batch-recursion.test.ts` | recursion option validation |
| `scopes files with regex and extension filters` | move | `test/cli-actions-rename-batch-filters.test.ts` | filter behavior |
| `supports preset file profiles (media/docs/images)` | move | `test/cli-actions-rename-batch-filters.test.ts` | profile behavior |
| `rejects invalid --profile values` | move | `test/cli-actions-rename-batch-filters.test.ts` | filter/profile validation |
| `rejects invalid regex scope filters` | move | `test/cli-actions-rename-batch-filters.test.ts` | filter/profile validation |

## Timestamp and Serial Ownership

- Batch timestamp behavior remains owned by `test/cli-actions-rename-timestamp.test.ts`.
- No timestamp or serial-order assertions from `test/cli-actions-rename-batch-core.test.ts` need to move during this pass.

## Implemented

- Split `test/cli-actions-rename-batch-core.test.ts` into:
  - `test/cli-actions-rename-batch-core.test.ts`
  - `test/cli-actions-rename-batch-filters.test.ts`
  - `test/cli-actions-rename-batch-preview.test.ts`
  - `test/cli-actions-rename-batch-recursion.test.ts`
- Reduced `test/cli-actions-rename-batch-core.test.ts` from 684 lines to 157 lines.
- Removed the action-level test for compact-preview changed-row preference because that contract is already covered directly in `test/cli-rename-preview.test.ts`.
- Preserved action-level preview wiring coverage for:
  - TTY compact preview truncation
  - non-TTY full preview output
  - `previewSkips: "detailed"` wiring
  - invalid `previewSkips` validation

## Result

- Batch rename tests now align with the Phase 2 split boundaries in the active plan.
- The four batch test files total 717 lines, but responsibility is now separated by behavior area instead of concentrated in one mixed file.
- Full-suite test count is now 196, down from 197, with the removed case intentionally covered at the lower preview unit layer.

## Notes

- The first compaction target is duplicate preview coverage, not reduced user-visible confidence.
- Keep at least one action-level preview smoke path after the split so preview wiring is still exercised through `actionRenameBatch`.

## Verification

- `bun test test/cli-actions-rename-batch-core.test.ts` ✅
- `bun test test/cli-actions-rename-batch-filters.test.ts` ✅
- `bun test test/cli-actions-rename-batch-preview.test.ts` ✅
- `bun test test/cli-actions-rename-batch-recursion.test.ts` ✅
- `bun test` ✅

## Related Plans

- `docs/plans/archive/plan-2026-03-02-test-suite-modularization-and-redundancy-reduction.md`

## Related Research

- `docs/researches/archive/research-2026-03-02-test-suite-audit.md`
