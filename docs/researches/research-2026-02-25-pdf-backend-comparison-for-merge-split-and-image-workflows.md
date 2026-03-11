---
title: "PDF backend comparison for merge/split and image workflows"
created-date: 2026-02-25
modified-date: 2026-03-11
status: draft
agent: codex
---

## Goal

Compare candidate backends for PDF merge/split, PDF-image workflows, and PDF-to-markdown extraction, then freeze a launch-phase recommendation for `cdx-chores` without baking machine-specific environment state into the research record.

## Key Findings

### 1. `pdfcpu` is the best launch-phase anchor backend for the PDF command group

The pdfcpu usage docs describe it as a broad PDF processor with merge, split, image extraction, and image import commands.[^pdfcpu-usage]

That makes `pdfcpu` the strongest default candidate for the first PDF workflow set:

- `pdf merge`
- `pdf split`
- `pdf to-images` when the intended behavior is embedded-image extraction
- `pdf from-images`

This does not mean one tool solves every future PDF case, but it is the cleanest first default for the current scope.

### 2. `qpdf` remains valuable, but should stay outside the current launch assumption

qpdf CLI docs show strong page-selection operations through `--pages` and `--split-pages`.[^qpdf-cli]

That still makes qpdf a strong structural PDF tool, but the current launch decision is narrower:

- default merge/split backend: `pdfcpu`
- `qpdf` is a later optional fallback, not a current dependency target

This keeps qpdf documented as a viable structural fallback without treating it as part of the immediate implementation baseline.

### 3. `pdf to-images` should mean embedded-image extraction first, not page rasterization

The current product choice is to prioritize extraction of original embedded images when possible.

`pdfcpu` supports direct embedded-image extraction through `pdfcpu images extract` and `pdfcpu extract -mode image`.[^pdfcpu-usage]

Implication:

- launch default for `pdf to-images`: `pdfcpu`
- preferred optional backend ahead of `magick`: `mutool`
- `pdftoppm` is no longer the preferred launch path for this command

`pdftoppm` remains useful for full-page rasterization workflows, but that is now treated as a different contract from launch `pdf to-images`.[^pdftoppm-man]

This is an important contract change: launch `pdf to-images` should not implicitly promise one rasterized output per PDF page.

### 4. `mutool` is the right secondary backend for PDF image extraction/rendering cases

MuPDF tool docs list `mutool` subcommands such as `draw`, `convert`, `extract`, `info`, and `merge`.[^mupdf-tools][^mutool-docs]

For launch planning, `mutool` should be treated as:

- the preferred optional backend after `pdfcpu` for image-oriented PDF workflows
- higher priority than `magick`
- a future-ready path if embedded-image extraction alone proves too narrow for some PDFs

`magick` still has value for general image conversion pipelines, but its PDF behavior can vary by delegates and policy, which is why it should stay behind `mutool` in this launch design.[^imagemagick-magick][^imagemagick-formats]

This keeps `mutool` in the design as the first optional expansion path without making it the primary default.

### 5. `pdf from-images` should stay simple in the first release

The first release does not need advanced layout controls.

`pdfcpu import` already aligns well with the intended first-pass behavior because it turns image files into a PDF page sequence, one image per page, while allowing later layout tuning if needed.[^pdfcpu-usage]

Implication:

- preserve image order
- package images into a straightforward PDF page sequence
- defer page-size/layout customization as a later follow-up

### 6. `pymupdf4llm` still fits `pdf to-markdown`, and this should now be treated as an exposed PDF workflow

PyPI documentation for `pymupdf4llm` shows:

- PDF -> Markdown conversion
- optional JSON/plain-text output
- image/vector extraction or embedding options
- page-chunked output for downstream processing[^pymupdf4llm-pypi]

This remains a strong fit for a `pdf to-markdown` command.

The product requirements are now clearer:

- keep progress feedback visible
- allow users to choose whether markdown writes a separate images folder for external assets

This is no longer just a speculative later idea. It is a valid PDF command candidate, subject to normal implementation planning.

### 7. Research docs should describe runtime capability design, not snapshot a specific machine state

The earlier draft captured a user-reported environment inventory.

That should not live in this research doc. The durable design point is:

- `doctor` should detect capabilities at runtime
- documentation should describe backend contracts and fallback strategy
- research should avoid embedding ephemeral local install state unless the environment itself is the subject of the research

## Comparison Table

| Tool | Primary Role | Merge/Split | PDF -> Images | Images -> PDF | PDF -> Markdown/Text | Notes / Risks | Launch-Phase Fit |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `pdfcpu` | Broad PDF processor (Go CLI) | Strong | Strong for embedded-image extraction | Strong (`import`) | No markdown focus | Best launch anchor across the current PDF workflow set; still needs workflow validation | Default for `pdf merge`, `pdf split`, `pdf to-images`, and likely `pdf from-images` |
| `qpdf` | Structural PDF manipulation | Strong | No | No | Inspection/JSON only | Strong structural alternative; keep as a later optional fallback rather than a current launch assumption | Deferred optional fallback |
| `mutool` (MuPDF) | PDF rendering/conversion/extraction toolkit | Merge usable | Strong (`extract`, `draw`, `convert`) | Limited/indirect | Text/content extraction possible, but not markdown-focused | Better optional image-oriented backend than `magick` for this scope | Preferred optional backend after `pdfcpu` |
| `magick` | General image conversion/manipulation | No (not preferred for structure ops) | Possible | Strong | No | PDF behavior can vary by delegates/policy; keep out of primary launch path | Deferred or backup-only |
| `pdftoppm` | PDF rasterization to images | No | Strong for page rasterization | No | No | Useful for a different contract: per-page rendering rather than embedded-image extraction | Deferred from current launch choice |
| `pymupdf4llm` | PDF content extraction for LLM/RAG workflows | No | Image/vector export within markdown extraction flow | No | Strong | Strong fit for markdown plus extracted assets; separate problem class from merge/split | High for `pdf to-markdown` |
| `pandoc` | Document format conversion | No | No | No | Converts document formats, not PDF structure ops | Useful elsewhere, not a PDF backend for these workflows | Not a fit for this backend set |

## Implications or Recommendations

### A. Freeze the launch backend mapping

Recommended launch mapping:

- `pdf merge`: default `pdfcpu`
- `pdf split`: default `pdfcpu`
- `pdf to-images`: default `pdfcpu` embedded-image extraction, optional `mutool` path
- `pdf from-images`: simple ordered packaging, with `pdfcpu import` as the first validation target
- `pdf to-markdown`: `pymupdf4llm`

### B. Clarify the command contracts before implementation

The command names need explicit behavior contracts:

- `pdf to-images` should mean embedded-image extraction in the first release, not automatic rasterization of every page
- if a later per-page render mode is needed, it should be added as a separate mode or explicit flag rather than silently changing the command meaning
- `pdf from-images` should explicitly stay in simple packaging mode for v1
- `pdf to-markdown` should include progress feedback and an explicit asset-output choice

### C. Keep capability reporting dynamic

`doctor` should report detected PDF capabilities at runtime rather than relying on a documented snapshot of one machine.

Recommended capability framing:

- `pdf.merge.default`: `pdfcpu`
- `pdf.split.default`: `pdfcpu`
- `pdf.to-images.default`: `pdfcpu`
- `pdf.to-images.optional`: `mutool`
- `pdf.image-tools.optional`: `magick`
- `pdf.from-images.default`: `pdfcpu`
- `pdf.to-markdown`: `pymupdf4llm`
- `pdf.merge.optional-fallback`: `qpdf` if installed later
- `pdf.split.optional-fallback`: `qpdf` if installed later

The actual availability of those capabilities should always come from runtime checks.

### D. Validate the chosen defaults against representative file classes

Before implementation, validation should focus on:

- merge/split correctness on normal, encrypted, and mixed-page PDFs
- embedded-image extraction behavior on image-rich, scanned, and vector-heavy PDFs
- `mutool` fallback behavior when `pdfcpu` extraction is insufficient
- whether installed `magick` adds enough practical value to justify any later image-normalization bridge in PDF flows
- image-order preservation and page sizing behavior for `pdfcpu import`
- markdown progress behavior and external-image-folder output ergonomics for `pymupdf4llm`

## Decision Updates

### Draft decision 1. `pdfcpu` should be the default merge/split backend

Decision for this milestone:

- use `pdfcpu` as the default backend for `pdf merge` and `pdf split`
- do not require `qpdf` for the current launch path
- keep `qpdf` only as a documented later fallback option if it is installed in a future phase

### Draft decision 2. `pdf to-images` should prioritize embedded-image extraction

Decision for this milestone:

- define launch `pdf to-images` around embedded-image extraction when possible
- prefer `pdfcpu` first
- prefer `mutool` over `magick` as the next optional backend
- do not prioritize `pdftoppm` in the current launch path

### Draft decision 3. `pdf from-images` should stay intentionally simple

Decision for this milestone:

- preserve input order
- package images into pages with minimal layout expectations
- defer advanced page-size/layout controls

### Draft decision 4. `pdf to-markdown` should be exposed under `pdf`

Decision for this milestone:

- treat `pymupdf4llm` as an in-scope PDF workflow rather than a distant experiment
- keep progress feedback visible
- support a mode where markdown can write a separate images folder for external image references

## Deferred Decisions and Revisit Triggers

### 1. Separate page-rasterization mode

Decision for this milestone:

- do not make full-page rasterization the default meaning of `pdf to-images`

Revisit trigger:

- real workflows require one output image per page for scanned or vector-only PDFs
- embedded-image extraction proves too narrow as the only first-pass behavior

If revisit trigger is met:

- add an explicit render mode or separate command path
- evaluate `mutool` first for that expansion

### 2. `magick` as a first-class PDF backend

Decision for this milestone:

- keep `magick` out of the primary launch backend set even if installed
- treat it as a lower-priority optional image tool behind `mutool`

Revisit trigger:

- `pdfcpu import` or `mutool` leave material gaps for images -> PDF or image normalization workflows
- the additional dependency complexity is justified by a concrete use case

## Related Plans

- `docs/plans/plan-2026-02-25-initial-launch-lightweight-implementation.md`

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
