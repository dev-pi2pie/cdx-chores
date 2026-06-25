---
title: "Markdown PDF template Codex phase 8.8 cover composition"
created-date: 2026-06-25
modified-date: 2026-06-25
status: completed
agent: codex
plan: ../plan-2026-06-23-markdown-pdf-template-codex-helper.md
---

## Scope

Implement Phase 8.8 of the direct `md pdf-template codex` plan.

This phase keeps managed cover-image behavior in `md pdf-template codex`, not in
`md pdf-template init`, and replaces stale cover placement fields with bounded
cover composition and text/media layout slots.

## Sequence

1. Added strict cover composition domains for `composition`, `text_align`,
   `media_align`, `image_anchor`, and `media_scale`.
2. Updated the Template-Codex structured output schema and parser to accept the
   new cover slots and derive existing internal sizing/title ownership fields
   from the composition.
3. Updated local decision validation so composition, text alignment, media
   alignment, image anchor, and media scale are checked against bounded enum
   domains.
4. Updated the Codex prompt facts and rules so intent wording such as title
   above image and subtitle below image maps to `title-media-subtitle` instead
   of raw CSS or legacy placement names.
5. Updated deterministic slot defaults so cover-image-only synthesis remains
   conservative: media first, caption after media, centered text/media, centered
   image anchor, and balanced media scale.
6. Updated title-policy ownership so any enabled managed cover composition owns
   visible cover title placement unless explicit or base-profile title ownership
   says otherwise.
7. Updated template synthesis to emit cover title, image, and subtitle in the
   selected bounded order and to expose reviewable `data-*` attributes for the
   selected cover slots.
8. Updated CSS synthesis to map text alignment, media alignment, image anchor,
   and media scale to page-relative CSS without raw source-image pixel sizing.
9. Added diagnostic report and CLI summary visibility for cover composition
   decisions.
10. Added focused tests for schema domains, unbounded composition rejection,
    conservative defaults, `title-media-subtitle` ordering, and bounded CSS
    synthesis.
11. Built the CLI and ran a live Template-Codex smoke against the public
    playground tool-cover Markdown sample and cover asset.
12. Confirmed the live smoke returned an adapted `cover-media-layered` bundle
    with `title-media-subtitle`, centered text, contained image fit, one managed
    asset, and a diagnostic report.
13. Inspected the disposable generated HTML/CSS and confirmed the cover order is
    title, image, then subtitle, with bounded `data-*` attributes and
    page-relative CSS.
14. Attempted the follow-up `md to-pdf` render with the generated template and
    stylesheet; the local run was blocked before rendering because `weasyprint`
    is not installed in this environment.
15. Removed the disposable playground smoke output after inspection.
16. Committed the initial Phase 8.8 implementation slice.
17. Ran commit-range code review on the initial Phase 8.8 commit range.
18. Addressed review findings by replacing split `<figcaption>` markup with
    non-caption wrappers for separated title/subtitle regions, aligning cover
    CSS-block selectors with generated classes, and omitting internal legacy
    cover placement fields from the diagnostic report.
19. Addressed final review feedback by replacing dynamic Pandoc `$title$`
    interpolation inside the cover image `alt` attribute with static,
    attribute-safe alt text.
20. Added follow-up Phase 8.8 task items after a manual render succeeded but
    reported a WeasyPrint warning for the inactive overlay `inset` shorthand,
    and after cover byline placement was identified as an intent-contract gap.
21. Replaced overlay `inset` output with explicit `top`, `right`, `bottom`, and
    `left` declarations so even inactive cover-composition CSS branches avoid
    the unsupported shorthand.
22. Added a bounded `slots.cover.byline` decision with `none`, `author`,
    `date`, and `author-date` values. The default remains `none`, and byline
    output is available only through intent-driven Codex decisions.
23. Updated deterministic cover HTML so requested byline metadata renders after
    the subtitle inside the selected cover composition.
24. Updated generated cover CSS so byline metadata uses block-like spacing
    instead of adjacent inline text.
25. Ran a live Template-Codex smoke with the public playground tool-cover sample
    and an author-after-subtitle intent. The Codex-assisted decision returned
    `title-media-subtitle`, centered text, contained image fit, and
    `cover.byline: author`.
26. Attempted the follow-up `md to-pdf` render again. This environment still
    lacks `weasyprint`, so the command exits before renderer CSS parsing; static
    inspection of the generated bundle confirmed byline markup and no `inset`
    shorthand.
27. Committed the follow-up Phase 8.8 implementation slice and ran commit-range
    code review on `fea3521..abb1515`.

## Changes

- Added bounded Template-Codex cover composition slots:
  `media-first-caption`, `title-media-subtitle`, `title-subtitle-media`, and
  `media-background-overlay`.
- Added bounded cover layout controls for text alignment, media alignment, image
  anchor, and media scale.
- Removed legacy cover layout and title-placement fields from the strict Codex
  output schema.
- Kept `md pdf-template init` out of scope for cover-image asset copying.
- Added report and summary visibility for cover decisions.
- Added optional bounded cover byline decisions for author/date metadata without
  adding CLI flags.
- Replaced overlay cover offset CSS with explicit renderer-compatible
  properties.

## Verification

- `bun test test/adapters-codex-markdown-pdf-template.test.ts test/cli-actions-md-to-pdf-template-codex/*.test.ts`
  - Passed: 125 tests.
- `bunx tsc --noEmit`
  - Passed.
- `bun run lint`
  - Passed.
- `bun run format:check`
  - Passed.
- `bun run build`
  - Passed before the live smoke.
- `git diff --check`
  - Passed.
- `bun test --timeout 30000`
  - Passed: 1330 tests across 195 files.
- Follow-up verification after code-review fixes
  - `bun test test/adapters-codex-markdown-pdf-template.test.ts test/cli-actions-md-to-pdf-template-codex/*.test.ts`
    passed: 125 tests.
  - `bunx tsc --noEmit`, `bun run lint`, `bun run format:check`,
    `bun run build`, and `git diff --check` passed.
  - `bun test --timeout 30000` passed: 1330 tests across 195 files.
- Final alt-attribute review fix
  - `bun test test/adapters-codex-markdown-pdf-template.test.ts test/cli-actions-md-to-pdf-template-codex/*.test.ts`
    passed: 125 tests.
  - `bunx tsc --noEmit`, `bun run lint`, `bun run format:check`,
    `bun run build`, and `git diff --check` passed.
  - `bun test --timeout 30000` passed: 1330 tests across 195 files.
- Live Template-Codex smoke with the public playground tool-cover sample and
  cover asset
  - Result: adapted bundle with `title-media-subtitle`, centered text,
    contained image fit, one managed asset, and diagnostic report output.
  - Disposable generated output was inspected and removed.
  - Command:

    ```bash
    node dist/esm/bin.mjs md pdf-template codex examples/playground/md-pdf/tool-cover-smoke.md --intent "tool introduction cover with title above the image, subtitle below it, centered text" --cover-image examples/playground/md-pdf/assets/tool-cover-sample.jpg --output examples/playground/md-pdf/phase-8-8-cover-smoke-template --keep-codex-report --overwrite
    ```

- Follow-up `md to-pdf` render with the generated template and stylesheet
  - Blocked locally before rendering because `weasyprint` is not installed.
  - Command:

    ```bash
    node dist/esm/bin.mjs md to-pdf --input examples/playground/md-pdf/tool-cover-smoke.md --template examples/playground/md-pdf/phase-8-8-cover-smoke-template/template.html --css examples/playground/md-pdf/phase-8-8-cover-smoke-template/style.css --output examples/playground/md-pdf/phase-8-8-cover-smoke.pdf --overwrite
    ```

- Follow-up byline smoke with the public playground tool-cover sample and cover
  asset
  - Result: adapted bundle with `title-media-subtitle`, `cover.byline: author`,
    centered text, contained image fit, one managed asset, and diagnostic report
    output.
  - Static inspection confirmed the generated HTML includes
    `data-cover-byline="author"` and author byline markup after the subtitle
    block.
  - Static inspection confirmed the generated CSS contains explicit overlay
    offsets and no `inset` shorthand.
  - `md to-pdf` render remains blocked locally before renderer CSS parsing
    because `weasyprint` is not installed.
  - Commands:

    ```bash
    node dist/esm/bin.mjs md pdf-template codex examples/playground/md-pdf/tool-cover-smoke.md --intent "tool introduction cover with title above the image, subtitle and author below it, centered text" --cover-image examples/playground/md-pdf/assets/tool-cover-sample.jpg --output examples/playground/md-pdf/phase-8-8-byline-smoke-template --keep-codex-report --overwrite
    node dist/esm/bin.mjs md to-pdf --input examples/playground/md-pdf/tool-cover-smoke.md --template examples/playground/md-pdf/phase-8-8-byline-smoke-template/template.html --css examples/playground/md-pdf/phase-8-8-byline-smoke-template/style.css --output examples/playground/md-pdf/phase-8-8-byline-smoke.pdf --overwrite
    ```

- Final follow-up verification before commit
  - `bunx tsc --noEmit` passed.
  - `bun test test/adapters-codex-markdown-pdf-template.test.ts test/cli-actions-md-to-pdf-template-codex/action-integration.test.ts test/cli-actions-md-to-pdf-template-codex/slots.test.ts test/cli-actions-md-to-pdf-template-codex/template-synthesis.test.ts`
    passed: 73 tests.
  - `bun run format:check` passed.
  - `bun run lint` passed.
  - `bun run build` passed.
  - `git diff --check` passed.
  - `bun test --timeout 30000` passed: 1331 tests across 195 files.
- Phase 8.8 continuation code review
  - Plainspoken reviewed `fea3521..abb1515`; result: no findings.
  - Probe reviewed `fea3521..abb1515`; result: no actionable findings.
  - Reviewer checks included the focused Template-Codex tests and
    `git diff --check fea3521..abb1515`; Probe also reran typecheck,
    formatting, lint, and the full test suite.

## Guide-facing Phase 9 Notes

- Cover image order remains intent-driven, not flag-driven. A guide example can
  use wording such as "title above the image, subtitle and author below it,
  centered text".
- The Markdown sample must include the frontmatter fields that the requested
  cover should reveal, such as `title`, `subtitle`, and `author`.
- Byline output should be described as optional cover metadata selected through
  intent; default Template-Codex output keeps it hidden with
  `cover.byline: none`.

## Environment Note

- Re-run the real PDF render smoke after the CSS compatibility fix and record
  whether it is warning-free in an environment with `weasyprint` installed.
  This repository environment reports `weasyprint` unavailable, so the
  implementation closeout relies on static bundle inspection and the mocked
  render-compatibility coverage already recorded above.
