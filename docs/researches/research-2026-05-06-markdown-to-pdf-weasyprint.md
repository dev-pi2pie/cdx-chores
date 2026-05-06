---
title: "Markdown to PDF with WeasyPrint"
created-date: 2026-05-06
modified-date: 2026-05-06
status: completed
agent: codex
---

## Goal

Define a dedicated `md to-pdf` direction that turns Markdown into print-ready PDF output through a generated HTML/CSS document recipe, while keeping the first implementation deterministic, inspectable, and aligned with the existing `doctor` dependency model.

## Milestone Goal

Prepare a pre-plan recommendation for a Markdown-owned PDF export lane. This document is now `completed`: the preferred direction is recorded, the dedicated implementation plan is linked, and completed job records capture implementation, validation, and public documentation evidence.

## Why This Research

The current Markdown action is intentionally small:

- `md to-docx` shells out to `pandoc`
- `md frontmatter-to-json` extracts Markdown metadata into JSON

That is enough for basic document conversion, but it does not own the PDF-specific concerns that make Markdown-to-PDF useful in practice:

- page size and orientation
- print margins, which are CSS `@page` margins rather than body padding
- table and code-block wrapping
- table of contents generation
- default HTML shell and print stylesheet
- image and asset resolution
- dependency checks for the PDF renderer
- debugging the intermediate HTML that the renderer actually sees

The repo already has fixture evidence that a Pandoc HTML template plus CSS can generate PDF output through WeasyPrint:

- `test/fixtures/docs/pandoc-weasyprint-template.html`
- `test/fixtures/docs/pandoc-fixture.css`
- `test/fixtures/docs/metadata-rich.pdf`

This research records the desired product contract before planning implementation.

## Starting State

At research start, the Markdown implementation was a direct Pandoc wrapper for DOCX:

```bash
cdx-chores md to-docx --input input.md --output output.docx
```

The `doctor` action checked `pandoc` and mapped it to the `md.to-docx` capability.

There was no `md to-pdf` command, no generated Markdown PDF recipe, no WeasyPrint check in `doctor`, and no public contract for page layout defaults, table of contents behavior, custom HTML/CSS, or image handling.

There is an existing draft plan for the `pdf` command group. That plan covers PDF-native workflows such as merge, split, PDF-to-images, images-to-PDF, and PDF-to-Markdown extraction. This research is separate: it covers Markdown-to-PDF generation under the `md` command group, using Markdown input, an HTML/CSS recipe, and WeasyPrint rendering. The dedicated `md to-pdf` implementation plan links both tracks so `md to-pdf` and `pdf to-markdown` do not collide over asset-directory or capability-reporting language.

## Scope

This research covers:

- the recommended first-pass `md to-pdf` architecture
- the default template/CSS artifact model
- page-size, orientation, and margin option boundaries
- table of contents handling
- image and external-media behavior
- `doctor` capability checks for `weasyprint`
- whether Codex SDK assistance belongs in v1
- common preset/use-case collection for later implementation

This research does not implement:

- command wiring
- generated template files
- WeasyPrint process integration
- fixture regeneration
- guide updates
- user-facing `README.md` examples

## Key Findings

### 1. `md to-pdf` should be a dedicated HTML/CSS-to-PDF lane

Recommended pipeline:

```text
Markdown input
  -> Pandoc standalone HTML using a known HTML template
  -> WeasyPrint PDF using default and/or user CSS
  -> PDF output
```

This keeps Pandoc responsible for Markdown parsing and ToC-capable HTML generation, while WeasyPrint owns paged-media rendering. WeasyPrint's public command-line API is explicitly shaped around HTML input, PDF output, user stylesheets, base URLs, and URL-fetcher controls rather than Markdown parsing.[^weasyprint-cli]

The command should not be modeled as a generic `pandoc -o output.pdf` wrapper. PDF output needs its own defaults and diagnostics:

- generated template
- print stylesheet
- renderer-specific dependency check
- asset path behavior
- intermediate HTML debugging

### 2. The template should be a generated, inspectable recipe artifact

The HTML template and CSS should be treated as a document recipe, not as hidden implementation detail.

The default render path can use built-in template and CSS content:

```bash
cdx-chores md to-pdf --input report.md --output report.pdf
```

Power users should be able to materialize the default recipe:

```bash
cdx-chores md pdf-template init --output ./pdf-template
```

Suggested generated shape:

```text
pdf-template/
  template.html
  style.css
```

Then users can render with the edited recipe:

```bash
cdx-chores md to-pdf \
  --input report.md \
  --output report.pdf \
  --template ./pdf-template/template.html \
  --css ./pdf-template/style.css
```

This mirrors existing repo patterns where an artifact is both machine-readable and user-reviewable:

- rename dry-run plan CSVs
- data source-shape artifacts
- data stack replay plans

The important boundary is that the recipe remains deterministic. Rendering a reviewed recipe should not require Codex or a network call.

### 3. Margin flags should validate print-safe CSS units

Page padding is a common source of confusion. The CLI should call this margin, not padding, because PDF page whitespace belongs in CSS `@page`:

```css
@page {
  size: A4 portrait;
  margin: 18mm 16mm;
}
```

The public convenience flags should accept a narrow, deterministic set of CSS length units:

- `mm`
- `cm`
- `in`
- `pt`
- `px`

Recommended invalid values:

- `auto`
- `calc(1cm + 2mm)`
- `var(--page-margin)`
- `1rem`
- unitless numbers

Advanced CSS remains possible through custom CSS files. The CLI convenience flags should avoid passing arbitrary CSS snippets through validation.

Recommended first-pass flags:

```bash
--page-size A4
--orientation portrait
--margin 18mm
--margin-x 16mm
--margin-y 20mm
--margin-top 20mm
--margin-right 16mm
--margin-bottom 20mm
--margin-left 16mm
```

Default docs should use `mm`, because print margins are usually discussed in millimeters or inches rather than browser-style pixels.

### 4. Presets can cover the common cases without making v1 feel complex

Recommended preset set:

| Preset | Intended Use | Defaults |
| --- | --- | --- |
| `article` | General Markdown notes and articles | A4 portrait, comfortable margins, no ToC by default |
| `report` | Longer documents with headings | A4 portrait, ToC-friendly spacing |
| `wide-table` | Tables, logs, matrix-like docs | A4 landscape, tighter margins, smaller table/code type |
| `compact` | Dense internal references | A4 portrait, smaller margins and text |
| `reader` | Review PDFs intended for screen reading | A4 portrait, larger type and line height |

The preset should be an input to the generated CSS, not a hidden renderer mode.

Examples:

```bash
cdx-chores md to-pdf --input report.md --preset report --toc
cdx-chores md to-pdf --input table.md --preset wide-table --orientation landscape
cdx-chores md pdf-template init --preset reader --output ./reader-template
```

### 5. ToC should be opt-in in v1

Table of contents generation is useful, but it changes document shape. The first implementation should make it explicit:

```bash
cdx-chores md to-pdf --input report.md --toc --toc-depth 3
cdx-chores md pdf-template init --preset report --toc --toc-depth 2
```

Pandoc should generate the ToC during the HTML stage. The default CSS should style the resulting ToC for print:

- readable indentation
- sensible link color for print
- page-break behavior before/after the ToC when appropriate
- no horizontal overflow from long headings

WeasyPrint can also generate PDF bookmarks from headings, so ToC and PDF outline behavior should be tested separately rather than assumed identical.

For `report`, the default ToC behavior should insert a page break after the ToC when ToC is enabled. Other presets should avoid extra ToC page breaks unless fixture review shows the default is awkward. The implementation plan freezes the override surface as `--toc-page-break <auto|none|before|after|both>` with `auto` as the default.

### 6. Intermediate HTML should be a first-class debug artifact

PDF rendering issues are hard to debug if users cannot inspect the HTML and resolved asset references.

Recommended option:

```bash
cdx-chores md to-pdf --input report.md --html-output report.render.html
```

`--keep-html` may be convenient later, but `--html-output` is more explicit and replayable.

The debug HTML should be the exact HTML passed to WeasyPrint after Pandoc processing and template application.

### 7. Default PDF output should derive from the Markdown input path

`md to-pdf` should follow the existing derived-output convention used by other file conversion commands:

```bash
cdx-chores md to-pdf --input docs/report.md
```

Default output:

```text
docs/report.pdf
```

Rules:

- `--output <path>` overrides the derived output path
- no PDF bytes are written to stdout in v1
- `--overwrite` is required when the resolved PDF output already exists
- `--html-output <path>` remains separate from the PDF output path and is never inferred automatically

`md pdf-template init` should keep `--output <directory>` explicit so the command does not create a recipe directory in an unexpected location.

### 8. Local images should work by default when paths are relative to the Markdown file

Markdown commonly includes local images. WeasyPrint supports linked stylesheets and image elements in HTML, and its API exposes `base_url` specifically for resolving relative URLs from generated HTML.[^weasyprint-api]

```markdown
![Chart](./images/chart.png)
```

For a source layout like:

```text
docs/report.md
docs/images/chart.png
```

this command should render the image correctly:

```bash
cdx-chores md to-pdf --input docs/report.md --output docs/report.pdf
```

Required implementation rule:

- the generated HTML and WeasyPrint invocation must resolve relative asset paths against the Markdown input file's directory, not accidentally against the process cwd

Recommended v1 asset policy:

| Asset Form | v1 Behavior |
| --- | --- |
| Relative local image path | Supported; resolve relative to Markdown input directory |
| Absolute local image path | Supported, but discouraged for portable recipes |
| Missing local image | Allow WeasyPrint to render with warnings; surface warnings clearly so success is not mistaken for a clean render |
| Non-local URL-scheme image | Disabled by default through the renderer's allowed-protocol policy; users can opt in with `--allow-remote-assets` |
| SVG image | Supported if WeasyPrint renders it reliably; include fixture coverage |
| GIF/video/audio | Not treated as rich media in PDF; document as unsupported or first-frame/best-effort only after validation |

Remote assets should not be silently fetched in the first implementation. The default render should allow relative paths, `file:`, and `data:` assets, and `--allow-remote-assets` should be the explicit opt-in for non-local asset URL schemes. This keeps local document rendering predictable and reduces security surprises.

### 9. `doctor` should add WeasyPrint as a feature dependency

`doctor` should inspect `weasyprint` and expose a capability:

```text
tools.weasyprint
capabilities["md.to-pdf"]
```

Preferred inspection:

```bash
weasyprint --info
```

Fallback inspection:

```bash
weasyprint --version
```

The human-readable report should explain missing WeasyPrint separately from missing Pandoc, because `md.to-pdf` needs both:

- `pandoc` for Markdown-to-HTML
- `weasyprint` for HTML/CSS-to-PDF

The install hint should mention that WeasyPrint can fail even when the Python package exists if platform rendering libraries are not reachable. The WeasyPrint docs specifically call out macOS library path issues and `DYLD_FALLBACK_LIBRARY_PATH` for missing `.dylib` cases.[^weasyprint-first-steps]

### 10. Codex SDK assistance should be deferred from v1

Codex assistance could help generate a fitting document recipe from an intent:

```bash
cdx-chores md pdf-template suggest \
  --input report.md \
  --intent "landscape internal report with wide tables and a table of contents" \
  --output ./report-pdf-template
```

However, v1 should not include this.

Reasons:

- the deterministic feature value is already clear without AI
- adding Codex introduces auth/session, timeout, schema, review, and failure-mode complexity
- generated CSS/HTML can become an execution surface unless carefully bounded
- the repo's Codex-assisted patterns work best when Codex proposes bounded fields or patches, not when it silently writes executable artifacts

Deferred shape if revisited:

```json
{
  "preset": "wide-table",
  "page": {
    "size": "A4",
    "orientation": "landscape",
    "margin": "12mm"
  },
  "toc": {
    "enabled": true,
    "depth": 3
  },
  "style_notes": ["wrap code blocks", "repeat table headers"]
}
```

Deterministic code should turn those structured fields into `template.html` and `style.css`. Codex-authored raw CSS should be a later reviewed-draft mode, not the default.

## Recommended Direction

Plan `md to-pdf` first as a deterministic document-rendering workflow:

```bash
cdx-chores md to-pdf --input input.md
```

Recommended first-pass command surface:

```bash
cdx-chores md to-pdf \
  --input input.md \
  --preset article \
  --page-size A4 \
  --orientation portrait \
  --margin 18mm
```

Additional first-pass options:

```bash
--toc
--toc-depth <n>
--toc-page-break <auto|none|before|after|both>
--template <path>
--css <path>
--no-default-css
--html-output <path>
--overwrite
```

Add a template materialization command:

```bash
cdx-chores md pdf-template init \
  --preset report \
  --orientation portrait \
  --margin 18mm \
  --output ./pdf-template
```

Keep Codex-assisted recipe generation out of v1 and record it as a deferred follow-up.

## Implementation Notes

These notes are now reflected in the dedicated implementation plan:

1. Add a Markdown PDF recipe module that can generate default `template.html` and `style.css` strings from preset/page options.
2. Add validation helpers for page size, orientation, ToC depth, and CSS length units.
3. Add `actionMdToPdf` that:
   - validates input/output paths
   - checks `pandoc` and `weasyprint`
   - generates intermediate HTML
   - writes optional `--html-output`
   - invokes WeasyPrint with the correct base URL and stylesheet list
4. Add `md pdf-template init`.
5. Extend `doctor` JSON and human output with `weasyprint` and `md.to-pdf`.
6. Add tests for:
   - missing input before dependency execution
   - invalid margin unit rejection
   - ToC flag wiring
   - ToC page-break default and override behavior
   - default PDF output path derivation
   - default recipe materialization
   - custom CSS/template path validation
   - image path resolution relative to the Markdown input
   - `doctor` payload shape
7. Add fixture-level PDF smoke coverage only where environment availability allows it, and keep missing-WeasyPrint behavior deterministic.

## Reviewed Decisions

1. Missing local images should not be a hard pre-render validation failure in v1. Allow WeasyPrint to render with warnings, then surface those warnings clearly in CLI output.
2. Remote assets should be disabled by default. The default render should allow relative paths, `file:`, and `data:` assets, and `--allow-remote-assets` should opt in to non-local asset URL schemes.
3. Intermediate HTML should be written only when `--html-output <path>` is passed. Failed renders should not leave implicit debug files by default; users can rerun with `--html-output` when they need the exact HTML artifact.
4. `md pdf-template init` should write into a new or empty output directory by default. It should overwrite existing recipe files only when `--overwrite` is passed.
5. The `report` preset should insert a page break after the ToC by default when ToC is enabled. This behavior should still be controllable through a page-break option rather than hardcoded into every ToC render.
6. The ToC page-break override should be `--toc-page-break <auto|none|before|after|both>`, with `auto` as the default. `auto` should insert a page break after ToC for `report` and avoid extra ToC page breaks for `article`, `compact`, `reader`, and `wide-table` unless fixture review shows a better default.

## Open Questions

None currently. The remaining ToC page-break control question is now recorded as a reviewed decision.

## Related Plans

- `docs/plans/plan-2026-05-06-markdown-to-pdf-weasyprint-implementation.md` — dedicated implementation plan for the deterministic v1 `md to-pdf` workflow described by this research.
- `docs/plans/plan-2026-03-11-pdf-cli-workflows-implementation.md` — related draft plan for the separate `pdf` command group. It should remain the owner for PDF-native workflows such as merge, split, image extraction/rendering, images-to-PDF, and PDF-to-Markdown extraction. This research informs the Markdown-owned plan instead of replacing that PDF plan.

## Related Jobs

- `docs/plans/jobs/2026-05-06-markdown-to-pdf-weasyprint-phases-1-5.md` — implementation, renderer, asset policy, tests, and `doctor` evidence.
- `docs/plans/jobs/2026-05-06-markdown-to-pdf-weasyprint-phase-6-docs.md` — public guide, README alignment, status closeout, and final validation evidence.

## Related Research

- `docs/researches/research-2026-02-25-pdf-backend-comparison-for-merge-split-and-image-workflows.md` — related PDF backend comparison. It explains why `pandoc` is not a fit for PDF-native backend operations and why `pymupdf4llm` is a license-gated candidate for `pdf to-markdown`. This Markdown-to-PDF research takes a different direction: Pandoc is useful for Markdown-to-HTML, while WeasyPrint handles the final HTML/CSS-to-PDF render.
- `docs/researches/research-2026-02-25-cdx-chores-cli-scope-and-architecture.md` — historical CLI architecture baseline that introduced the shared action layer and `doctor` capability model.

## Related Historical Docs

- `docs/plans/archive/plan-2026-02-25-initial-launch-lightweight-implementation.md`
- `docs/plans/archive/plan-2026-02-26-md-frontmatter-to-json-command.md`

## References

[^weasyprint-cli]: [WeasyPrint command-line API](https://doc.courtbouillon.org/weasyprint/latest/api_reference.html#command-line-api)
[^weasyprint-first-steps]: [WeasyPrint first steps](https://doc.courtbouillon.org/weasyprint/v68.0/first_steps.html)
[^weasyprint-api]: [WeasyPrint API reference](https://doc.courtbouillon.org/weasyprint/latest/api_reference.html)
