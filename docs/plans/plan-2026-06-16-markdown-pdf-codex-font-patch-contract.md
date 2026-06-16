---
title: "Markdown PDF Codex font patch contract implementation"
created-date: 2026-06-16
status: complete
agent: codex
---

## Goal

Implement a dedicated strict `accepted_font_patches` contract for `md pdf-profile codex` so Codex can adapt profile font maps without relying on a finite JSON Pointer enum for every language key.

This plan is the branch feature referenced by Phase 6.5 of `docs/plans/plan-2026-06-15-markdown-pdf-codex-profile-helper.md`.

## Related Research

- `docs/researches/research-2026-06-16-markdown-pdf-codex-font-patch-contract.md`

## Starting State

The current helper has:

- a strict root structured-output schema
- `accepted_patches` for enum-backed JSON Pointer replacements
- runtime validation for enum-sensitive values such as page size, cover style, page-number position, and code theme
- profile validation that accepts `fonts.body.default` and valid language-tag keys
- renderer support for `fonts.code.symbols`
- guide examples that document mixed-language body font keys and code symbol fonts

The current helper does not have:

- a dedicated Codex output shape for font map writes
- runtime validation for Codex font role/key combinations
- report artifact support for font patches
- prompt rules that separate layout patches from font map patches

## Scope

### In Scope

- Add `accepted_font_patches` to the Markdown PDF Codex structured output schema.
- Parse and validate `accepted_font_patches`.
- Apply font patches into the selected profile candidate before final profile validation.
- Route all Codex font writes through `accepted_font_patches`.
- Remove or stop using normal `/fonts/...` JSON Pointer paths after the dedicated font contract is available.
- Update Codex diagnostic reports to record accepted font patches.
- Update prompt facts and rules so Codex uses the dedicated font patch contract.
- Add focused tests for schema shape, parser validation, profile application, reports, and action output.
- Keep generated profile/report/PDF artifacts out of commits.

### Out Of Scope

- No new CLI hint flags.
- No arbitrary profile object output.
- No local cover image support.
- No template Codex helper.
- No renderer font fallback redesign.
- No installed-font-dependent CI assertions.

## Contract

Structured output should include `accepted_font_patches` as a required array:

```json
{
  "decision_mode": "adapted",
  "selected_candidate_id": "default",
  "accepted_patches": [],
  "accepted_font_patches": [
    {
      "op": "replace-font",
      "role": "body",
      "key": "ja",
      "value": "Noto Serif JP"
    }
  ],
  "reasoning": "Japanese body text was detected and the font hint named a matching family.",
  "warnings": [],
  "fallback_reason": "",
  "unmatched_directions": []
}
```

Validation rules:

- `op` must be `replace-font`.
- `role` must be `body`, `heading`, `code`, or `pageChrome`.
- `body` accepts `default` or a valid language-tag key.
- `code` accepts `default` or `symbols`.
- `heading` accepts `default`.
- `pageChrome` accepts `default`.
- `value` must be a non-empty string.
- scalar and array parents in an existing profile fail closed.

## Phase 1: Schema And Types

- [x] Add `accepted_font_patches` to the Markdown PDF Codex output schema.
- [x] Keep the schema strict with required properties and `additionalProperties: false`.
- [x] Add shared TypeScript types for font patches.
- [x] Add parser coverage for valid and malformed font patch responses.
- [x] Verify the output schema remains accepted by the strict structured-output API shape.

Job record: `docs/plans/jobs/2026-06-16-markdown-pdf-codex-font-patch-phase-1-schema-types.md`

## Phase 2: Validation And Application

- [x] Add role/key validation for font patches.
- [x] Reuse profile language-tag validation for `body` keys.
- [x] Materialize missing `fonts` and font role objects only as plain objects.
- [x] Reject scalar or array parents.
- [x] Apply font patches before final profile shape validation and normalization.
- [x] Remove or stop using normal `/fonts/...` accepted patch paths.

Job record: `docs/plans/jobs/2026-06-16-markdown-pdf-codex-font-patch-phase-2-validation-application.md`

## Phase 3: Prompt And Report

- [x] Update prompt rules so Codex uses `accepted_font_patches` for all font writes.
- [x] Include font patch examples only as bounded JSON, not YAML.
- [x] Keep `--font-hint` as the only dedicated font hint flag.
- [x] Bump the Codex report artifact version.
- [x] Record `acceptedFontPatches` in success reports.
- [x] Update report-contract tests and inline schema comments for the new `acceptedFontPatches` payload.
- [x] Record the user-visible generated-profile change: font patches still serialize as normal `fonts` YAML or JSON.
- [x] Record the user-visible report change: diagnostic reports expose accepted font decisions separately from normal accepted patches.
- [x] Keep unsupported font requests in warnings or `unmatched_directions` when they cannot be represented.

Job record: `docs/plans/jobs/2026-06-16-markdown-pdf-codex-font-patch-phase-3-prompt-report.md`

## Phase 4: Action Coverage And Smoke

- [x] Update action tests for dry-run and write paths.
- [x] Cover body default, body language tag, code default, code symbols, heading default, and pageChrome default.
- [x] Cover invalid role/key combinations.
- [x] Cover report retention with accepted font patches.
- [x] Run focused tests for adapter, action, report, and profile normalization behavior.
- [x] Run artifact-safe smoke tests with `--dry-run` and no Codex report flags.
- [x] Verify no generated profile, report, PDF, or replay artifacts are staged or committed.

Job record: `docs/plans/jobs/2026-06-16-markdown-pdf-codex-font-patch-phase-4-action-smoke.md`

## Phase 5: Review And Integration

- [x] Update Phase 6.5 checklist in `docs/plans/plan-2026-06-15-markdown-pdf-codex-profile-helper.md`.
- [x] Add a focused job record for the font patch branch.
- [x] Commit the branch feature with a Conventional Commit message.
- [x] Run code review over the branch commit range.
- [x] Feed any review follow-ups back into this plan before marking it complete.

Job record: `docs/plans/jobs/2026-06-16-markdown-pdf-codex-font-patch-phase-5-review-integration.md`

Branch implementation commits:

- `0f09d8c` `feat(markdown-pdf): add accepted_font_patches schema and parser`
- `5a20047` `feat(adapters/codex): route markdown pdf font writes through accepted_font_patches`
- `e601421` `feat(markdown-pdf): add accepted font patches to codex prompt and report`
- `bc39222` `test(repo): cover codex font patch phase 4 action smoke`

## Validation

Minimum validation before implementation closeout:

```bash
bun test test/adapters-codex-markdown-pdf-profile.test.ts
bun test test/cli-actions-md-to-pdf-profile-codex-action.test.ts
bun run format:check
bun run lint
bun run build
git diff --check
```

Run broader `bun test` if the implementation touches shared profile normalization, report serialization, or action wiring beyond the narrow adapter path.

## Documentation Follow-Up

The user-facing command surface does not change in this branch. Users still provide document input, `--intent`, `--font-hint`, `--base-profile`, and output/report flags through `md pdf-profile codex`.

The user-visible output and diagnostic contract does change:

- generated profiles may include language-keyed `fonts.body` entries and `fonts.code.symbols`
- Codex diagnostic reports include `acceptedFontPatches`
- normal `acceptedPatches` no longer carry font writes after the dedicated contract lands

The full guide work remains in Phase 7 of the active profile-helper plan. This branch should leave clear implementation notes for that guide to document:

- normal accepted patches for fixed profile leaves
- dedicated font patches for font map writes
- examples for mixed-language body fonts
- examples for `fonts.code.symbols`
- unsupported directions such as local cover images and custom HTML/CSS layout
