---
title: "Markdown PDF template Codex phase 8.8 cover composition"
created-date: 2026-06-25
modified-date: 2026-06-25
status: in-progress
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

## Remaining

- Complete the real PDF render smoke in an environment with `weasyprint`
  available. Until that command succeeds against the generated template and CSS,
  Phase 8.8 render compatibility remains unchecked.
- Run final code review on the updated Phase 8.8 commit range.
