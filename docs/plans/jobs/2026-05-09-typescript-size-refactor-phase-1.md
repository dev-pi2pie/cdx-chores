---
title: "TypeScript size refactor phase 1"
created-date: 2026-05-09
modified-date: 2026-05-09
status: completed
agent: codex
---

## Goal

Implement Phase 1 from `docs/plans/plan-2026-05-09-typescript-size-refactor-implementation.md` by splitting the rename planner into smaller modules without changing rename behavior.

## What Changed

- Replaced `src/cli/rename/planner.ts` with `src/cli/rename/planner/index.ts` as the public facade.
- Extracted pattern parsing, placeholder validation, serial placeholder normalization, and prefix normalization into `src/cli/rename/planner/pattern.ts`.
- Extracted recursive directory traversal, symlink skipping, file filtering, and candidate entry collection into `src/cli/rename/planner/entries.ts`.
- Extracted serial ordering, grouping, width calculation, and serial formatting into `src/cli/rename/planner/serial.ts`.
- Extracted basename rendering, timestamp/date token expansion, and collision-safe target allocation into `src/cli/rename/planner/render.ts`.
- Centralized rename template placeholder metadata, validation helpers, rendering helpers, and allowed-placeholder messaging in `src/cli/rename/planner/tokens.ts`.
- Preserved batch collision avoidance against pre-existing blocking paths that are not part of the selected rename set.
- Preserved existing caller imports through the folder `index.ts` facade.
- Added focused regression coverage for descending serial ordering, equal-mtime path tie-breaking, `{uid}` sanitizing, batch collisions with untouched siblings, directory and symlink target blockers, planned-vs-planned target collisions, stale entries disappearing before `stat`, and directory rejection in `rename file`.
- Updated the implementation plan checklist to mark Phase 1 done.

## Review

- `ts_structure_refactorer` implemented the Phase 1 split with ownership limited to `src/cli/rename/planner.ts` and `src/cli/rename/planner/**`.
- A local follow-up removed an unused internal candidate-entry field and replaced an inline return type import with a normal type import before reviewer handoff.
- `maintainability_reviewer` found that the traversal helper still depended on a runtime callback and that placeholder token knowledge was split between validation and rendering. The follow-up changed traversal to accept a resolved fallback date and moved shared token knowledge into `tokens.ts`.
- `test_reviewer` found missing coverage for batch collision handling, serial ordering branches, `{uid}` sanitizing, stale traversal entries, and directory input rejection. The follow-up added focused tests for those cases.
- A second `maintainability_reviewer` pass found that the placeholder message was still duplicated and that the blocking-path set name could imply a complete directory snapshot. The follow-up now derives the allowed-placeholder message from the token registry and renames the collision set to `preexistingBlockingPaths`.
- A second `test_reviewer` pass requested directory/symlink blocker coverage and planned-vs-planned collision coverage. The follow-up added both.
- `docs_reviewer` first returned `findings: []`, then requested `modified-date` after the job record was substantively updated. The follow-up added `modified-date: 2026-05-09`.

## Verification

```text
bun test test/cli-fs-utils-rename-template.test.ts test/cli-rename-preview.test.ts test/cli-actions-rename-file.test.ts test/cli-actions-rename-apply-validation.test.ts
bun test test/cli-fs-utils-rename-template.test.ts test/cli-rename-preview.test.ts test/cli-actions-rename-file.test.ts test/cli-actions-rename-apply-validation.test.ts test/cli-actions-rename-batch-recursion.test.ts
bun run lint
bun run format:check
bun run build
git diff --check
```

Results:

- Initial focused Phase 1 tests: 44 pass, 0 fail
- Reviewer follow-up focused tests: 55 pass, 0 fail
- Lint: 0 warnings, 0 errors
- Format check: passed
- Build: passed
- Diff check: passed

## Related Research

- `docs/researches/research-2026-05-09-typescript-size-refactor-scan.md`

## Related Plans

- `docs/plans/plan-2026-05-09-typescript-size-refactor-implementation.md`
