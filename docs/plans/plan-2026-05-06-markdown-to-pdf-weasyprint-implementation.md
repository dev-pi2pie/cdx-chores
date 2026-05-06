---
title: "Markdown to PDF with WeasyPrint implementation"
created-date: 2026-05-06
modified-date: 2026-05-06
status: completed
agent: codex
---

## Goal

Implement a dedicated `md to-pdf` workflow that converts Markdown into print-ready PDF output through a deterministic Pandoc HTML stage, generated HTML/CSS recipe defaults, and WeasyPrint rendering.

The first implementation should make the direct CLI useful without adding Codex-assisted template generation or a new interactive Markdown PDF flow.

## Why This Plan

The related research freezes the main product decisions:

- `md to-pdf` belongs under the Markdown command group, not the separate PDF-native command group.
- Pandoc should parse Markdown and generate standalone HTML.
- WeasyPrint should render the generated HTML and print CSS to PDF.
- Default HTML and CSS should be built into the tool, but users should be able to materialize and customize the recipe.
- Local image paths should resolve relative to the Markdown input file.
- Remote assets should be disabled by default and require explicit opt-in.
- Codex-assisted recipe generation should be deferred until the deterministic renderer path is proven.

This plan turns those decisions into an implementation sequence.

## Starting State

At plan creation, the Markdown implementation only had:

- `src/cli/actions/markdown.ts`:
  - `actionMdToDocx`
  - `actionMdFrontmatterToJson`
- `src/cli/commands/markdown.ts`:
  - `md to-docx`
  - `md frontmatter-to-json`
- `src/cli/actions/doctor.ts` reports `pandoc` and maps it to `md.to-docx`.
- `src/cli/deps.ts` only knows about `pandoc` and `ffmpeg`.
- Existing fixture evidence shows a Pandoc HTML template and CSS can generate a WeasyPrint PDF:
  - `test/fixtures/docs/pandoc-weasyprint-template.html`
  - `test/fixtures/docs/pandoc-fixture.css`
  - `test/fixtures/docs/metadata-rich.pdf`

## Implementation Status

Phases 1-6 are complete and linked through completed job records. The deterministic `md to-pdf` workflow, `md pdf-template init`, `doctor` capability reporting, focused tests, public guide, and README command summaries are now recorded.

## Scope

### Direct CLI

- Add `cdx-chores md to-pdf`.
- Require `--input <path>`.
- Derive the default output path from the Markdown input path:
  - `docs/report.md` -> `docs/report.pdf`
- Allow `--output <path>` to override the derived PDF path.
- Require `--overwrite` when the resolved PDF output already exists.
- Do not write PDF bytes to stdout in v1.

### Recipe defaults

- Add a Markdown PDF recipe boundary that can generate:
  - `template.html`
  - `style.css`
- Keep generated recipe content deterministic.
- Keep presets as inputs to recipe generation, not hidden renderer modes.
- Support first-pass presets:
  - `article`
  - `report`
  - `wide-table`
  - `compact`
  - `reader`

### Page options

- Support:
  - `--preset <article|report|wide-table|compact|reader>`
  - `--page-size <value>`
  - `--orientation <portrait|landscape>`
  - `--margin <length>`
  - `--margin-x <length>`
  - `--margin-y <length>`
  - `--margin-top <length>`
  - `--margin-right <length>`
  - `--margin-bottom <length>`
  - `--margin-left <length>`
- Validate margin lengths against a narrow CSS length set:
  - `mm`
  - `cm`
  - `in`
  - `pt`
  - `px`
- Reject unitless values and arbitrary CSS expressions for CLI convenience flags.

### Table of contents

- Make ToC explicit:
  - `--toc`
  - `--toc-depth <n>`
  - `--toc-page-break <auto|none|before|after|both>`
- Default `--toc-page-break` to `auto`.
- In `auto`, insert a page break after ToC for the `report` preset when ToC is enabled.
- In `auto`, avoid extra ToC page breaks for `article`, `compact`, `reader`, and `wide-table` unless fixture review proves a better default.

### Custom recipe input

- Support:
  - `--template <path>`
  - `--css <path>`
  - `--no-default-css`
- Use built-in template and CSS when custom paths are omitted.
- When `--css` is provided without `--no-default-css`, apply default CSS first and user CSS after it.
- When `--no-default-css` is provided, apply only user CSS.
- Validate custom template and CSS paths before invoking external renderers.

### Template materialization

- Add:

```bash
cdx-chores md pdf-template init --output ./pdf-template
```

- Write:

```text
pdf-template/
  template.html
  style.css
```

- Require `--output <directory>`.
- Write into a new or empty directory by default.
- Overwrite existing recipe files only with `--overwrite`.
- Support the same recipe-affecting options as `md to-pdf` where applicable:
  - `--preset`
  - `--page-size`
  - `--orientation`
  - margin flags
  - ToC flags

### Intermediate HTML

- Support:

```bash
cdx-chores md to-pdf --input report.md --html-output report.render.html
```

- Write intermediate HTML only when `--html-output <path>` is passed.
- Do not leave implicit debug files after failed renders.
- Make the HTML artifact match the exact generated HTML passed to WeasyPrint.

### Asset policy

- Resolve relative local image paths against the Markdown input file directory, not the process cwd.
- Allow absolute local image paths, but do not optimize for recipe portability around them.
- Allow WeasyPrint to render with warnings when a local image is missing; surface renderer warnings clearly.
- Disable `http` and `https` assets by default.
- Add `--allow-remote-assets` as the explicit opt-in for remote assets.
- Allow `file` and `data` protocols by default.
- Include fixture coverage for local PNG or JPEG image resolution and SVG if the environment supports it reliably.

### Dependency checks

- Extend dependency inspection to include `weasyprint`.
- Keep `md.to-docx` dependent on `pandoc`.
- Make `md.to-pdf` dependent on both:
  - `pandoc`
  - `weasyprint`
- Prefer `weasyprint --info` inspection.
- Fall back to `weasyprint --version` if `--info` is unavailable or unsuitable.
- Surface WeasyPrint install hints separately from Pandoc install hints.

### Documentation

- Add or update public usage docs after the command is implemented.
- Link the implementation job record back to this plan and the research doc.
- Keep the separate `pdf` command group plan as the owner for PDF-native workflows.

## Non-Goals

- no Codex-assisted `md pdf-template suggest` in this implementation
- no interactive `md to-pdf` flow in this implementation
- no raw CSS generated by Codex
- no PDF-native merge, split, extraction, image rendering, or PDF-to-Markdown features
- no PDF stdout mode
- no remote asset fetching unless `--allow-remote-assets` is passed
- no attempt to fail before render on every missing image reference
- no advanced CSS expression support through margin flags

## Proposed Command Surface

Default render:

```bash
cdx-chores md to-pdf --input input.md
```

Explicit render:

```bash
cdx-chores md to-pdf \
  --input input.md \
  --output output.pdf \
  --preset article \
  --page-size A4 \
  --orientation portrait \
  --margin 18mm
```

ToC:

```bash
cdx-chores md to-pdf \
  --input report.md \
  --preset report \
  --toc \
  --toc-depth 3 \
  --toc-page-break auto
```

Custom recipe:

```bash
cdx-chores md to-pdf \
  --input report.md \
  --template ./pdf-template/template.html \
  --css ./pdf-template/style.css
```

Materialize recipe:

```bash
cdx-chores md pdf-template init \
  --preset report \
  --orientation portrait \
  --margin 18mm \
  --output ./pdf-template
```

## Architecture

### Recipe module

Add a dedicated module under `src/cli/markdown-pdf/`:

```text
src/cli/markdown-pdf/
  recipe.ts
  validation.ts
  render.ts
```

Responsibilities:

- build default template and CSS strings from normalized options
- validate page size, orientation, margins, ToC depth, ToC page-break mode, preset, and asset policy options
- expose a small render orchestration helper for the action layer

The action layer should stay thin: validate paths, normalize options, call the recipe/render helpers, handle process failures, and print the final output path.

### Pandoc stage

Use Pandoc to generate standalone HTML:

- pass the selected template path or generated temporary template
- pass ToC flags only when `--toc` is enabled
- pass `--toc-depth` only after validation
- produce a concrete HTML file or string that can be used as the WeasyPrint input

The implementation may use a temporary working directory for built-in generated template/CSS files. Temporary files should not be user-visible unless `--html-output` is passed.

### WeasyPrint stage

Invoke WeasyPrint with:

- the generated HTML
- the selected stylesheet list
- a base URL rooted at the Markdown input directory for asset resolution
- local/data protocols enabled by default
- remote protocols enabled only when `--allow-remote-assets` is passed

If the CLI path cannot enforce the default protocol policy cleanly, use the WeasyPrint Python API or a small internal wrapper instead of weakening the asset contract.

### Warning handling

- Treat non-zero Pandoc or WeasyPrint exit codes as command failures.
- Preserve renderer stderr in failure messages.
- On successful render with warnings, print a concise warning block before the success line.
- Do not classify a warning-only render as failure in v1.

## Implementation Touchpoints

- `src/cli/deps.ts`
- `src/cli/actions/doctor.ts`
- `src/cli/actions/index.ts`
- `src/cli/actions/markdown.ts`
- `src/cli/commands/markdown.ts`
- new `src/cli/markdown-pdf/`
- `src/cli/interactive/menu.ts` only if the command list type needs to stay aware that direct CLI support exists; no new interactive flow should be added in this plan
- tests under `test/`
- fixtures under `test/fixtures/docs/`
- future guide docs under `docs/guides/`

## Phase Checklist

### Phase 1: Freeze helpers and validators

- [x] Add preset, orientation, ToC page-break, and margin-unit constants.
- [x] Add option normalization for `md to-pdf`.
- [x] Add validation for:
  - preset
  - page size
  - orientation
  - CSS length units
  - ToC depth
  - ToC page-break mode
  - custom template path
  - custom CSS path
- [x] Add default PDF output derivation from the Markdown input path.
- [x] Add tests for validation and default output derivation before renderer execution.

### Phase 2: Add recipe generation

- [x] Add a built-in Pandoc HTML template.
- [x] Add built-in CSS generation for all first-pass presets.
- [x] Add CSS generation for page size, orientation, margins, and ToC page-break behavior.
- [x] Add `md pdf-template init` command wiring.
- [x] Add tests for generated `template.html` and `style.css` content.
- [x] Add tests for output-directory refusal and `--overwrite` behavior.

### Phase 3: Add direct PDF rendering

- [x] Add `MdToPdfOptions` and `actionMdToPdf`.
- [x] Require `pandoc` and `weasyprint` before rendering.
- [x] Generate Pandoc standalone HTML with the selected recipe.
- [x] Pass the resolved Markdown input directory as the asset base URL.
- [x] Apply default CSS and custom CSS in the documented order.
- [x] Write `--html-output` only when explicitly requested.
- [x] Capture and surface renderer warnings.
- [x] Print `Wrote PDF: <path>` on success.
- [x] Add tests for command wiring and action failure paths with mocked renderer execution.

### Phase 4: Add asset policy coverage

- [x] Enforce `file,data` asset protocols by default.
- [x] Add `--allow-remote-assets` to opt in to `http,https`.
- [x] Add local image fixture coverage for relative paths resolved from the Markdown file directory.
- [x] Add a warning-path test for missing local image references when practical.
- [x] Keep fixture-level SVG smoke coverage deferred until local renderer behavior is stable.

### Phase 5: Extend doctor

- [x] Add `weasyprint` to dependency inspection.
- [x] Parse WeasyPrint version or info output.
- [x] Add install hints for macOS, Windows, and Linux.
- [x] Add `tools.weasyprint` to `doctor --json`.
- [x] Add `capabilities["md.to-pdf"]`.
- [x] Update human-readable `doctor` output to show WeasyPrint separately.
- [x] Add doctor payload and human-output tests.

### Phase 6: Docs and verification

- [x] Add or update a Markdown PDF usage guide.
- [x] Add a job record for the implementation pass.
- [x] Link the job record to this plan and the research doc.
- [x] Update README command summaries only if the shipped command surface is documented there.
- [x] Run focused Markdown PDF tests.
- [x] Run:

```text
bun run lint
bun run format:check
bun run build
git diff --check
```

## Risks and Mitigations

- Risk: WeasyPrint availability differs by platform even when the Python package is installed.
  Mitigation: make `doctor` inspect WeasyPrint directly, preserve stderr detail, and document platform library hints separately from Pandoc.

- Risk: remote assets are fetched unexpectedly during local document rendering.
  Mitigation: enforce local/data asset protocols by default and require `--allow-remote-assets` for `http` and `https`.

- Risk: relative image paths resolve against the process cwd instead of the Markdown file directory.
  Mitigation: set the renderer base URL from the input file directory and add fixture coverage where command cwd differs from input cwd.

- Risk: margin options turn into arbitrary CSS injection.
  Mitigation: validate convenience flags against simple CSS length tokens and leave advanced CSS to custom stylesheet files.

- Risk: ToC defaults create surprising page breaks.
  Mitigation: keep ToC opt-in, default page-break behavior to `auto`, and expose `--toc-page-break` for explicit control.

- Risk: generated recipe content becomes hard to inspect or customize.
  Mitigation: keep `md pdf-template init` deterministic and make the generated files the same recipe shape used by the default renderer path.

- Risk: renderer warnings are mistaken for a clean success.
  Mitigation: print warnings clearly while still allowing warning-only renders to complete.

## Related Research

- `docs/researches/research-2026-05-06-markdown-to-pdf-weasyprint.md`
- `docs/researches/research-2026-02-25-pdf-backend-comparison-for-merge-split-and-image-workflows.md`
- `docs/researches/research-2026-02-25-cdx-chores-cli-scope-and-architecture.md`

## Related Plans

- `docs/plans/plan-2026-03-11-pdf-cli-workflows-implementation.md` — separate PDF-native workflow plan. This plan should not absorb merge, split, image conversion, or PDF-to-Markdown extraction.

## Related Jobs

- `docs/plans/jobs/2026-05-06-markdown-to-pdf-weasyprint-phases-1-5.md`
- `docs/plans/jobs/2026-05-06-markdown-to-pdf-weasyprint-phase-6-docs.md`

## References

[^markdown-action]: `src/cli/actions/markdown.ts`
[^markdown-command]: `src/cli/commands/markdown.ts`
[^doctor-action]: `src/cli/actions/doctor.ts`
[^deps]: `src/cli/deps.ts`
[^research]: `docs/researches/research-2026-05-06-markdown-to-pdf-weasyprint.md`
