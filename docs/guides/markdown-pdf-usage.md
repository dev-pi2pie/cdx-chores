---
title: "Markdown PDF Usage"
created-date: 2026-05-06
status: completed
agent: codex
---

## Goal

Document the current `md to-pdf` and `md pdf-template init` workflow for rendering Markdown into PDF through Pandoc-generated HTML and WeasyPrint.

## Requirements

`md to-pdf` requires both external tools:

- `pandoc` for Markdown-to-HTML conversion
- `weasyprint` for HTML/CSS-to-PDF rendering

Check the local environment before using the command in scripts or CI:

```bash
cdx-chores doctor
```

For machine-readable checks:

```bash
cdx-chores doctor --json
```

## Basic Render

Render a Markdown file to a PDF next to the source:

```bash
cdx-chores md to-pdf --input ./docs/report.md
```

Default output:

```text
./docs/report.pdf
```

Use `--output` when the PDF should be written somewhere else:

```bash
cdx-chores md to-pdf --input ./docs/report.md --output ./exports/report.pdf
```

Use `--overwrite` to replace an existing PDF:

```bash
cdx-chores md to-pdf --input ./docs/report.md --output ./exports/report.pdf --overwrite
```

## Layout Options

The default preset is `article`.

Supported presets:

- `article`: general notes and short articles
- `report`: longer documents with ToC-friendly spacing
- `wide-table`: landscape output for wide tables or matrix-style documents
- `compact`: dense internal references
- `reader`: screen-reading oriented PDFs with larger type

Example:

```bash
cdx-chores md to-pdf --input ./table.md --preset wide-table
```

Set page size, orientation, and margins explicitly:

```bash
cdx-chores md to-pdf \
  --input ./report.md \
  --page-size A4 \
  --orientation portrait \
  --margin 18mm
```

Margin flags accept simple CSS print lengths:

- `mm`
- `cm`
- `in`
- `pt`
- `px`

Use custom CSS for advanced layout expressions instead of putting arbitrary CSS into margin flags.

## Table of Contents

ToC generation is opt-in:

```bash
cdx-chores md to-pdf --input ./report.md --preset report --toc --toc-depth 3
```

The `report` preset inserts a page break after the ToC by default when ToC is enabled. Control that behavior with:

```bash
cdx-chores md to-pdf \
  --input ./report.md \
  --preset report \
  --toc \
  --toc-page-break none
```

Supported `--toc-page-break` values:

- `auto`
- `none`
- `before`
- `after`
- `both`

## Debug HTML

Use `--html-output` when the rendered PDF needs inspection:

```bash
cdx-chores md to-pdf \
  --input ./report.md \
  --output ./report.pdf \
  --html-output ./report.render.html
```

The HTML file is written only when `--html-output` is passed.

## Custom Template And CSS

Materialize the built-in recipe:

```bash
cdx-chores md pdf-template init --output ./pdf-template
```

This writes:

```text
pdf-template/
  template.html
  style.css
```

Render with the edited recipe:

```bash
cdx-chores md to-pdf \
  --input ./report.md \
  --template ./pdf-template/template.html \
  --css ./pdf-template/style.css
```

When `--css` is provided, default CSS is applied first and user CSS is applied after it.

Use `--no-default-css` to render with only custom CSS:

```bash
cdx-chores md to-pdf \
  --input ./report.md \
  --css ./pdf-template/style.css \
  --no-default-css
```

## Images And Assets

Relative local image paths are resolved from the Markdown file directory:

```markdown
![Chart](./images/chart.png)
```

For this layout:

```text
docs/report.md
docs/images/chart.png
```

run:

```bash
cdx-chores md to-pdf --input ./docs/report.md
```

Local images should render in the PDF when WeasyPrint can load the file. Missing local images are allowed to render with WeasyPrint warnings, and the CLI surfaces those warnings before the success line.

Remote `http` and `https` assets are disabled by default, including URLs in HTML asset attributes, custom CSS, inline `style` attributes, and `<style>` blocks. Opt in explicitly when the document should fetch remote assets:

```bash
cdx-chores md to-pdf --input ./report.md --allow-remote-assets
```

## Related Docs

- `docs/guides/md-frontmatter-to-json-output-contract.md`
- `docs/plans/plan-2026-05-06-markdown-to-pdf-weasyprint-implementation.md`
- `docs/researches/research-2026-05-06-markdown-to-pdf-weasyprint.md`
