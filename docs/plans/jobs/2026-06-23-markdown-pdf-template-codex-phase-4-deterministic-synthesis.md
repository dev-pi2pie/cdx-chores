---
title: "Markdown PDF template Codex phase 4 deterministic synthesis"
created-date: 2026-06-23
modified-date: 2026-06-23
status: completed
agent: codex
plan: ../plan-2026-06-23-markdown-pdf-template-codex-helper.md
---

## Scope

Implement Phase 4 of the direct `md pdf-template codex` plan.

This phase adds deterministic template-family selection, semantic slot
resolution, managed asset binding for synthesized HTML, and repo-owned
`template.html` / `style.css` content generation. It does not write bundle
files, copy assets, run Codex, or render PDFs; those remain later phases.

## Implementation Notes

- Keep slot resolution semantic and path-free. Bundle-relative asset paths are
  bound during deterministic synthesis from the output plan.
- Carry `decisionMode: deterministic` in the synthesis result so later Codex
  adapter, report, and summary phases do not need to infer it again.
- Keep source image `fitPressure` as the Phase 2 image-aspect signal and map it
  to bounded `imageFit` slots during synthesis.
- Keep generated cover image CSS page-relative; source pixel dimensions may be
  recorded as signals but must not become rendered CSS width or height.

## Changes

- Added deterministic template-family registry and synthesis modules for
  `document-layered` and `cover-media-layered`.
- Added semantic slot resolution for recipe preset provenance, cover layout,
  cover image fit, table density, spacing, typography, color tokens, and
  Shiki-compatible code styling.
- Bound planned managed assets by role so synthesized cover HTML references the
  output-plan bundle path rather than source paths.
- Generated repo-owned `template.html` and `style.css` strings with identity
  comments, Pandoc placeholders, ToC hooks, cover-media hooks, page-relative
  cover image CSS, and Shiki selector preservation.
- Added contract-owned family hook validation with named hook IDs and shared
  contract constants consumed by HTML/CSS synthesis and tests.
- Shared effective ToC page-break resolution between the existing Markdown PDF
  recipe path and template-Codex CSS synthesis.
- Split template-Codex type definitions into command, signal, output-plan, and
  synthesis type modules while preserving the existing `types.ts` barrel.
- Updated action and command tests so deterministic synthesis reaches the
  Phase 6 write-bundle boundary and dry-runs print the selected synthesis
  summary.

## Verification

- `bun test test/cli-actions-md-to-pdf-template-codex/*.test.ts test/cli-actions-md-to-pdf-commands.test.ts`
  - Passed: 72 tests before later review-hardening commits.
- `bun test test/cli-actions-md-to-pdf-template-codex/*.test.ts test/cli-actions-md-to-pdf-commands.test.ts test/cli-actions-md-to-pdf-recipe.test.ts`
  - Passed: 83 tests after shared ToC resolver, structured hook validation,
    unknown cover metadata coverage, and stronger ToC assertions.
- `bun test test/cli-actions-md-to-pdf-template-codex/template-synthesis.test.ts`
  - Passed: 7 tests after the exact `#TOC` selector assertion follow-up.
- `bun test test/cli-actions-md-to-pdf-template-codex/slots.test.ts`
  - Passed: 7 tests after explicit recipe/base-profile provenance coverage.
- `bunx tsc --noEmit`
  - Passed after each review-fix batch.
- `bun run format:check`
  - Passed after final formatting.
- `bun run lint`
  - Passed.
- `bun run build`
  - Passed.
- `git diff --check`
  - Passed.
- `bun test --timeout 30000`
  - Passed: 1255 tests.

## Review

- Phase range reviewed as `bf51511..HEAD`.
- `auto_commit_notification` was used before meaningful commits and
  recommended splitting mixed follow-up work into separate contract/type
  commits.
- Maintainability review initially found duplicated family hook ownership,
  overloaded `types.ts`, duplicated ToC page-break branching, and raw hook
  validation. Follow-up commits centralized contract constants and validation,
  split layer-owned types, and shared the effective ToC resolver. Final
  maintainability review found no material concerns.
- Test review initially found missing default preset coverage, cover wrapper
  and caption CSS assertions, brittle CSS snapshots, missing cover-asset
  failure coverage, missing non-report and explicit `after` ToC branches,
  unknown cover metadata fallback coverage, weak ToC selector assertions, and
  explicit recipe/base-profile provenance coverage. Follow-up commits added
  focused coverage and stronger selector-aware CSS parsing. Final test review
  found no material gaps.

Phase 4 implementation commits:

- `6a47188` `feat(cli): add deterministic markdown pdf template codex synthesis`
- `ecd7a47` `fix(template-codex): bind cover assets by role and branch cover layout in CSS`
- `a9cc545` `fix(template-codex): centralize preset defaults and validate family hooks`
- `556a9a3` `refactor(template-codex): split template and CSS hook validation`
- `0b92979` `refactor(template-codex): centralize synthesis contract hooks`
- `e929c65` `refactor(template-codex): split layer-owned types`
- `6178c95` `refactor(template-codex): share ToC resolution and hook validation`
- `3f33392` `test(cli-actions-md-to-pdf-template-codex): cover toc page-break after synthesis`
- `768b0dc` `test(md-to-pdf-template-codex): strengthen TOC page-break assertions`
- `7e3f74d` `test(template-codex): require exact selector blocks in CSS parsing`
- `80bb175` `test(cli-actions-md-to-pdf-template-codex): cover explicit recipe preset provenance override`
