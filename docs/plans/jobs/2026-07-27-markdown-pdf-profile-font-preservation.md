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

Status: completed.

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

- The internal ownership mask is derived only from a real normalized
  compatibility Profile. It records canonical, non-empty role keys plus their
  document CSS slots without entering bounded signals, synthesis results, or
  report types.
- Shared synthesis now accepts the mask as an internal input. Profile-owned
  body, language, heading, and combined-code declarations are omitted, while
  unowned slots and explicit `template_level` decisions retain Template family
  output.
- Body typography now emits size and line height separately, so suppressing its
  family does not remove non-font styling.
- Template font tokens remain available to cover title, subtitle, and byline
  rules without restoring families on Profile-owned document selectors.
- Either `code.default` or `code.symbols` owns the combined code stack.
  Explicit overrides restore every shared code-family selector after inherited
  code styling.
- Generated CSS blocks reject direct and indirect family resets, nested rules,
  and escaped or comment-split validation bypasses. Non-family typography
  declarations and reads of Template font variables remain valid.
- Prompt-shape coverage confirms Codex receives only the bounded
  `profileFonts` summary. The full Profile and internal ownership mask remain
  outside the prompt and persisted artifact contracts.
- Profile-derived `@page` font CSS remains the only page-chrome family surface;
  Template CSS still emits page layout without a page-chrome family.

### Verification

- Phase 2 ownership, synthesis, and adapter tests: 68 passed, 0 failed.
- Repository suite: 1,814 passed, 0 failed.
- TypeScript check: passed.
- Lint and formatting checks: passed.
- Build: passed.
- Diff whitespace check: passed.
- No renderer smoke was required for this internal synthesis phase; production
  authoring-path and rendered-output verification remains in later phases.

### Review

- Reviewed exact range:
  `fee223ce1d8b70da8fd9a34cd551915f42f91640..f73b0fb9b2ab4a0a02c51f598f2e88d1ca699f20`.
- The initial correctness, security, maintainability, and test reviews found
  actionable gaps in combined-code override coverage, CSS lexical and nesting
  defenses, ownership-query consistency, and mixed language/code test
  coverage.
- Widened review passes identified and resolved CSS-wide resets, escaped path
  references, declarations after nested rules, and quoted/comment brace
  handling.
- Final correctness, security, maintainability, and test reviews reported no
  remaining actionable findings.

### Gate

**Passed.** Internal synthesis omits every Profile-owned document family,
bounded CSS cannot introduce an unreported family override, prompt/report
contracts remain bounded, explicit overrides remain deliberate, and non-font
Template styling remains intact. Phase 3 may wire the shared behavior into
direct Template and Project production paths.

## Checkpoint Commits

### Phase 1

- `f98215e` — characterize the shared direct Template and Project conflict.
- `d231ab5` — resolve Phase 1 review gaps and widen regression coverage.

### Phase 2

- `4ad465c` — add the ownership-aware synthesis model and focused coverage.
- `8ab785d` — resolve combined-code, ownership-query, and validator review
  findings.
- `8fd1731` — reject CSS-wide family resets and escaped path bypasses.
- `21ebebe` — reject nested generated CSS rules.
- `f73b0fb` — make brace inspection safe for quoted and commented content.

## Related Documents

- [Markdown PDF Profile font preservation implementation](../plan-2026-07-26-markdown-pdf-profile-font-preservation.md)
- [Markdown PDF Font Selection and Template Preservation](../../researches/research-2026-07-24-markdown-pdf-font-selection-and-template-preservation.md)
