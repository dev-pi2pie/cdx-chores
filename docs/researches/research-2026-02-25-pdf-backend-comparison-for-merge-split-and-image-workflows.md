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
- `pdf to-images --mode extract`
- `pdf from-images`

This does not mean one tool solves every future PDF case, but it is the cleanest first default for the current scope.

### 2. `qpdf` remains valuable, but should stay outside the current implementation path

qpdf CLI docs show strong page-selection operations through `--pages` and `--split-pages`.[^qpdf-cli]

That still makes qpdf a strong structural PDF tool, but the current implementation decision is narrower:

- default merge/split backend: `pdfcpu`
- `qpdf` is not part of the current PDF workflow implementation path

This keeps qpdf documented as a viable structural reference without treating it as part of the immediate implementation baseline.

### 3. `pdf to-images` should expose explicit modes, with extraction as the default

The current product choice is to make the command mode-based instead of overloading one ambiguous default behavior.

`pdfcpu` supports direct embedded-image extraction through `pdfcpu images extract` and `pdfcpu extract -mode image`.[^pdfcpu-usage]

Implication:

- launch default for `pdf to-images --mode extract`: `pdfcpu`
- preferred optional backend ahead of `magick`: `mutool`
- page rendering should be an explicit `--mode render` contract, not an implied fallback
- `mutool draw` is the first concrete render path to evaluate for v1 page rasterization
- `pdftoppm` is no longer the preferred launch path for this command

`pdftoppm` remains useful for full-page rasterization workflows, but that is now treated as one possible backend choice for explicit render mode rather than the default meaning of `pdf to-images`.[^pdftoppm-man]

This is an important contract change: `pdf to-images` should declare whether it is extracting embedded images or rendering pages.

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
- default external image export to an `images/` folder unless users provide an explicit override
- resolve the default `images/` folder relative to the markdown output file so link generation stays predictable

This is no longer just a speculative later idea. It is a valid PDF command candidate, subject to normal implementation planning.

### 7. Research docs should describe runtime capability design, not snapshot a specific machine state

The earlier draft captured a user-reported environment inventory.

That should not live in this research doc. The durable design point is:

- `doctor` should detect capabilities at runtime
- documentation should describe backend contracts and fallback strategy
- research should avoid embedding ephemeral local install state unless the environment itself is the subject of the research

### 8. License posture narrows the safe default path

License fit matters alongside technical fit.

Primary-source licensing direction:

- `pdfcpu`: Apache-2.0[^pdfcpu-license]
- `qpdf`: Apache-2.0[^qpdf-license]
- `ImageMagick`: commercial use is allowed under the ImageMagick license, subject to normal compliance obligations[^imagemagick-license]
- `MuPDF`: AGPL or commercial licensing from Artifex[^mupdf-license][^artifex-licensing]
- `PyMuPDF` and the surrounding Artifex stack: AGPL or commercial licensing from Artifex[^artifex-pymupdf][^pymupdf-license]

Implication:

- the safest default shipped path is built around permissive tools such as `pdfcpu`
- `mutool` and `pymupdf4llm` should be treated as license-sensitive backends
- for proprietary or commercial distribution, Artifex-backed tools should not be assumed safe defaults unless AGPL obligations are intentionally accepted or a commercial license is obtained
- if these backends are referenced in product UX or docs, they should be described as user-provided third-party tools and the docs should state clearly that users or operators remain responsible for checking the applicable license terms

## Comparison Table

| Tool | Primary Role | Merge/Split | PDF -> Images | Images -> PDF | PDF -> Markdown/Text | Notes / Risks | Launch-Phase Fit |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `pdfcpu` | Broad PDF processor (Go CLI) | Strong | Strong for embedded-image extraction | Strong (`import`) | No markdown focus | Best launch anchor across the current PDF workflow set; permissive license posture is favorable | Default for `pdf merge`, `pdf split`, `pdf to-images --mode extract`, and likely `pdf from-images` |
| `qpdf` | Structural PDF manipulation | Strong | No | No | Inspection/JSON only | Strong structural alternative with permissive licensing; document as reference-only for now rather than part of the active implementation path | Out of current implementation scope |
| `mutool` (MuPDF) | PDF rendering/conversion/extraction toolkit | Merge usable | Strong (`extract`, `draw`, `convert`) | Limited/indirect | Text/content extraction possible, but not markdown-focused | Technically strong, but AGPL or commercial licensing means it should stay behind a license-review gate for proprietary or commercial distribution | License-sensitive optional backend |
| `magick` | General image conversion/manipulation | No (not preferred for structure ops) | Possible | Strong | No | PDF behavior can vary by delegates/policy; license posture is more permissive than Artifex-backed options | Deferred or backup-only |
| `pdftoppm` | PDF rasterization to images | No | Strong for page rasterization | No | No | Useful for a different contract: per-page rendering rather than embedded-image extraction | Deferred from current launch choice |
| `pymupdf4llm` | PDF content extraction for LLM/RAG workflows | No | Image/vector export within markdown extraction flow | No | Strong | Strong fit for markdown plus extracted assets, but should be treated as license-sensitive because of the Artifex licensing model around PyMuPDF | License-sensitive candidate for `pdf to-markdown` |
| `pandoc` | Document format conversion | No | No | No | Converts document formats, not PDF structure ops | Useful elsewhere, not a PDF backend for these workflows | Not a fit for this backend set |

## Implications or Recommendations

### A. Freeze a permissive-first launch backend mapping

Recommended launch mapping:

- `pdf merge`: default `pdfcpu`
- `pdf split`: default `pdfcpu`
- `pdf to-images --mode extract`: default `pdfcpu`
- `pdf from-images`: simple ordered packaging, with `pdfcpu import` as the first validation target
- optional image-tool fallback later: `ImageMagick`
- `mutool`: license-review-required optional backend
- `pymupdf4llm`: license-review-required markdown backend

### B. Clarify the command contracts before implementation

The command names need explicit behavior contracts:

- `pdf to-images` should expose explicit modes such as `extract` and `render`
- `extract` should be the default first-release mode and should mean embedded-image extraction, not automatic rasterization of every page
- `render` should be explicit and should never be reached by silent fallback from `extract`
- `render` should use `mutool draw` as the first concrete backend path, emitting one PNG per rendered page
- `--pages` should use 1-based comma-and-range syntax such as `1,3-5` and should be supported only for `render` in v1
- CLI help and interactive copy should explain the selected mode clearly
- `pdf from-images` should explicitly stay in simple packaging mode for v1
- `pdf to-markdown` should include progress feedback and an explicit asset-output choice
- `pdf to-markdown` should default to `--images external` with `images/` as the default asset directory, resolved relative to the markdown output path

### C. Keep capability reporting dynamic

`doctor` should report detected PDF capabilities at runtime rather than relying on a documented snapshot of one machine.

Recommended capability framing:

- `pdf.merge.default`: `pdfcpu`
- `pdf.split.default`: `pdfcpu`
- `pdf.to-images.extract.default`: `pdfcpu`
- `pdf.to-images.render.optional`: `mutool draw` if license-approved
- `pdf.image-tools.optional`: `magick`
- `pdf.from-images.default`: `pdfcpu`
- `pdf.to-markdown`: `pymupdf4llm` if license-approved

The actual availability of those capabilities should always come from runtime checks.

### D. Add explicit documentation guidance before shipping optional PDF backends

Before enabling optional backends in a shipped product or commercial workflow:

- confirm whether the distribution model is proprietary, internal-only, open-source, or network-served
- review whether AGPL obligations are acceptable for that use case
- if AGPL obligations are not acceptable, do not ship or depend on Artifex-backed tools without a commercial license
- keep permissive defaults available so the base `pdf` command group can ship without license ambiguity
- do not assume that a user-installed third-party tool automatically removes license obligations
- guide docs should explain that `cdx-chores` may detect or use user-provided third-party backends without bundling or installing them
- guide docs should identify license-sensitive backends explicitly and state that users or operators remain responsible for checking and complying with the applicable license terms

### E. Validate the chosen defaults against representative file classes

Before implementation, validation should focus on:

- merge/split correctness on normal, encrypted, and mixed-page PDFs
- embedded-image extraction behavior on image-rich, scanned, and vector-heavy PDFs
- explicit render-mode behavior on scanned and vector-heavy PDFs, including page-selection parsing and PNG output naming
- `mutool` render or extraction behavior when `pdfcpu` is insufficient, only if license review approves its use
- whether installed `magick` adds enough practical value to justify any later image-normalization bridge in PDF flows
- image-order preservation and page sizing behavior for `pdfcpu import`
- markdown progress behavior and external-image-folder output ergonomics for `pymupdf4llm`, only if license review approves its use

## Decision Updates

### Draft decision 1. `pdfcpu` should be the default merge/split backend

Decision for this milestone:

- use `pdfcpu` as the default backend for `pdf merge` and `pdf split`
- do not require `qpdf` for the current launch path
- keep `qpdf` outside this implementation path unless a separate follow-up decision changes that

### Draft decision 2. `pdf to-images` should be mode-based

Decision for this milestone:

- define `pdf to-images` around explicit `extract` and `render` modes
- default to `--mode extract`
- use `pdfcpu` first for `extract`
- treat `render` as a separate explicit path rather than a silent fallback
- use `mutool draw` as the first concrete render backend path
- treat `mutool` as a license-sensitive optional backend rather than a default-adjacent fallback
- prefer permissive tools in the shipped default path
- do not prioritize `pdftoppm` in the current launch path
- if a later `mutool` path is enabled for `extract` or `render`, document clearly that it is a user-provided license-sensitive backend

### Draft decision 3. `pdf from-images` should stay intentionally simple

Decision for this milestone:

- preserve input order
- package images into pages with minimal layout expectations
- defer advanced page-size/layout controls

### Draft decision 4. `pdf to-markdown` should remain planned, but license-gated

Decision for this milestone:

- keep `pdf to-markdown` as a planned workflow, but gate any shipped `pymupdf4llm` implementation on license review or commercial licensing approval
- keep progress feedback visible
- default to external image references in an `images/` folder relative to the markdown output path, while still supporting other image modes
- if exposed in product UX later, guide docs and command help should identify it clearly as a license-sensitive user-provided backend

## Deferred Decisions and Revisit Triggers

### 1. Separate page-rasterization mode

Decision for this milestone:

- do not make full-page rasterization the default meaning of `pdf to-images`
- expose rendering, when supported, as an explicit mode instead of a fallback behavior

Revisit trigger:

- real workflows require one output image per page for scanned or vector-only PDFs
- embedded-image extraction proves too narrow as the default mode behavior

If revisit trigger is met:

- expand the explicit render mode path beyond the initial `mutool draw` baseline
- evaluate `mutool` first for that expansion

### 2. `magick` as a first-class PDF backend

Decision for this milestone:

- keep `magick` out of the primary launch backend set even if installed
- treat it as a lower-priority optional image tool behind `mutool`

Revisit trigger:

- `pdfcpu import` or `mutool` leave material gaps for images -> PDF or image normalization workflows
- the additional dependency complexity is justified by a concrete use case

### 3. Shipping Artifex-backed tools in a proprietary or commercial product

Decision for this milestone:

- do not assume `mutool` or `pymupdf4llm` are safe to ship by default in a proprietary or commercial product
- require an explicit license review before enabling those paths outside AGPL-compliant usage
- if those paths are exposed, document them clearly as license-sensitive user-provided backends

Revisit trigger:

- the project intentionally adopts AGPL-compliant distribution for the relevant workflow, or
- a commercial license is obtained from Artifex

## Related Plans

- `docs/plans/archive/plan-2026-02-25-initial-launch-lightweight-implementation.md`

## Related Research

- `docs/researches/research-2026-02-25-cdx-chores-cli-scope-and-architecture.md`
- `docs/researches/research-2026-02-25-excel-like-workflows-scope-and-tooling.md`

## References

[^qpdf-cli]: [qpdf CLI documentation](https://qpdf.readthedocs.io/en/stable/cli.html)
[^pdfcpu-usage]: [pdfcpu usage documentation](https://pdfcpu.io/getting_started/usage.html)
[^pdftoppm-man]: [pdftoppm Debian manpage (poppler-utils)](https://manpages.debian.org/testing/poppler-utils/pdftoppm.1.en.html)
[^imagemagick-magick]: [ImageMagick `magick` command docs](https://imagemagick.org/script/magick.php)
[^imagemagick-formats]: [ImageMagick formats list (PDF/Ghostscript notes)](https://imagemagick.org/script/formats.php)
[^imagemagick-license]: [ImageMagick license](https://imagemagick.org/license/)
[^pymupdf4llm-pypi]: [pymupdf4llm on PyPI](https://pypi.org/project/pymupdf4llm/)
[^mupdf-tools]: [MuPDF tools index](https://mupdf.readthedocs.io/en/latest/tools/index.html)
[^mutool-docs]: [MuPDF `mutool` docs](https://mupdf.readthedocs.io/en/1.26.2/tools/mutool.html)
[^mupdf-license]: [MuPDF license](https://mupdf.readthedocs.io/en/latest/license.html)
[^artifex-licensing]: [Artifex licensing](https://artifex.com/licensing)
[^artifex-pymupdf]: [Artifex on PyMuPDF licensing](https://artifex.com/blog/pymupdf-acquired-by-artifex)
[^pymupdf-license]: [PyMuPDF project site](https://pymupdf.io/)
[^pdfcpu-license]: [pdfcpu GitHub](https://github.com/pdfcpu/pdfcpu)
[^qpdf-license]: [qpdf license docs](https://qpdf.readthedocs.io/en/12.0/license.html)
