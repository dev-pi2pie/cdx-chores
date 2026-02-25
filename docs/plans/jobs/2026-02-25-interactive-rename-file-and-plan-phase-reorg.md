---
title: "Add interactive rename file and reorganize rename plan phases"
created-date: 2026-02-25
status: completed
agent: codex
---

## Goal

Expose the new `rename file` workflow in interactive mode and reorganize rename-related plan checklists into explicit phases across the two active rename plans.

## What Changed

- Added `rename file` to the interactive menu in `src/cli/interactive.ts`
- Added interactive prompt flow for `rename file`:
  - target file
  - prefix
  - dry-run toggle
  - optional apply-now confirmation using generated CSV snapshot
- Reorganized checklist items in:
  - `docs/plans/plan-2026-02-25-codex-assisted-image-rename-and-action-tool-integration.md`
  - `docs/plans/plan-2026-02-25-image-rename-pattern-and-audit-workflow.md`
- Marked the Codex integration plan as completed and documented the `doctor` item as evaluated/no-op for current MVP.
- Grouped remaining pattern/audit work into phased sections to distinguish current implementation work from deferred design phases.

## Verification

- `bun test`
- `bunx tsc --noEmit`

## Related Plans

- `docs/plans/plan-2026-02-25-codex-assisted-image-rename-and-action-tool-integration.md`
- `docs/plans/plan-2026-02-25-image-rename-pattern-and-audit-workflow.md`
