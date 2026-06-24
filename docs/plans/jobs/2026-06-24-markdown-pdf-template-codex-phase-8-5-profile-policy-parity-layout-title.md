---
title: "Markdown PDF template Codex phase 8.5 profile policy parity for layout and title"
created-date: 2026-06-24
modified-date: 2026-06-24
status: completed
agent: codex
plan: ../plan-2026-06-23-markdown-pdf-template-codex-helper.md
---

## Scope

Implement Phase 8.5 of the direct `md pdf-template codex` plan.

This phase brings template-Codex closer to profile-Codex for document-informed
wide-table, title, and page-number ownership policy while keeping the ownership
split explicit: profile-Codex owns reusable page/render policy by default, and
template-Codex owns reviewable presentation structure, cover-image bundles, and
managed assets.

## Sequence

1. Compared the profile-Codex table layout and title-block policy with the
   current template-Codex signal, slot, synthesis, and report paths.
2. Extracted the profile table-layout signal ladder into a shared helper.
3. Added template-Codex layout policy signals that derive `wide-table` only
   from strong table pressure when no explicit or base-profile page recipe
   owner exists.
4. Preserved weak table pressure as table styling evidence only.
5. Added validation that Codex-assisted recipe decisions match the effective
   recipe preset and source, preventing silent profile/page-policy overrides.
6. Added template title-policy synthesis for duplicate frontmatter title plus
   first `H1`, and for cover-title-owned visible title placement.
7. Kept page numbers profile-owned by default and added render compatibility
   coverage proving template CSS does not emit page-number margin boxes while
   profile CSS can still provide them.
8. Recorded layout and title ownership decisions in the diagnostic report.
9. Added focused signal, adapter, synthesis, action-report, and render
   compatibility coverage.
10. Ran a privacy-safe dry-run smoke against the playground CJK Markdown sample
    with a sanitized CJK-oriented font hint. The local Codex request was
    unavailable, so the command returned the existing no-usable-template
    fallback without writing files or reports.
11. Reviewed the initial Phase 8.5 range and found two follow-up issues:
    document-derived recipe provenance used prompt wording that could drift from
    the strict decision schema, and title policy did not yet preserve explicit
    or base-profile metadata title ownership.
12. Added schema-valid recipe provenance facts to the template-Codex prompt and
    added shared title-intent helpers plus template title ownership signals for
    explicit/base-profile show and hide decisions.
13. Committed the review-fix slice as `94cf40a` after a hard
    `auto_commit_notification` checkpoint.

## Changes

- Shared the profile-Codex table layout signal ladder with template-Codex.
- Added `document-signal` recipe preset provenance for derived wide-table
  layout.
- Added layout policy diagnostics for applied, blocked, and not-needed
  document table recipe derivation.
- Added recipe ownership validation for Codex-assisted template decisions.
- Added title policy synthesis to suppress duplicate visible metadata title
  blocks and cover-title duplicate title blocks.
- Added title policy precedence for explicit keep/hide intent and base-profile
  `titleBlock.metadataTitle` ownership before default duplicate-title
  suppression.
- Added diagnostic report fields for layout and title policy decisions.

## Verification

- `bunx tsc --noEmit`
  - Passed after the initial implementation.
- `bun test test/cli-actions-md-to-pdf-template-codex/*.test.ts test/adapters-codex-markdown-pdf-template.test.ts`
  - Passed after the initial implementation: 110 tests.
- `bun test test/cli-actions-md-to-pdf-template-codex/*.test.ts test/adapters-codex-markdown-pdf-template.test.ts test/cli-actions-md-to-pdf-actions*.test.ts test/cli-actions-md-to-pdf-profile-codex-action.test.ts test/adapters-codex-markdown-pdf-profile.test.ts`
  - Passed after formatting: 210 tests.
- `bun run build`
  - Passed before the privacy-safe manual smoke.
- Privacy-safe manual `--font-hint` smoke
  - Ran a dry-run against the playground CJK Markdown sample with a sanitized
    CJK-oriented font hint.
  - Result: Codex unavailable fallback, no files written, and no diagnostic
    report persisted.
- `bun run format:check`
  - Passed after formatting.
- `git diff --check`
  - Passed after formatting and docs updates.
- `bun run lint`
  - Passed after formatting.
- `bun test --timeout 30000`
  - Passed after implementation: 1315 tests.
- `bun test test/adapters-codex-markdown-pdf-template.test.ts`
  - Passed after review fixes: 21 tests.
- `bun test test/adapters-codex-markdown-pdf-template.test.ts test/adapters-codex-markdown-pdf-profile.test.ts test/cli-actions-md-to-pdf-template-codex/signal-collection.test.ts test/cli-actions-md-to-pdf-template-codex/template-synthesis.test.ts`
  - Passed after review fixes: 67 tests.
- `bun test test/cli-actions-md-to-pdf-template-codex/*.test.ts test/adapters-codex-markdown-pdf-template.test.ts test/cli-actions-md-to-pdf-actions*.test.ts test/cli-actions-md-to-pdf-profile-codex-action.test.ts test/adapters-codex-markdown-pdf-profile.test.ts`
  - Passed after review fixes: 215 tests.
- `bunx tsc --noEmit`
  - Passed after review fixes.
- `bun run lint`
  - Passed after review fixes.
- `bun run format:check`
  - Passed after review fixes.
- `git diff --check`
  - Passed after review fixes.
- `bun run build`
  - Passed after review fixes.
- `bun test --timeout 30000`
  - Passed after review fixes: 1320 tests.

## Reviews

- Initial review of `40b00b1..9fd6897` found prompt/schema provenance drift for
  document-derived wide-table decisions and missing explicit/base-profile
  metadata title ownership in template title policy.
- Both findings were addressed in `94cf40a`.
- Final re-review of `40b00b1..94cf40a` reported no findings. Both reviewers
  confirmed the previous prompt/schema provenance issue was fixed; the
  title-ownership reviewer also confirmed the previous explicit/base-profile
  metadata title gap was fixed.
