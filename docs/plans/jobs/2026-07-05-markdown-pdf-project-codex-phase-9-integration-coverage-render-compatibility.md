---
title: "Markdown PDF project Codex phase 9 integration coverage and render compatibility"
created-date: 2026-07-05
modified-date: 2026-07-05
status: completed
agent: codex
plan: ../plan-2026-07-04-markdown-pdf-project-codex-helper.md
---

## Scope

Implement Phase 9 of the `md pdf-project codex` plan.

This phase closes integration coverage around the shipped project helper. It
does not add live smoke cases to the regular test suite; manual render smoke
stays under `examples/playground/md-pdf/smoke/`.

## Implementation Notes

- Added an action-level integration test that writes a deterministic
  `md pdf-project codex` bundle, then feeds the generated `profile.yml`,
  `template.html`, and `style.css` into the `md to-pdf` action with an injected
  renderer.
- Added an action-level regression test for a document-informed project whose
  frontmatter title matches the first H1. The test verifies the project profile
  writes `titleBlock.metadataTitle: auto`, the project template suppresses the
  metadata title block, and the project report records a document-informed
  profile phase with deterministic template synthesis.
- Kept the regular test deterministic by using the existing injected PDF runner
  rather than requiring external render tools.
- Confirmed existing command coverage documents the `md pdf-project codex`
  surface and rejects recipe flags such as `--preset`, `--margin`, and `--toc`.
- Confirmed existing action and command coverage handles deterministic paths,
  Codex-assisted stubbed runners, invalid base profiles, invalid cover images,
  output/report collisions, and `no-usable-project` report behavior.

## Tests

- Added coverage in
  `test/cli-actions-md-to-pdf-project-codex/action-write.test.ts`.
- The render-feed test verifies that a written project bundle can be consumed by
  `md to-pdf --profile --template --css`.
- The duplicate-title test verifies that document-informed project generation
  preserves the duplicate visible title suppression already used by the direct
  profile and template helpers.
- The render-feed test asserts the generated template reaches Pandoc, the generated
  stylesheet reaches WeasyPrint, the PDF output is written, and the render
  command reports the expected output path.

## Manual Smoke

Manual smoke used existing public playground inputs:

- `examples/playground/md-pdf/cjk-font-smoke.md`
- `examples/playground/md-pdf/tool-cover-smoke.md`
- `examples/playground/md-pdf/assets/tool-cover-sample.jpg`

Initial smoke commands generated deterministic project bundles under
`examples/playground/md-pdf/smoke/phase9-closeout/` and replayed them through
`md to-pdf --profile --template --css`. This covered base-profile-only project
replay, not document-informed project generation.

Sanitized smoke result:

- Generated a base profile with `md pdf-profile init`.
- Generated a deterministic CJK project bundle from the base profile.
- Generated a deterministic cover-image project bundle from the base profile and
  repo-relative cover-image fixture.
- Render replay passed for the CJK bundle and wrote a one-page A4 PDF.
- Render replay passed for the cover-image bundle and wrote a two-page A4 PDF.
- PDF page previews were generated under the ignored smoke folder.
- Visual inspection confirmed readable CJK/body/code content and cover-first
  layout with body content on the following page.
- The initial CJK smoke used a generic deterministic base profile, so the
  preview kept visible title duplication from the source H1 plus metadata title.
  That result proved base-profile-only replay compatibility, but it did not
  prove document-informed duplicate-title handling.

Follow-up document-informed CJK smoke generated a project with
`examples/playground/md-pdf/cjk-font-smoke.md` as the direct
`md pdf-project codex` input under
`examples/playground/md-pdf/smoke/phase9-document-informed-cjk/`.

Sanitized follow-up result:

- Project generation passed with project signal mode `codex-assisted`.
- Profile phase passed with decision mode `adapted` and signal mode
  `document-informed`.
- Template phase passed with decision mode `deterministic`.
- The generated `profile.yml` included `titleBlock.metadataTitle: auto`.
- The generated `template.html` suppressed the metadata title block.
- Render replay through `md to-pdf --profile --template --css` passed and wrote
  a one-page A4 PDF.
- PDF text extraction found one visible `CJK Font Smoke` occurrence, confirming
  frontmatter/H1 duplicate-title suppression for the document-informed project
  path.

## Verification

- `bun test test/cli-actions-md-to-pdf-project-codex/action-write.test.ts`
  - Passed: 19 tests, 622 assertions.
- `bun test test/cli-actions-md-to-pdf-project-codex/*.test.ts test/cli-actions-md-to-pdf-commands.test.ts`
  - Passed: 106 tests, 1421 assertions.
- `bun run build`
  - Passed before manual smoke.
- Manual deterministic project render smoke
  - Passed for CJK and cover-image project bundles.
- Manual document-informed CJK project render smoke
  - Passed and confirmed one visible title occurrence.
- PDF metadata inspection
  - Passed: CJK replay produced one A4 page; cover replay produced two A4 pages.
- PDF page-preview visual smoke
  - Passed.

## Artifact Safety

- Manual smoke outputs are ignored by
  `examples/playground/.gitignore` through `md-pdf/smoke/**`.
- This record uses repo-relative paths only.
- No local user path, private temporary path, private URL, or rendered smoke
  artifact is committed.
