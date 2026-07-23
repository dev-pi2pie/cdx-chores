---
title: "Markdown PDF Codex Template Helper"
created-date: 2026-06-25
modified-date: 2026-07-22
status: completed
agent: codex
---

## Goal

Document the direct `md pdf-template codex` helper for drafting reviewable
Markdown PDF template bundles from bounded document signals, intent, font hints,
base-profile signals, and local cover-image signals.

This guide covers the direct template helper only. For guided Template bundle
preparation, temporary or durable rendering, and saved-recipe handoff, see
[Interactive Markdown PDF Usage](markdown-pdf-interactive-usage.md).

## Command Shape

```bash
cdx-chores md pdf-template codex [input] [options]
```

Common options:

- `[input]`: Markdown sample for document-informed template signals.
- `-i, --input <path>`: same as the positional input, useful in scripts.
- `--intent <text>`: template, layout, and design direction.
- `--font-hint <text>`: repeatable font preference hint for the same Codex request.
- `--base-profile <path>`: existing Markdown PDF profile to use as a signal.
- `--cover-image <path>`: local PNG, JPEG, or WebP cover image.
- `-o, --output <path>`: output template bundle directory.
- `--dry-run`: preview signal collection, decision, synthesis, and validation without writing.
- `--keep-codex-report`: write a diagnostic Codex report sidecar.
- `--codex-report-output <path>`: explicit diagnostic report JSON path.
- `--overwrite`: allow selected generated artifacts to be replaced.

Example:

```bash
cdx-chores md pdf-template codex ./report.md \
  --intent "client report with a clean cover image and readable code blocks" \
  --cover-image ./cover.jpg \
  --output ./report-template
```

Render by selecting the accepted template and stylesheet directly:

```bash
cdx-chores md to-pdf \
  --input ./report.md \
  --template ./report-template/template.html \
  --css ./report-template/style.css \
  --output ./report.pdf
```

When the artifacts stay together, `--bundle` provides a shorter discovery form:

```bash
cdx-chores md to-pdf \
  --input ./report.md \
  --bundle ./report-template \
  --output ./report.pdf
```

Both forms use the same deterministic render path. Once the template bundle is
written, `md to-pdf` does not need Codex.

## Generated Bundle

The helper writes a directory rather than a PDF:

```text
report-template/
  template.html
  style.css
  assets/
    cover.jpg
```

`template.html` and `style.css` are generated from repo-owned template families
and bounded slot decisions. Managed assets are copied into the bundle and
referenced with bundle-relative paths.

The diagnostic report is written only when requested through
`--keep-codex-report` or `--codex-report-output`.

When requested, the default report sidecar is written in the same bundle:

```text
report-template/
  template.codex-report.json
```

When `--output` is omitted, the helper creates a non-colliding default directory
with this shape:

```text
md-pdf-template-YYYYMMDDTHHMMSSZ-xxxxxxxx/
```

The generated name intentionally does not repeat the Markdown input extension.
Pass `--output` when the bundle needs a project-specific directory name.

## Signal Ladder

The helper decides whether and how to call Codex from the available signals:

```text
Inputs
  |
  +-- [input] or --input ---- document facts
  +-- --intent ------------- template and layout direction
  +-- --font-hint ---------- font preference
  +-- --base-profile ------- reusable profile signals
  +-- --cover-image -------- local managed asset signal
  |
  v
Decision
  |
  +-- adapted ---------------- Codex-assisted bounded template decision
  +-- conservative-fallback --- deterministic fallback bundle
  +-- no-usable-template ------ no bundle files written
```

Low-signal runs fail before output planning; use `md pdf-template init` when you
want deterministic defaults without template-specific signals. Unsupported
directions are reported instead of being converted into arbitrary HTML or CSS.

## Preview Then Decide

Use `--dry-run` to preview the decision without writing bundle files:

```bash
cdx-chores md pdf-template codex ./report.md \
  --intent "cover image, compact tables, and readable code" \
  --cover-image ./cover.jpg \
  --dry-run
```

Keep a diagnostic report when you need review evidence:

```bash
cdx-chores md pdf-template codex ./report.md \
  --intent "cover image, compact tables, and readable code" \
  --cover-image ./cover.jpg \
  --dry-run \
  --keep-codex-report
```

`--codex-report-output <path>` writes the report to a specific JSON path and
implies report writing.

## Render Boundary

`md pdf-template codex` does not render the PDF automatically. Render the
accepted artifacts through `md to-pdf` by selecting `--template` and `--css`
directly, or by using `--bundle` to discover both files from their directory.
For example, the discovery form is:

```bash
cdx-chores md to-pdf \
  --input ./report.md \
  --bundle ./report-template \
  --output ./report.pdf
```

`--bundle` discovers the helper's top-level `template.html` and `style.css`; it
does not replace or deprecate the direct options. Either form makes the renderer
use the custom template and apply the helper stylesheet after the built-in
default stylesheet. This layered render keeps built-in renderer behavior,
profile-derived page chrome, and newer code highlighting hooks available unless
the custom template intentionally replaces that structure.

The direct form remains fully supported. It is especially useful when the files
live in different directories, when the selected paths should be visible in the
command, or when the template bundle is intentionally self-contained with
`--no-default-css`:

```bash
cdx-chores md to-pdf \
  --input ./report.md \
  --template ./report-template/template.html \
  --css ./report-template/style.css \
  --no-default-css \
  --output ./report.pdf
```

In that posture, the custom stylesheet owns all print, font, page, cover, and
code-block styling.

## Cover Images

`--cover-image` accepts one local still raster image in v1:

- PNG
- JPEG
- WebP

The image is copied into the generated bundle under `assets/` and referenced
relatively from `template.html`. Remote URLs, SVG, and animated media are not
part of the v1 helper surface.

Image dimensions and format are collected as bounded signals. They help choose
safe cover slots, but generated CSS uses page-relative sizing instead of raw
source pixel dimensions.

Cover layout remains intent-driven rather than flag-driven. For example:

```bash
cdx-chores md pdf-template codex ./tool-overview.md \
  --intent "tool introduction cover with title above the image, subtitle and author below it, centered text" \
  --cover-image ./cover.jpg \
  --output ./tool-overview-template
```

For that style of cover, the Markdown frontmatter should include the fields the
cover needs to reveal:

```yaml
---
title: Tool Overview
subtitle: Reviewable Markdown PDF templates
author: Example Team
date: 2026-06-25
---
```

The bounded cover slots can express title/image/subtitle order, cover text
alignment, media alignment, image anchor, media scale, image fit, and optional
byline output. Byline output is hidden by default and appears only when intent
asks for author, date, or author/date metadata on the cover.

## Font Hints

`--font-hint` is repeatable. Use one flag per distinct font preference when the
template needs several font decisions, such as body, CJK, code, or symbol
preferences:

```bash
cdx-chores md pdf-template codex ./multilingual-report.md \
  --intent "mixed-language report with readable body text and code symbols" \
  --font-hint "use Source Serif 4 for English body text" \
  --font-hint "use Noto Serif JP for Japanese body text" \
  --font-hint "use JetBrains Mono for code" \
  --output ./multilingual-template
```

Profile-owned font settings remain the durable default. When a concrete
`--base-profile` font source exists, template-level font output is suppressed
unless Codex returns an explicit template-level style decision that passes the
bounded role/key contract. This keeps helper-generated template CSS from
silently fighting profile fonts.

Use `md pdf-profile codex` first when the main goal is reusable typography,
page numbers, page shape, page chrome, or Shiki code-highlight settings. Use
`md pdf-template codex` when the main goal is a reviewable HTML/CSS bundle,
local cover-image assets, cover composition, custom CSS, or template-only
layout.

`md pdf-template codex` can emit Shiki-compatible code-block CSS, but it does
not enable Shiki. Enable highlighting during `md to-pdf` with
`--code-highlight` or a profile with `code.highlight: true`.

## Diagnostics And Redaction

Diagnostic reports are review artifacts. They record decisions, selected slots,
fallback reasons, managed asset metadata, and unsupported directions.

Persisted reports and generated bundle files should not expose local source
directories. Managed assets are reported by bundle-relative paths and redacted
source metadata such as basenames and dimensions. Terminal output can still use
normal user-facing display paths for ergonomics.

Do not commit reports that contain project-sensitive intent text unless that
intent is intended to be public.

## Collision And Overwrite Behavior

The helper refuses to overwrite existing generated artifacts by default.

Use `--overwrite` only when replacing selected generated files in the target
bundle is intended:

```bash
cdx-chores md pdf-template codex ./report.md \
  --intent "refresh the reviewed template bundle" \
  --cover-image ./cover.jpg \
  --output ./report-template \
  --overwrite
```

An existing output directory is treated as an output target only. V1 does not
read an existing `template.html` or `style.css` as a refinement input.

## Related Docs

- [Interactive Markdown PDF Usage](markdown-pdf-interactive-usage.md)
- [Markdown PDF Usage](markdown-pdf-usage.md)
- [Markdown PDF Codex Profile Helper](markdown-pdf-codex-profile-helper.md)
- [PDF Backend License Guidance](pdf-backend-license-guidance.md)
- [Markdown PDF Codex Helper Roadmap](../researches/research-2026-06-10-markdown-pdf-codex-profile-and-interactive-flow.md)
- [Markdown PDF Template Codex Helper](../researches/research-2026-06-18-markdown-pdf-template-codex-helper.md)
- [Markdown PDF template Codex helper implementation](../plans/plan-2026-06-23-markdown-pdf-template-codex-helper.md)
