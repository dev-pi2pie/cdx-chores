---
title: "Markdown PDF template Codex phase 8.6 generated bundle naming"
created-date: 2026-06-24
modified-date: 2026-06-24
status: in-progress
agent: codex
plan: ../plan-2026-06-23-markdown-pdf-template-codex-helper.md
---

## Scope

Implement Phase 8.6 of the direct `md pdf-template codex` plan.

This phase removes input-derived default bundle names. Generated bundle
directories now use short, generic, collision-safe artifact IDs. User-facing
semantic names remain available through explicit `--output`.

## Sequence

1. Reviewed generated output planning and confirmed explicit `--output` already
   bypassed generated default naming.
2. Changed omitted-output planning to resolve generated bundle directories from
   the bundle ID under the runtime working directory.
3. Removed the input-stem `.pdf-template-<bundle-id>` generated-name
   composition from the output planner.
4. Preserved the existing bounded retry loop, using the generated bundle ID as
   the colliding directory candidate on each attempt.
5. Added a regression with `README.md` proving omitted output no longer derives
   the generated directory name from the Markdown file stem or extension.
6. Ran focused output-path, action, output-directory, collision, and command
   coverage.

## Changes

- Omitted `--output` now plans `md-pdf-template-<timestamp>-<uid>/`.
- Explicit `--output` still controls semantic bundle naming.
- Collision retry behavior is unchanged.
- Output-path coverage now guards against input-derived generated names.

## Verification

- `bun test test/cli-actions-md-to-pdf-template-codex/output-paths.test.ts test/cli-actions-md-to-pdf-template-codex/action.test.ts test/cli-actions-md-to-pdf-template-codex/output-directory.test.ts test/cli-actions-md-to-pdf-template-codex/output-collisions.test.ts test/cli-actions-md-to-pdf-commands.test.ts`
  - Passed: 37 tests.
- `bunx tsc --noEmit`
  - Passed.
- `bun run lint`
  - Passed.
- `bun run format:check`
  - Passed.
- `bun run build`
  - Passed.
- `bun test --timeout 30000`
  - Passed: 1320 tests.
- `git diff --check`
  - Passed.

## Reviews

- Pending Phase 8.6 commit-range review.
