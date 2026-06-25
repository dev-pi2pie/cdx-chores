---
title: "Markdown PDF template Codex phase 5 adapter schema"
created-date: 2026-06-23
modified-date: 2026-06-23
status: completed
agent: codex
plan: ../plan-2026-06-23-markdown-pdf-template-codex-helper.md
---

## Scope

Implement Phase 5 of the direct `md pdf-template codex` plan.

This phase adds the Codex adapter prompt, strict structured-output schema,
decision parsing, and pre-synthesis decision validation for template choices.
It does not write template bundles, copy assets, emit reports, or run final
static bundle validation; those remain later phases.

## Implementation Notes

- Keep the adapter under `src/adapters/codex/markdown-pdf-template/` so it
  follows the existing Codex adapter boundary.
- Keep Codex output as bounded decisions and slots, not generated files.
- Preserve strict structured-output rules: all object properties are required
  by the schema, optional semantics use empty strings or empty arrays, and all
  objects use `additionalProperties: false`.
- Use managed asset summaries and bundle-relative asset references only.
- Treat image sizing as semantic slots such as `contain` or `cover`; source
  pixel dimensions may inform the prompt but must not become raw CSS sizing
  directives in Codex decisions.

## Changes

- Added the Markdown PDF template Codex adapter under
  `src/adapters/codex/markdown-pdf-template/`.
- Added bounded prompt facts for supported template families, recipe presets,
  slot enums, hook requirements, document signals, recipe/base-profile signals,
  font facts, managed asset summaries, and cover image sizing signals.
- Added a strict structured-output schema for template decisions. All schema
  object properties are required and all schema objects use
  `additionalProperties: false`.
- Added decision parsing and validation for decision mode, template family,
  recipe preset, semantic slots, optional CSS blocks, managed assets, warnings,
  unsupported directions, and fallback reason.
- Added template-Codex decision helpers in
  `src/cli/markdown-pdf/template-codex/codex-decision.ts`.
- Added CSS-block validation in
  `src/cli/markdown-pdf/template-codex/css-blocks.ts` for slot ownership, size
  limits, remote URL rejection, absolute local path rejection, raw pixel image
  sizing rejection, `@`-rule rejection, and required selector preservation.
- Validated managed assets against the output plan and derived display labels
  from planned asset metadata instead of trusting Codex-returned labels.
- Converted unavailable Codex and invalid structured-output decisions to
  `no-usable-template` using redacted fallback reasons.
- Added adapter regression coverage for adapted decisions, conservative
  fallback decisions, invalid structured output, unavailable Codex, unsafe CSS,
  schema sentinels, no-usable sentinels, cover-family gating, bundle-relative
  asset validation, and cover-enabled image-fit rejection.

## Verification

- `bun test test/adapters-codex-markdown-pdf-template.test.ts`
  - Passed after the final cover-enabled image-fit regression: 16 tests.
- `bun test test/adapters-codex-markdown-pdf-template.test.ts test/cli-actions-md-to-pdf-template-codex/*.test.ts test/cli-actions-md-to-pdf-commands.test.ts`
  - Passed after the final cover-enabled image-fit regression: 90 tests.
- `bunx tsc --noEmit`
  - Passed after the final cover-enabled image-fit regression.
- `bun run format:check`
  - Passed before the final test-only regression and after the Phase 5
    hardening commit.
- `bun run lint`
  - Passed after the Phase 5 hardening commit.
- `bun run build`
  - Passed after the Phase 5 hardening commit.
- `git diff --check`
  - Passed before each Phase 5 implementation and review-fix commit.
- `bun test --timeout 30000`
  - Passed after the final cover-enabled image-fit regression: 1272 tests.

## Review

- Phase range reviewed as `c4d111b..8ca3b36`.
- `auto_commit_notification` was used before each meaningful commit boundary.
- Maintainability review initially found overly broad fallback handling, raw
  fallback messages, heuristic CSS selector ownership, and trusted
  Codex-returned `source_label` values. Follow-up commits split runner and
  decision fallback handling, redacted fallback reasons, replaced token
  ownership with exact selector allowlists, and derived source labels from the
  output plan. Final maintainability review found no material concerns.
- Test review initially found missing coverage for no-usable sentinels, CSS
  guard branches, cover-family gating, schema sentinels, bundle-relative asset
  validation, and enabled cover slots with empty image-fit decisions. Follow-up
  commits added focused regression coverage. Final test review found no
  material coverage gaps.

Phase 5 implementation commits:

- `92fb99b` `feat(markdown-pdf-template-codex): add strict Phase 5 Codex adapter validation`
- `710f0e5` `fix(template-codex): tighten fallback and CSS validation handling`
- `43e4365` `fix(markdown-pdf): harden Codex template validation`
- `8ca3b36` `test(adapters): reject cover slots without an image-fit decision`
