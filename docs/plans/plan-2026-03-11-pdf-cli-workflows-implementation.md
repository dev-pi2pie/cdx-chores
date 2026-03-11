---
title: "PDF CLI workflows implementation"
created-date: 2026-03-11
modified-date: 2026-03-11
status: draft
agent: codex
---

## Goal

Turn the current PDF backend research into an implementation-ready plan for the `pdf` command group, covering direct CLI usage, interactive-mode design, capability reporting, and phased delivery for the first PDF workflow release.

## Why This Plan

The repo already exposes deferred `pdf` command placeholders in `src/command.ts`, but the actual behavior contract is still missing.

The PDF research is now specific enough to freeze:

- `pdfcpu` as the launch default for merge, split, embedded-image extraction, and likely images-to-PDF packaging
- `mutool` as a technically strong but license-sensitive optional backend
- `magick` as a lower-priority optional image tool
- `pymupdf4llm` as the planned `pdf to-markdown` backend, but only behind license review or commercial licensing approval
- a deliberate choice not to rely on `qpdf` for the immediate launch path

This plan converts that research into a concrete command surface and implementation sequence without reopening the backend decision.

## Current State

- `src/command.ts` already includes deferred placeholders for:
  - `pdf merge`
  - `pdf split`
  - `pdf to-images`
  - `pdf from-images`
- there is no `pdf to-markdown` command surface yet
- interactive root flow does not yet expose a `pdf` command family
- `doctor` does not yet report the PDF capability matrix described in the research
- the repo does not yet document PDF license-sensitive backend guidance in the command family itself
- the research doc is still `draft`, which is correct until implementation begins

## Design Contract

### Command family scope

This plan covers the first direct and interactive release for:

- `pdf merge`
- `pdf split`
- `pdf to-images`
- `pdf from-images`
- `pdf to-markdown`

### Backend routing contract

- default structural backend:
  - `pdfcpu` for `pdf merge`
  - `pdfcpu` for `pdf split`
- default extraction and packaging backend:
  - `pdfcpu` for `pdf to-images`
  - `pdfcpu` for `pdf from-images`
- planned markdown backend candidate:
  - `pymupdf4llm` for `pdf to-markdown`, only if the project later decides to support that license-sensitive backend
- preferred optional fallback for image-oriented PDF workflows:
  - `mutool` as a documented license-sensitive optional backend
- lower-priority optional image tool:
  - `magick`
- later optional structural fallback only:
  - `qpdf`
- license-sensitive markdown backend:
  - `pymupdf4llm` as a documented optional backend if the project later supports it

### Licensing documentation contract

- the default shipped path should stay valid without bundling AGPL-sensitive or commercial-license-sensitive backends
- Artifex-backed tools such as `mutool` and `pymupdf4llm` must be treated as license-sensitive
- `doctor`, command help, and guide docs should communicate capability separately from license responsibility
- the docs should explain that `cdx-chores` may detect or use user-provided third-party tools without bundling or installing them
- the docs should also state clearly that users or operators remain responsible for checking and complying with the applicable third-party license terms

### Direct CLI contract

#### `pdf merge`

Recommended first-pass shape:

- `pdf merge <input...> --output <path>`

First-pass flags:

- `--output <path>` required
- `--overwrite` optional

V1 behavior:

- merge input PDFs in the provided order
- fail clearly when fewer than two inputs are provided
- fail clearly on unreadable or unsupported inputs
- prefer deterministic output and no interactive confirmation in direct CLI mode

Deferred:

- interleaving or collate modes
- bookmark/table-of-contents preservation tuning
- user-visible backend override flag

#### `pdf split`

Recommended first-pass shape:

- `pdf split <input> --output-dir <path>`

First-pass flags:

- `--output-dir <path>` required
- `--overwrite` optional

V1 behavior:

- split into one output PDF per source page
- write outputs into the target directory with deterministic naming
- keep first release focused on page-by-page splitting

Deferred:

- page-range selection
- chunk-size splitting
- bookmark-driven splitting

#### `pdf to-images`

Recommended first-pass shape:

- `pdf to-images <input> --output-dir <path>`

First-pass flags:

- `--output-dir <path>` required
- `--pages <selection>` optional
- `--overwrite` optional

V1 behavior:

- treat the command as embedded-image extraction, not page rasterization
- use `pdfcpu` first
- use page selection only where the backend supports narrowing extraction scope
- fail clearly when no embedded images are found instead of silently rasterizing every page
- if a later `mutool` fallback path is enabled, treat it as a documented user-provided license-sensitive backend rather than part of the default path
- CLI help for this command must explicitly say `Extract embedded images from PDF (does not render pages in v1)` or equivalent

Deferred:

- `--mode render`
- page rasterization output
- DPI and render-format controls
- user-visible backend override flag

#### `pdf from-images`

Recommended first-pass shape:

- `pdf from-images <input...> --output <path>`

First-pass flags:

- `--output <path>` required
- `--overwrite` optional

V1 behavior:

- preserve the provided or discovered image order
- package each image as one PDF page
- keep layout expectations simple and explicit
- prefer natural-sort order when a directory expansion path is later added

Deferred:

- page-size selection
- fit, crop, margin, or alignment controls
- mixed-source normalization features

#### `pdf to-markdown`

Recommended first-pass shape:

- `pdf to-markdown <input> --output <path>`

First-pass flags:

- `--output <path>` required
- `--images <external|embed|skip>` optional
- `--image-dir <path>` optional, required when `--images external` needs an explicit location
- `--overwrite` optional

V1 behavior:

- use `pymupdf4llm` only if the project later decides to support that license-sensitive backend
- keep progress feedback visible
- support markdown with:
  - external image assets in a separate folder
  - embedded/inline image mode when supported by the backend flow
  - no exported images when `--images skip` is chosen
- if the backend path is supported, help and guides must identify it as a license-sensitive user-provided backend

Deferred:

- page-range filtering
- alternate output formats under the same command
- advanced markdown post-processing templates

### Validation contract

- output path flags must be explicit for all PDF write operations
- `--overwrite` remains opt-in
- commands fail clearly on missing dependencies, invalid paths, and unreadable inputs
- `pdf to-images` must not silently switch to rasterization mode
- `pdf to-markdown --images external` must validate image-folder behavior clearly
- supported license-sensitive backends must be clearly marked in help and guide docs
- help and guide docs must explain when a supported backend is license-sensitive and user-provided

### Capability reporting contract

`doctor` should expose PDF capability by workflow rather than one flat command list.

Recommended first-pass capability keys:

- `pdf.merge.default`
- `pdf.split.default`
- `pdf.to-images.default`
- `pdf.to-images.optional`
- `pdf.image-tools.optional`
- `pdf.from-images.default`
- `pdf.to-markdown`
- `pdf.merge.optional-fallback`
- `pdf.split.optional-fallback`
- `pdf.license-sensitive`

### Interactive mode design

#### Root and family entry

- add `pdf` to the interactive root menu
- present PDF actions as a second-level submenu
- keep direct CLI and interactive flows on the same backend action handlers

#### Interactive `pdf merge`

Recommended prompt flow:

1. Prompt for multiple input PDF paths.
2. Show resolved file order.
3. Prompt for output path.
4. Prompt whether overwrite is allowed if the output already exists.
5. Show a concise execution summary.
6. Run the merge action with progress/status feedback.

#### Interactive `pdf split`

Recommended prompt flow:

1. Prompt for one input PDF path.
2. Explain that v1 splits into one PDF per page.
3. Prompt for output directory.
4. Prompt whether existing outputs may be overwritten.
5. Show the destination summary.
6. Run the split action with progress/status feedback.

#### Interactive `pdf to-images`

Recommended prompt flow:

1. Prompt for one input PDF path.
2. Explain that v1 extracts embedded images rather than rendering pages.
3. Prompt for output directory.
4. Optionally prompt for page selection when that path is supported.
5. Prompt overwrite behavior if relevant.
6. Run extraction with progress/status feedback.
7. If no embedded images are found, return a clear result and do not silently switch modes.

#### Interactive `pdf from-images`

Recommended prompt flow:

1. Prompt for ordered image inputs.
2. Show the final image order before execution.
3. Prompt for output PDF path.
4. Prompt overwrite behavior if relevant.
5. Show a concise summary of page count and output path.
6. Run packaging with progress/status feedback.

#### Interactive `pdf to-markdown`

Recommended prompt flow:

1. Prompt for one input PDF path.
2. Prompt for markdown output path.
3. Prompt for image handling mode:
   - external images folder
   - embedded images
   - no images
4. If external images are chosen, prompt for the image directory.
5. Show a concise summary of output choices.
6. If this flow uses a license-sensitive user-provided backend, show a short note that the backend is not bundled by `cdx-chores` and that users or operators remain responsible for license compliance.
7. Run conversion with visible progress feedback.

## Scope

- implement the real `pdf` subcommands now deferred in `src/command.ts`
- add `pdf to-markdown`
- add PDF capability reporting in `doctor`
- add interactive routing and prompts for the `pdf` family
- keep backend selection automatic in v1 rather than user-configurable
- add focused test coverage and playground smoke assets for representative PDF flows
- add guide documentation for license-sensitive user-provided PDF backends

## Non-Goals

- `qpdf` installation or required support in the first implementation pass
- page-rasterization mode for `pdf to-images`
- advanced page layout controls for `pdf from-images`
- backend override flags such as `--backend pdfcpu`
- OCR
- PDF editing, annotation, stamping, rotation, or metadata authoring workflows
- `docx to-pdf`
- shipping `mutool` or `pymupdf4llm` paths in proprietary or commercial distribution before license review
- asserting in product docs that user-installed tools automatically eliminate licensing concerns

## Risks and Mitigations

- Risk: users may interpret `pdf to-images` as one image per page.
  Mitigation: freeze the command contract around embedded-image extraction and state that explicitly in help text and interactive prompts.

- Risk: `pdf from-images` may attract layout and sizing requests immediately.
  Mitigation: keep v1 intentionally simple and document layout controls as deferred.

- Risk: `pymupdf4llm` may introduce Python-environment variability.
  Mitigation: keep capability checks explicit in `doctor` and fail with targeted guidance when unavailable.

- Risk: optional installed tools such as `magick` may pressure the CLI into ambiguous routing.
  Mitigation: keep backend routing deterministic and internal in v1.

- Risk: technically attractive backends may introduce AGPL or commercial-license obligations that the project does not want to accept.
  Mitigation: keep permissive tools as the default path and document license-sensitive user-provided backends clearly.

- Risk: users may incorrectly assume that a separately installed backend means there are no license obligations.
  Mitigation: state clearly in guide docs that `cdx-chores` does not bundle those tools and that users or operators remain responsible for checking the applicable third-party license terms.

## Implementation Touchpoints

- `src/command.ts`
- new PDF action files under `src/cli/actions/`
- interactive PDF routing under `src/cli/interactive/`
- `src/cli/actions/doctor.ts`
- shared process and path helpers under `src/cli/`
- focused PDF tests under `test/`
- playground smoke assets under `examples/playground/`
- usage guides under `docs/guides/`

## Phase Checklist

### Phase 1: Freeze command contracts from research

- [ ] freeze direct CLI shapes for:
  - [ ] `pdf merge`
  - [ ] `pdf split`
  - [ ] `pdf to-images`
  - [ ] `pdf from-images`
  - [ ] `pdf to-markdown`
- [ ] freeze `pdf to-images` as embedded-image extraction, not page rendering
- [ ] freeze `pdf from-images` as simple ordered packaging
- [ ] freeze `pdf to-markdown` image handling choices:
  - [ ] `external`
  - [ ] `embed`
  - [ ] `skip`
- [ ] freeze capability-key naming for `doctor`
- [ ] freeze which backends are permissive-default versus license-sensitive
- [ ] freeze guide wording for license-sensitive user-provided backends

### Phase 2: Direct CLI command wiring

- [ ] replace deferred handlers for existing `pdf` subcommands with real actions
- [ ] add `pdf to-markdown` to `src/command.ts`
- [ ] add argument and flag validation for each PDF subcommand
- [ ] keep overwrite handling explicit and opt-in
- [ ] keep result and error messaging aligned with existing CLI conventions

### Phase 3: Backend adapters and capability routing

- [ ] implement `pdfcpu` command adapters for:
  - [ ] merge
  - [ ] split
  - [ ] embedded-image extraction
  - [ ] images-to-PDF packaging
- [ ] implement `pymupdf4llm` adapter for markdown conversion
- [ ] add optional `mutool` fallback path only as a documented license-sensitive backend path
- [ ] keep `magick` outside the primary routing path
- [ ] keep `qpdf` outside the required launch path
- [ ] keep `pymupdf4llm` out of the default shipped path unless the project later chooses to support it
- [ ] ensure no automatic installation or bundling is implied for license-sensitive backends

### Phase 4: Doctor and dependency reporting

- [ ] add PDF workflow capability checks to `doctor`
- [ ] distinguish default capabilities from optional fallbacks
- [ ] report `pymupdf4llm` availability separately from CLI binaries
- [ ] report license-sensitive backends separately from permissive defaults
- [ ] report when a backend is license-sensitive and user-provided
- [ ] keep missing-dependency messaging actionable without exposing machine-specific doc snapshots

### Phase 5: Interactive PDF family

- [ ] add `pdf` to the interactive root menu
- [ ] add PDF action selection submenu
- [ ] implement prompt flows for:
  - [ ] merge
  - [ ] split
  - [ ] to-images
  - [ ] from-images
  - [ ] to-markdown
- [ ] ensure interactive prompts explain the embedded-image extraction contract for `pdf to-images`
- [ ] ensure interactive prompts preserve progress feedback for `pdf to-markdown`
- [ ] ensure interactive prompts explain the user-provided license-sensitive backend note consistently

### Phase 6: Tests and smoke fixtures

- [ ] add direct CLI tests for each PDF subcommand
- [ ] add failure-mode coverage for missing dependencies and invalid paths
- [ ] add interactive coverage for the PDF family prompt flows
- [ ] add representative playground smoke fixtures under `examples/playground/`
- [ ] validate no silent switch from extraction mode to render mode
- [ ] add coverage for clear messaging around license-sensitive user-provided backend paths

### Phase 7: Guides and close-out

- [ ] add or update PDF usage guides for the new command family
- [ ] document the first-release limits and deferred features
- [ ] document license-sensitive backend constraints and escalation paths
- [ ] add a dedicated guide describing user-provided PDF backends and license-sensitive tooling
- [ ] update the research doc status from `draft` to `in-progress` once implementation begins
- [ ] record any contract drift back into the research and this plan
- [ ] capture follow-up plans if render mode or advanced layout controls become necessary

## Success Criteria

- the `pdf` command group is no longer deferred for the first release workflows
- direct CLI and interactive mode share one consistent command contract
- `doctor` reports PDF workflow capability clearly
- `pdf to-images` behaves as embedded-image extraction and does not silently rasterize pages
- `pdf to-markdown` supports progress feedback and explicit image-output choices
- the default shipped path avoids license ambiguity for proprietary or commercial distribution

## Verification

- `bunx tsc --noEmit`
- focused PDF command tests under `test/`
- interactive PDF flow tests under `test/`
- manual smoke checks in `examples/playground/` for:
  - merge
  - split
  - embedded-image extraction
  - images-to-PDF packaging
  - markdown with external images, only if that backend path is implemented
  - markdown without exported images, only if that backend path is implemented


## Related Research

- `docs/researches/research-2026-02-25-pdf-backend-comparison-for-merge-split-and-image-workflows.md`
- `docs/researches/research-2026-02-25-cdx-chores-cli-scope-and-architecture.md`

## Related Plans

- `docs/plans/plan-2026-02-25-initial-launch-lightweight-implementation.md`
