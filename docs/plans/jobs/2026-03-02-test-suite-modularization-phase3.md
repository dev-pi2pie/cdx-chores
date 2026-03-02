---
title: "Test suite modularization phase 3"
created-date: 2026-03-02
modified-date: 2026-03-02
status: completed
agent: codex
---

## Goal

Execute Phase 3 from `docs/plans/plan-2026-03-02-test-suite-modularization-and-redundancy-reduction.md` by splitting `test/cli-actions-rename-apply.test.ts` into replay-focused and validation-focused files without changing behavior.

## Scope

- `test/cli-actions-rename-apply.test.ts`
- `test/cli-actions-rename-apply-replay.test.ts`
- `test/cli-actions-rename-apply-validation.test.ts`
- small shared helper support for rename-plan CSV row creation if that keeps both files readable

## Decision Matrix

| Current test case | Decision | Target | Reason |
| --- | --- | --- | --- |
| `actionRenameBatch dry-run writes a replayable CSV plan under cwd` | move | `test/cli-actions-rename-apply-replay.test.ts` | replay flow setup |
| `actionRenameApply replays the dry-run CSV snapshot exactly` | move | `test/cli-actions-rename-apply-replay.test.ts` | replay happy path |
| `actionRenameApply can auto-clean the plan CSV after successful apply` | move | `test/cli-actions-rename-apply-replay.test.ts` | replay success behavior |
| `actionRenameApply rejects CSVs missing required replay columns` | move | `test/cli-actions-rename-apply-validation.test.ts` | schema validation |
| `actionRenameApply rejects rows with blank status instead of defaulting to planned` | move | `test/cli-actions-rename-apply-validation.test.ts` | row validation |
| `actionRenameApply rejects rows missing plan_id` | move | `test/cli-actions-rename-apply-validation.test.ts` | row validation |
| `actionRenameApply rejects rows missing planned_at` | move | `test/cli-actions-rename-apply-validation.test.ts` | row validation |
| `actionRenameApply rejects invalid status values` | move | `test/cli-actions-rename-apply-validation.test.ts` | row validation |
| `actionRenameApply rejects duplicate executable source paths before any rename executes` | move | `test/cli-actions-rename-apply-validation.test.ts` | execution safety validation |
| `actionRenameApply rejects duplicate executable target paths before any rename executes` | move | `test/cli-actions-rename-apply-validation.test.ts` | execution safety validation |
| `actionRenameApply rejects cwd-escaping executable paths` | move | `test/cli-actions-rename-apply-validation.test.ts` | execution safety validation |
| `actionRenameApply rejects mixed plan_id values across rows before execution` | move | `test/cli-actions-rename-apply-validation.test.ts` | plan consistency validation |
| `actionRenameApply rejects mixed planned_at values across rows before execution` | move | `test/cli-actions-rename-apply-validation.test.ts` | plan consistency validation |
| `actionRenameApply ignores additive columns and non-blocking basename metadata mismatches` | move | `test/cli-actions-rename-apply-validation.test.ts` | compatibility validation |
| `readRenamePlanCsv allows empty plan_id and planned_at for inspection reads while keeping status strict` | move | `test/cli-actions-rename-apply-validation.test.ts` | inspection-read contract |

## Notes

- This pass is a responsibility split, not a behavior rewrite.
- A small helper for CSV row/header construction is acceptable because both new files need the same plan format contract.

## Implemented

- Replaced `test/cli-actions-rename-apply.test.ts` with:
  - `test/cli-actions-rename-apply-replay.test.ts`
  - `test/cli-actions-rename-apply-validation.test.ts`
- Added `test/helpers/rename-apply-test-utils.ts` for shared rename-plan CSV row/header construction.
- Kept replay generation, replay apply, and auto-clean behavior together in the replay file.
- Kept CSV schema validation, execution safety validation, compatibility validation, and lenient inspection-read behavior together in the validation file.

## Result

- Rename apply tests now align with the Phase 3 split boundary in the active plan.
- The old mixed file was removed in favor of one replay-focused file and one validation-focused file.
- Full-suite test count stayed stable at 196 because this pass was a pure split without deleting any apply coverage.

## Verification

- `bun test test/cli-actions-rename-apply-replay.test.ts` ✅
- `bun test test/cli-actions-rename-apply-validation.test.ts` ✅
- `bun test test/cli-rename-preview.test.ts` ✅
- `bun test` ✅

## Related Plans

- `docs/plans/plan-2026-03-02-test-suite-modularization-and-redundancy-reduction.md`

## Related Research

- `docs/researches/research-2026-03-02-test-suite-audit.md`
