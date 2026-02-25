---
title: "PDF backend comparison for merge/split and image workflows"
created-date: 2026-02-25
status: draft
agent: codex
---

## Goal

Compare candidate backends for PDF merge/split and PDF-image conversion workflows, and recommend a launch-phase direction for `cdx-chores` without assuming all tools are installed locally.

## Key Findings

### 1. No single tool cleanly covers every PDF workflow requirement

The requested PDF workflows span different categories:

- structural PDF operations (merge/split)
- rasterization/rendering (PDF -> images)
- image packaging (images -> PDF)
- content extraction (PDF -> markdown/text/images)

These are served by different tools with different tradeoffs. A mixed-backend strategy is likely the most practical direction.

### 2. `qpdf` is strong for structural PDF operations, not image conversion

qpdf CLI docs show page-selection operations (including splitting, merging, and collating) through `--pages` and `--split-pages`.[^qpdf-cli]

This makes qpdf a strong candidate for:

- `pdf merge`
- `pdf split`

But qpdf is not a renderer and does not cover PDF -> image or image -> PDF workflows directly.

### 3. `pdfcpu` is a broad PDF CLI with merge/split and image-related commands

The pdfcpu usage docs describe it as a PDF processor written in Go and list commands for merge, split, extract, image listing/extraction, and image import/convert to PDF.[^pdfcpu-usage]

This makes `pdfcpu` a potentially high-value single dependency for:

- `pdf merge`
- `pdf split`
- `pdf to-images` (via image extraction commands, depending on source content and desired behavior)
- `pdf from-images`

It still needs local install and real-world validation on your target platforms.

### 4. `pdftoppm` (Poppler utils) is specialized and strong for PDF rasterization

`pdftoppm` is purpose-built to convert PDF pages into image files and supports page-range selection, DPI control, scaling, and PNG/JPEG/TIFF outputs.[^pdftoppm-man]

This is a strong candidate for:

- `pdf to-images`

It is not a general PDF merge/split tool by itself.

### 5. ImageMagick (`magick`) is flexible for image pipelines, but PDF support depends on delegates/policy

ImageMagick docs position `magick` as a general image conversion/manipulation tool, and the formats list shows PDF read/write support with Ghostscript required for reading PDF.[^imagemagick-magick][^imagemagick-formats]

This makes `magick` useful for:

- images sequence normalization (resize/format conversion)
- images -> PDF
- some PDF -> image cases

But behavior can vary by platform/package build because format support may depend on delegates or external programs.[^imagemagick-formats]

### 6. `pymupdf4llm` is a strong fit for PDF-to-markdown extraction workflows, not merge/split

PyPI documentation for `pymupdf4llm` shows:

- PDF -> Markdown conversion
- optional JSON/plain-text output (with layout mode)
- image/vector graphics extraction or embedding options in generated markdown
- page-chunked output for structured downstream processing[^pymupdf4llm-pypi]

This aligns well with your stated use case for extracting images into a folder and appending references in markdown.

It is not a direct replacement for qpdf/pdfcpu/pdftoppm for merge/split/rasterization workflows.

### 7. `mutool` (MuPDF) is a strong optional backend for rendering, extraction, and merge workflows

MuPDF tool docs list `mutool` subcommands including `draw`, `convert`, `extract`, `info`, and `merge`, with `draw` highlighted for rendering documents to image files.[^mupdf-tools][^mutool-docs]

This makes `mutool` a strong candidate for:

- `pdf to-images` (rendering/rasterization workflows)
- embedded resource extraction workflows (`mutool extract`)
- `pdf merge` (usable, though not necessarily the first choice over `pdfcpu`/`qpdf` yet)

It is less obvious as a first-choice split backend compared with tools that expose explicit split workflows (for example `qpdf --split-pages` or `pdfcpu split`).

### 8. Current local availability (user-reported) favors staged rollout

Current environment status (user-reported):

- available: `pandoc`, `pymupdf4llm`
- not installed: `soffice`, `qpdf`, `pdfcpu`, `pdftoppm`, `magick`

Implication: launch-phase implementation should not assume these PDF tools exist yet. `doctor` and feature gating remain essential.

## Comparison Table

| Tool | Primary Role | Merge/Split | PDF -> Images | Images -> PDF | PDF -> Markdown/Text | Notes / Risks | Launch-Phase Fit |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `qpdf` | Structural PDF manipulation | Strong | No | No | Inspection/JSON only | Great for page selection/splitting/merging; not a renderer | High for `pdf merge/split` after install |
| `pdfcpu` | Broad PDF processor (Go CLI) | Strong | Partial/depends on exact mode (extract vs render expectations) | Yes (`import`) | No markdown focus | Rich feature surface; needs evaluation on your platforms | High-value candidate if adopted |
| `pdftoppm` | PDF rasterization to images | No | Strong | No | No | Excellent for per-page raster output with DPI/format controls | High for `pdf to-images` |
| `mutool` (MuPDF) | PDF rendering/conversion/extraction toolkit | Merge strong, split less explicit | Strong (`draw`/`convert`) | Limited/indirect (not primary path) | Text/content extraction possible, but not markdown-focused | Great renderer/extractor toolkit; split ergonomics need validation | High as optional renderer/extractor backend |
| `magick` | General image conversion/manipulation | No (not preferred for PDF structure ops) | Possible | Strong | No | PDF support depends on delegates/policy; can be build-specific | Medium (image pipelines), validate carefully |
| `pymupdf4llm` | PDF content extraction for LLM/RAG workflows | No | Image/vector export within markdown extraction flow (not generic page raster pipeline) | No | Strong | Great for markdown + extracted assets; different problem class | High for experimental `pdf -> markdown` workflows |
| `pandoc` | Document format conversion | No | No | No | Converts document formats, not PDF structure ops | Useful elsewhere (`md/docx`), not a PDF backend for merge/split | Not a fit for this backend set |

## Implications or Recommendations

### A. Split the PDF work into backend-specific command paths

Recommended mapping (initial direction):

- `pdf merge`, `pdf split`: keep `pdfcpu` as a strong option; compare against `qpdf` before finalizing default
- `pdf to-images`: prefer `pdftoppm` (rasterization), with `mutool` and/or `magick` as optional backends depending on output and install footprint
- `pdf from-images`: prefer `magick` or `pdfcpu import` (comparison/testing needed)
- future/experimental `pdf to-markdown`: `pymupdf4llm`

### B. Add a PDF capability matrix to `doctor`

`doctor` should report capabilities, not just commands:

- `pdf.merge`: unavailable (missing `qpdf`/`pdfcpu`)
- `pdf.to-images`: unavailable (missing `pdftoppm`/`mutool`/`magick`)
- `pdf.from-images`: unavailable (missing `magick`/`pdfcpu`)
- `pdf.to-markdown`: available (`pymupdf4llm`)

This matches the orchestrator design of `cdx-chores`.

### C. Create a focused validation job before implementation

Before implementing PDF commands, run a small validation matrix on sample files:

- encrypted PDF
- scanned PDF
- vector-heavy PDF
- multi-page mixed text/image PDF
- image sequences (JPG/PNG mix)

Success criteria should include output correctness, speed, error behavior, and install friction.

## Open Questions

1. Between `pdfcpu` and `qpdf`, which should be the default `pdf merge/split` backend after validation (keeping the other as fallback)?
2. For `pdf to-images`, do you want rasterization of every page (`pdftoppm`) or original embedded-image extraction when possible (`pdfcpu images extract`)?
3. Should `mutool` be prioritized over `magick` as the optional `pdf to-images` backend when `pdftoppm` is unavailable?
4. For `pdf from-images`, is preserving image order + simple packaging enough, or do you need page size/layout controls in the first release?
5. Should `pymupdf4llm` be exposed under `pdf` (for example `pdf to-markdown`) in the launch phase, or kept as a later/experimental command?

## Related Research

- `docs/researches/research-2026-02-25-cdx-chores-cli-scope-and-architecture.md`
- `docs/researches/research-2026-02-25-excel-like-workflows-scope-and-tooling.md`

## References

[^qpdf-cli]: [qpdf CLI documentation](https://qpdf.readthedocs.io/en/stable/cli.html)
[^pdfcpu-usage]: [pdfcpu usage documentation](https://pdfcpu.io/getting_started/usage.html)
[^pdftoppm-man]: [pdftoppm Debian manpage (poppler-utils)](https://manpages.debian.org/testing/poppler-utils/pdftoppm.1.en.html)
[^imagemagick-magick]: [ImageMagick `magick` command docs](https://imagemagick.org/script/magick.php)
[^imagemagick-formats]: [ImageMagick formats list (PDF/Ghostscript notes)](https://imagemagick.org/script/formats.php)
[^pymupdf4llm-pypi]: [pymupdf4llm on PyPI](https://pypi.org/project/pymupdf4llm/)
[^mupdf-tools]: [MuPDF tools index](https://mupdf.readthedocs.io/en/latest/tools/index.html)
[^mutool-docs]: [MuPDF `mutool` docs](https://mupdf.readthedocs.io/en/1.26.2/tools/mutool.html)
