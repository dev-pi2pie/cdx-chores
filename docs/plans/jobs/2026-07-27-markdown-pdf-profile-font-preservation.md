---
title: "Markdown PDF Profile font preservation implementation"
created-date: 2026-07-27
status: in-progress
agent: codex
plan: ../plan-2026-07-26-markdown-pdf-profile-font-preservation.md
---

## Scope

Execute the Markdown PDF Profile font preservation plan one phase at a time.

Phase 1 owns direct Template and Project reproductions, the generated CSS
ownership inventory, live rendered-output evidence, the released-tag boundary,
and the Continue, Constrain, or Stop gate. It does not implement the
ownership-aware synthesis fix.

## Starting Boundary

- Starting commit:
  `b3ce965d82b7c5f24d2835ac871f71ec89f8efcd`
- The worktree was clean before Phase 1 began.
- The implementation plan is `active`.
- The related research remains `in-progress`.

## Execution Protocol

1. Keep Phase 1 characterization coverage passing while it demonstrates the
   current conflict.
2. Record only repository-relative, public-safe evidence.
3. Run focused checks before each meaningful checkpoint.
4. Review the exact Phase 1 implementation range and resolve all actionable
   findings before closing the phase.
5. Do not begin Phase 2 unless the Phase 1 gate is **Continue**.

## Phase 1: Reproduction And Ownership Gate

Status: completed.

### Evidence

- Direct Template generation with a compatibility Profile retains only bounded
  Profile facts for authoring, then emits preset body, heading, and code
  families in `style.css`.
- Project generation preserves the full final Profile in `profile.yml`, but its
  Template phase emits the same effective preset family declarations.
- A Profile-only control render used distinct Profile families for body,
  heading, code, language-specific body text, and page chrome. Adding the
  generated Template CSS changed the embedded body, heading, and code families
  to Template preset fallbacks while leaving the language-specific body family
  and page chrome unchanged.
- Direct Template and Project produced identical rendered PDFs for the
  reproduction. Raster inspection confirmed the same visible typography and
  structurally valid one-page A4 output in both paths.
- Renderer integration passes Profile-derived CSS before generated Template
  CSS. The later body shorthand, heading family, and code family therefore win
  through ordinary cascade order rather than renderer-specific behavior.

### Ownership Inventory

| CSS slot                  | Current generated surface                     | Phase 1 classification                                                         |
| ------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------ |
| Body default              | preset variable plus `body` `font` shorthand  | conflicting Template output overrides Profile                                  |
| Body language             | no Template language selector today           | matching Profile selector remains effective; retain an explicit ownership slot |
| Headings                  | preset variable plus `h1` through `h6` family | conflicting Template output overrides Profile                                  |
| Code stack                | one preset variable consumed by `code`        | either Profile code key must own the combined declaration                      |
| Page chrome               | no generated Template declaration             | Profile-derived `@page` CSS remains sole owner                                 |
| Cover title               | heading variable in a cover shorthand         | Template-owned presentation                                                    |
| Cover subtitle and byline | body variable in cover shorthands             | Template-owned presentation                                                    |

Bounded Codex CSS blocks are appended after synthesized CSS and currently accept
`font`, `font-family`, and Template font custom-property declarations. They are
therefore a second generated family channel that can bypass both the proposed
ownership mask and Project validation unless Phase 2 rejects those declarations.

The deterministic direct Template path without a compatibility Profile still
emits its preset families, confirming that fallback candidates alone must not
claim ownership.

### Released Boundary

- `v0.1.5-canary.4` is the first canary containing both affected authoring
  paths.
- `v0.1.5` is the first stable release containing both affected paths.
- The causal Template synthesis files are unchanged between those two tags, so
  the same reproduction applies without expanding the fix scope.

### Verification

- Focused plan suite: 223 passed, 0 failed.
- Repository suite: 1,802 passed, 0 failed.
- Lint and formatting checks: passed.
- TypeScript check: passed.
- Build: passed.
- Generated direct Template and Project artifacts: inspected.
- Profile-only, direct Template, and Project PDFs: rendered successfully.
- Direct Template and Project PDFs: byte-for-byte comparison passed.
- Rasterized pages: visually inspected.
- PDF metadata and embedded font resources: inspected.
- Diff whitespace check: passed.

### Review

- Reviewed exact range:
  `b3ce965d82b7c5f24d2835ac871f71ec89f8efcd..d231ab5`.
- The initial review found three actionable coverage/documentation gaps:
  the direct characterization bypassed the real base-profile action path,
  language and page-chrome cascade assertions were too narrow, and the
  no-Profile control did not cover heading and code output.
- The review-fix checkpoint added the direct action reproduction, widened those
  assertions, and recorded the exact PDF comparison.
- Correctness, test, and documentation reviewers re-ran against the widened
  range and reported no remaining actionable findings.

### Gate

**Continue.** Both authoring paths reproduce the shared conflict. The ownership
inventory accounts for every current generated family surface, including the
Template-owned cover rules, the Profile-only page-chrome boundary, and bounded
CSS blocks.

## Phase 2: Ownership-Aware Template Synthesis

Status: in progress.

### Scope

Phase 2 owns the internal full-Profile font-ownership model, shared
ownership-aware CSS emission, body shorthand separation, generated CSS-block
family validation, and prompt/report isolation. Direct Template and Project
production wiring remains Phase 3.

### Starting Boundary

- Starting commit:
  `fee223ce1d8b70da8fd9a34cd551915f42f91640`
- The worktree was clean before Phase 2 began.
- Phase 1 passed its **Continue** gate and exact-range review.

### Evidence

Pending.

### Verification

Pending.

### Review

Pending.

### Gate

Pending.

## Checkpoint Commits

### Phase 1

- `f98215e` — characterize the shared direct Template and Project conflict.
- `d231ab5` — resolve Phase 1 review gaps and widen regression coverage.

### Phase 2

Pending.

## Related Documents

- [Markdown PDF Profile font preservation implementation](../plan-2026-07-26-markdown-pdf-profile-font-preservation.md)
- [Markdown PDF Font Selection and Template Preservation](../../researches/research-2026-07-24-markdown-pdf-font-selection-and-template-preservation.md)
