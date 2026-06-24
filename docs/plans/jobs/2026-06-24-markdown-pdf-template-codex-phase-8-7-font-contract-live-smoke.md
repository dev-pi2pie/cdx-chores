---
title: "Markdown PDF template Codex phase 8.7 font contract and live smoke"
created-date: 2026-06-24
modified-date: 2026-06-24
status: in-progress
agent: codex
plan: ../plan-2026-06-23-markdown-pdf-template-codex-helper.md
---

## Scope

Implement Phase 8.7 of the direct `md pdf-template codex` plan.

This phase keeps `--font-hint` as a supported Template-Codex signal by changing
the font decision contract from role-only decisions to bounded role/key
decisions that mirror profile-Codex where practical. The phase also proves the
live helper can return an inspectable successful font-hint result without
persisting private local smoke artifacts.

## Sequence

1. Compared profile-Codex `accepted_font_patches` with the template-Codex
   `font_decisions` contract.
2. Added `font_decisions[].key` to the strict Template-Codex output schema,
   parser, local decision type, and materialized diagnostic report shape.
3. Validated bounded role/key combinations locally:
   `body.default`, `body.<language-tag>`, `code.default`, `code.symbols`, and
   `heading.default`.
4. Changed duplicate detection from role-only to `role.key`.
5. Changed base-profile font ownership checks from role-only to exact role/key.
6. Synthesized body language decisions as prose-scoped `:lang(...)` rules and
   code symbol decisions as part of the monospace fallback stack.
7. Kept `pdf.content-langs` as expected coverage ordering for body fallback
   stacks, not as precise text labeling.
8. Tightened Template-Codex fallback categories so runner/schema/malformed/apply
   failures are reported as sanitized failure kinds instead of a single generic
   unavailable message.
9. Added focused adapter, synthesis, action-report, and profile-parity coverage.
10. Ran a live Template-Codex smoke without `--font-hint`; it returned an
    adapted dry-run decision.
11. Ran a live Template-Codex smoke with a sanitized CJK-compatible font hint;
    it returned an adapted dry-run decision.
12. Ran a disposable live Template-Codex write with a general sanitized font
    hint; one attempt returned a categorized `invalid-application` fallback, so
    the phase did not treat that as completion evidence.
13. Reran the disposable live Template-Codex write with an explicit sanitized
    role/key font hint. It returned an adapted bundle plus diagnostic report
    with bounded applied font decisions for body, language-specific body, code,
    and code-symbol keys.
14. Confirmed generated CSS included a global body fallback stack, `:lang(...)`
    body font rules, and a code symbol fallback stack.
15. Deleted all disposable playground output directories after inspection.
16. Ran the initial Phase 8.7 commit-range code review. Review found three
    bounded contract issues: case-variant language keys could bypass duplicate
    and profile-ownership checks, truncated base-profile font signals were not
    treated conservatively, and bare `:lang(...)` selectors could override
    heading or code font choices.
17. Added canonical body language-key handling for duplicate checks, profile
    ownership, and `pdf.content-langs` ordering.
18. Treated truncated base-profile font summaries as conservative ownership for
    loose template font hints unless the decision explicitly records
    template-level ownership.
19. Scoped language-specific body CSS to prose selectors so heading and code font
    decisions keep precedence.
20. Added regressions for canonical language-key duplicate rejection, canonical
    profile ownership, truncated base-profile blocking, and prose-scoped
    language CSS.
21. Ran the Phase 8.7 range re-review after the first review-fix commit. Review
    confirmed canonical language keys and truncated profile-font blocking were
    fixed, but found the span language selector still too broad for nested
    heading/code content.
22. Tightened the language span selector from any prose descendant to direct
    prose children so language spans in nested headings or code descendants do
    not receive body-language font overrides.

## Changes

- Added role/key font decisions to Template-Codex schema and parser.
- Added local role/key validation matching profile-Codex for overlapping roles.
- Added key-aware profile-font ownership blocking.
- Added canonical language-key handling for key-aware profile-font ownership
  blocking.
- Added language-specific prose body font CSS and code symbol font fallback
  synthesis.
- Tightened language-specific span selectors to direct prose children so nested
  heading and code content keep their role font choices.
- Added conservative blocking for loose template font hints when base-profile
  font summaries are truncated.
- Added sanitized Template-Codex failure categories:
  `structured-output-schema`, `malformed-output`, `invalid-application`, and
  `unavailable`.
- Added regression coverage for prompt role/key facts, schema strictness,
  role/key validation, key-aware profile ownership, CSS synthesis, reports, and
  path-safe failure categories.

## Verification

- `bunx tsc --noEmit`
  - Passed after the initial contract and synthesis implementation.
- `bun test test/adapters-codex-markdown-pdf-template.test.ts test/cli-actions-md-to-pdf-template-codex/template-synthesis.test.ts test/cli-actions-md-to-pdf-template-codex/action-integration.test.ts`
  - Passed: 56 tests.
- `bun test test/adapters-codex-markdown-pdf-template.test.ts test/cli-actions-md-to-pdf-template-codex/*.test.ts test/cli-actions-md-to-pdf-profile-codex-action.test.ts test/adapters-codex-markdown-pdf-profile.test.ts`
  - Passed: 178 tests.
- `bun run format:check`
  - Failed before formatting due line wrapping in two edited files.
- `bun run format`
  - Applied formatting.
- `bun run format:check`
  - Passed after formatting.
- `bun run build`
  - Passed before live smoke.
- `bunx tsc --noEmit`
  - Passed after live smoke and docs updates.
- `bun run lint`
  - Passed after live smoke and docs updates.
- `bun run format:check`
  - Passed after live smoke and docs updates.
- `git diff --check`
  - Passed after live smoke and docs updates.
- `bun run build`
  - Passed after live smoke and docs updates.
- `bun test --timeout 30000`
  - Passed: 1324 tests.
- Live Template-Codex smoke without `--font-hint`
  - Result: adapted dry-run decision; no files written.
- Live Template-Codex smoke with a general sanitized CJK-compatible `--font-hint`
  - Result: adapted dry-run decision; no files written.
- Disposable live Template-Codex write with a general sanitized `--font-hint`
  - Result: categorized `invalid-application` fallback; treated as a useful
    diagnostic, not completion evidence.
- Disposable live Template-Codex write with an explicit sanitized role/key
  `--font-hint`
  - Result: adapted bundle plus diagnostic report with bounded applied font
    decisions and static validation passed.
  - CSS inspection confirmed global body fallback, language-specific `:lang(...)`
    rules, and a code symbol fallback stack.
- Playground cleanup
  - Disposable smoke output directories were removed after inspection.
- Review-fix verification
  - `bunx tsc --noEmit` passed after the review fixes.
  - `bun test test/adapters-codex-markdown-pdf-template.test.ts test/cli-actions-md-to-pdf-template-codex/template-synthesis.test.ts`
    passed: 44 tests.
  - `bun test test/adapters-codex-markdown-pdf-template.test.ts test/cli-actions-md-to-pdf-template-codex/*.test.ts test/cli-actions-md-to-pdf-profile-codex-action.test.ts test/adapters-codex-markdown-pdf-profile.test.ts`
    passed: 180 tests.
  - `bun run format:check` failed before formatting due wrapping in
    `slots.ts`; `bun run format` applied formatting.
  - `bunx tsc --noEmit`, `bun run lint`, `bun run format:check`,
    `git diff --check`, and `bun run build` passed after formatting.
  - `bun test --timeout 30000` passed: 1326 tests across 195 files.
- Second review-fix verification
  - `bun test test/adapters-codex-markdown-pdf-template.test.ts test/cli-actions-md-to-pdf-template-codex/template-synthesis.test.ts test/cli-actions-md-to-pdf-template-codex/action-integration.test.ts`
    passed: 58 tests.
  - `bun test test/adapters-codex-markdown-pdf-template.test.ts test/cli-actions-md-to-pdf-template-codex/*.test.ts test/cli-actions-md-to-pdf-profile-codex-action.test.ts test/adapters-codex-markdown-pdf-profile.test.ts`
    passed: 180 tests.
  - `bunx tsc --noEmit`, `bun run lint`, `bun run format:check`,
    `bun run build`, and `git diff --check` passed.
  - `bun test --timeout 30000` passed: 1326 tests across 195 files.

## Reviews

- Initial Phase 8.7 commit-range review
  `457e22bc2d90e600b9ac781092f893faba2d0c93..86d67b4` found three P2
  issues: canonical language-key ownership, truncated profile-font ownership,
  and language selector cascade precedence.
- Phase 8.7 re-review of
  `457e22bc2d90e600b9ac781092f893faba2d0c93..f2f36f5` confirmed canonical
  language keys and truncated profile-font blocking were fixed, then found one
  remaining P2 selector issue for nested heading/code spans.
- Pending second review-fix commit and final Phase 8.7 commit-range re-review.
