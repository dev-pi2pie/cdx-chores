---
title: "Markdown PDF template Codex phase 8.4 font hint materialization"
created-date: 2026-06-24
modified-date: 2026-06-24
status: in-progress
agent: codex
plan: ../plan-2026-06-23-markdown-pdf-template-codex-helper.md
---

## Scope

Implement Phase 8.4 of the direct `md pdf-template codex` plan.

This phase makes `--font-hint` materially useful for Template-Codex output
without letting loose font preferences silently override concrete base-profile
font choices.

## Sequence

1. Compared the existing profile-Codex font-patch path with the current
   Template-Codex prompt, schema, and synthesis path.
2. Confirmed Template-Codex already collects, reports, and forwards font hints
   but still synthesizes fixed default font stacks.
3. Added strict `font_decisions` fields for bounded body, heading, and code
   font choices.
4. Added validation for font roles, single-family values, duplicate roles, and
   no-usable-template empty font decisions.
5. Added ownership-aware materialization: loose decisions apply only when no
   base-profile font owns the role, while explicit template-level decisions can
   override and must be reported.
6. Materialized accepted font decisions into generated CSS variables.
7. Updated diagnostic reports to record font decisions, status, profile
   ownership, and override state without local font paths.
8. Added adapter, synthesis, action, and report coverage for font decisions and
   precedence.
9. Ran the focused Phase 8.4 validation target, profile-Codex regression
   coverage, repository gates, and the full test suite.
10. Added a review-follow-up hardening check so direct decision application
    rejects malformed `template_level` values instead of coercing them.
11. Addressed code-review feedback by coupling `template_level: true` to
    `source: "template-style"` so a loose font hint cannot be reported while
    also taking template-level override ownership.

## Changes

- Added a strict Template-Codex `font_decisions` contract.
- Kept font output schema-owned instead of using arbitrary raw CSS blocks.
- Preserved base-profile font precedence for loose `--font-hint` choices.
- Added explicit template-level override reporting for profile-owned roles.
- Added generated CSS variable materialization for accepted body, heading, and
  code font decisions.

## Verification

- `bun test test/adapters-codex-markdown-pdf-template.test.ts test/cli-actions-md-to-pdf-template-codex/template-synthesis.test.ts test/cli-actions-md-to-pdf-template-codex/action-integration.test.ts`
  - Passed after implementation: 42 tests.
- `bunx tsc --noEmit`
  - Passed after implementation.
- `bun test test/cli-actions-md-to-pdf-template-codex/*.test.ts test/adapters-codex-markdown-pdf-template.test.ts test/cli-actions-md-to-pdf-profile-codex-action.test.ts test/adapters-codex-markdown-pdf-profile.test.ts`
  - Passed after formatting: 157 tests.
- `bun run lint`
  - Passed after implementation and formatting.
- `bun run format:check`
  - Passed after formatting the touched source files.
- `bun run build`
  - Passed after implementation.
- `git diff --check`
  - Passed after implementation and formatting.
- `bun test --timeout 30000`
  - Passed after implementation: 1303 tests.
- `bun test test/adapters-codex-markdown-pdf-template.test.ts test/cli-actions-md-to-pdf-template-codex/template-synthesis.test.ts test/cli-actions-md-to-pdf-template-codex/action-integration.test.ts`
  - Passed after the malformed `template_level` validator follow-up: 42 tests.
- `bunx tsc --noEmit`
  - Passed after the malformed `template_level` validator follow-up.
- `bun run format:check`
  - Passed after the malformed `template_level` validator follow-up.
- `git diff --check`
  - Passed after the malformed `template_level` validator follow-up.
- `bun run lint`
  - Passed after the malformed `template_level` validator follow-up.
- `bun test test/adapters-codex-markdown-pdf-template.test.ts test/cli-actions-md-to-pdf-template-codex/template-synthesis.test.ts test/cli-actions-md-to-pdf-template-codex/action-integration.test.ts`
  - Passed after the `template_level`/`source` ownership coupling fix: 42 tests.
- `bunx tsc --noEmit`
  - Passed after the `template_level`/`source` ownership coupling fix.
- `bun run format:check`
  - Passed after the `template_level`/`source` ownership coupling fix.
- `git diff --check`
  - Passed after the `template_level`/`source` ownership coupling fix.
- `bun run lint`
  - Passed after the `template_level`/`source` ownership coupling fix.

## Reviews

- Plainspoken the 6th found that `source: "font-hint"` with
  `template_level: true` could pass validation and create misleading override
  provenance. The follow-up validator change rejects that combination.
- Probe the 6th review pending on the final Phase 8.4 range.
