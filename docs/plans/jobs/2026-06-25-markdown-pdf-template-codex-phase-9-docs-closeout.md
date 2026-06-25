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
11. Ran the first final full-plan range review over `c7b4d92^..HEAD` with the
    requested code-review agents.
12. Addressed review findings by requiring enabled cover slots to have a
    planned managed cover image asset, sanitizing persisted follow-up render
    commands to bundle placeholders, blocking remote HTML `srcset` assets by
    default, and removing stale low-signal recipe-flag wording.
13. Removed the playground cover smoke trailing blank line reported by
    `git diff --check c7b4d92^..HEAD`.
14. Ran a second final full-plan range review over `c7b4d92^..HEAD`.
15. Addressed the remaining review findings by making persisted reports ignore
    terminal absolute-path display mode, making `no-usable-template` decisions
    return `NO_USABLE_TEMPLATE` after writing any requested diagnostics, and
    rejecting animated PNG/WebP cover inputs during early command validation.
16. Addressed the final no-usable-template cover-image review finding by making
    fallback decisions cover-disabled, reporting zero managed assets for
    no-usable outputs, and asserting that no-usable reports do not claim cover
    output when a cover image was supplied.
17. Addressed the final no-usable-template consistency review by rejecting
    schema-valid no-usable decisions that keep cover enabled, copying and
    reporting only accepted synthesis-managed assets, and suppressing unwritten
    bundle paths from no-usable CLI summaries.

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
- Focused review-fix tests:
  - Passed:
    `bun test test/adapters-codex-markdown-pdf-template.test.ts test/cli-actions-md-to-pdf-template-codex/action.test.ts test/cli-actions-md-to-pdf-template-codex/bundle-write.test.ts test/cli-actions-md-to-pdf-actions-assets.test.ts`
- Focused second-review-fix tests:
  - Passed:
    `bun test test/cli-actions-md-to-pdf-template-codex/action-integration.test.ts test/cli-actions-md-to-pdf-template-codex/bundle-write.test.ts test/cli-actions-md-to-pdf-template-codex/command-state.test.ts test/cli-actions-md-to-pdf-template-codex/image-metadata.test.ts`
- Focused final-review-fix tests:
  - Passed:
    `bun test test/adapters-codex-markdown-pdf-template.test.ts test/cli-actions-md-to-pdf-template-codex/action-integration.test.ts test/cli-actions-md-to-pdf-template-codex/bundle-write.test.ts`
- Focused final-consistency-fix tests:
  - Passed:
    `bun test test/adapters-codex-markdown-pdf-template.test.ts test/cli-actions-md-to-pdf-template-codex/action-integration.test.ts test/cli-actions-md-to-pdf-template-codex/bundle-write.test.ts test/cli-actions-md-to-pdf-actions.test.ts test/cli-actions-md-to-pdf-actions-assets.test.ts`
- `bun test --timeout 30000`
  - Passed: 1335 tests across 195 files.

## Review

- Docs review
  - `docs_reviewer` found one required guide correction and one expected
    closeout sequencing note.
  - The guide correction was addressed in this pass.
  - The plan closeout gate remains open until final full-plan range review is
    recorded.
- Pending final full-plan range review.
- First final full-plan range review
  - Requested reviewers found actionable issues in cover-slot validation,
    diagnostic-report path redaction, remote `srcset` blocking, low-signal
    guide wording, and full-range whitespace.
  - The issues were addressed in the follow-up fix slice.
- Second final full-plan range review
  - One reviewer reported no findings after independent focused validation.
  - One reviewer found remaining issues in report path formatting under
    absolute display mode, `no-usable-template` exit behavior, and animated
    cover input validation.
  - The issues were addressed in the second follow-up fix slice.
- Third final full-plan range review
  - One reviewer reported no findings.
  - One reviewer found a remaining no-usable-template reporting inconsistency
    for requests that included a cover image.
  - The issue was addressed in the final follow-up fix slice.
- Fourth final full-plan range review
  - Reviewers found remaining no-usable-template consistency issues for
    schema-valid cover-enabled no-usable responses, unused planned cover assets,
    and summaries that advertised unwritten bundle paths.
  - The issues were addressed in the final consistency fix slice.
