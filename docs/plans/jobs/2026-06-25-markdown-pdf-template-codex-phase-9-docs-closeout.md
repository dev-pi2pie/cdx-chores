---
title: "Markdown PDF template Codex phase 9 docs closeout"
created-date: 2026-06-25
modified-date: 2026-06-25
status: in-progress
agent: codex
plan: ../plan-2026-06-23-markdown-pdf-template-codex-helper.md
---

## Scope

Implement Phase 9 of the direct `md pdf-template codex` plan.

This phase documents the accepted direct template helper, updates related guide
links and research status, and closes the plan without starting the later hybrid
one-shot or Interactive Markdown PDF layers.

## Sequence

1. Confirmed the worktree was clean before starting the final pass.
2. Verified current command help for `md pdf-template codex` and `md to-pdf`
   from the built CLI.
3. Confirmed `doctor --json` reports `weasyprint` unavailable in this
   environment, so the remaining Phase 8.8 real render smoke cannot execute
   here.
4. Created the dedicated guide
   `docs/guides/markdown-pdf-codex-template-helper.md`.
5. Updated `docs/guides/markdown-pdf-usage.md` with the direct template helper
   relationship and deterministic render follow-up path.
6. Updated `docs/guides/markdown-pdf-codex-profile-helper.md` so its
   profile-versus-template section no longer describes the template helper as a
   future command.
7. Updated `README.md` so the Markdown PDF guide list includes both direct
   Codex helper guides.
8. Updated the focused template-Codex research to `completed` with completion
   evidence.
9. Updated the parent Markdown PDF Codex roadmap to record the direct template
   helper as completed while leaving hybrid and Interactive layers deferred.
10. Addressed docs-review feedback by moving `template.codex-report.json` out
    of the default bundle tree and into a requested-report example.

## Verification

- `node dist/esm/bin.mjs md pdf-template codex --help`
  - Passed; verified the simplified public option surface.
- `node dist/esm/bin.mjs md to-pdf --help`
  - Passed; verified the documented follow-up render flags.
- `node dist/esm/bin.mjs doctor --json`
  - Passed; confirmed `weasyprint` is unavailable in this environment.
- `git diff --check`
  - Passed.
- `bun run format:check`
  - Passed.
- `bun run lint`
  - Passed.
- `bunx tsc --noEmit`
  - Passed.
- `bun run build`
  - Passed.
- `bun test --timeout 30000`
  - Passed: 1331 tests across 195 files.

## Review

- Docs review
  - `docs_reviewer` found one required guide correction and one expected
    closeout sequencing note.
  - The guide correction was addressed in this pass.
  - The plan closeout gate remains open until final full-plan range review is
    recorded.
- Pending final full-plan range review.
