---
title: "Markdown PDF template Codex helper implementation"
created-date: 2026-06-23
modified-date: 2026-06-23
status: active
agent: codex
---

## Goal

Implement the direct `md pdf-template codex` helper for generating reviewable Markdown PDF template bundles from bounded document, profile, recipe, intent, font, and cover-media signals.

This plan intentionally does not implement the hybrid one-shot helper or Interactive Markdown PDF mode. Those layers should reuse this direct helper contract after the template artifact path is implemented and verified.

## Milestone Goal

`v0.1.5-canary.3` should not be tagged until this direct template-Codex route is implemented, verified, and documented, or until a separate release decision records why it moved out of the canary.

## Why This Plan

The related research settles the product boundary:

- `md to-pdf` remains deterministic.
- `md pdf-profile codex` remains the quick durable profile-configuration path.
- `md pdf-template codex` is the advanced Codex-assisted template-bundle path for HTML/CSS-backed directions.
- Codex is an opt-in helper that returns bounded template decisions, not an unbounded file writer.
- The user reviews, commits, edits, and renders accepted artifacts through the deterministic `md to-pdf` path.

The first implementation must therefore write explicit files, not render a PDF automatically and not hide assistant-generated HTML/CSS inside `md to-pdf`.

## Starting State

Current Markdown PDF support includes:

- `md to-pdf` through Pandoc-generated HTML and WeasyPrint PDF rendering.
- `md pdf-template init --output <directory>` for editable `template.html` and `style.css` recipe files.
- recipe flags shared by `md pdf-template init` and `md to-pdf`: `--preset`, page shape, margins, `--toc`, `--toc-depth`, and `--toc-page-break`.
- `md to-pdf --template <path>` and `--css <path>` support.
- layered render behavior where custom `--template` replaces generated template HTML and custom `--css` applies after default CSS unless `--no-default-css` is used.
- `md to-pdf` support for combining `--profile`, `--template`, and `--css`.
- `md pdf-profile codex` behavior that reports local cover images, arbitrary CSS, custom HTML, and template-only layout as unsupported profile directions.
- existing Markdown document signal collection, font summary collection, Codex adapter, report, output-path, dry-run, and collision patterns from the profile-Codex helper.

Missing pieces:

- `md pdf-template codex` command registration and action.
- template bundle identity generation.
- template candidate families and bounded slot decisions.
- cover image validation, metadata collection, copying, and redacted reporting.
- Codex prompt, structured output schema, parser, and validator for template decisions.
- deterministic `template.html` and `style.css` synthesis from repo-owned boilerplate and validated slots.
- static template-contract validation for later-render compatibility.
- optional template Codex diagnostic report.
- dry-run, overwrite, generated default output directory, and collision behavior for bundle artifacts.

## Scope

### Command Surface

Add:

```bash
cdx-chores md pdf-template codex report.md \
  --intent "client report with cover image, readable code, and clean dense tables" \
  --base-profile ./report-profile.yml \
  --cover-image ./cover.png \
  --output ./pdf-template
```

Options:

- `[input]`: optional positional Markdown sample used to collect bounded document signals.
- `-i, --input <path>`: optional explicit Markdown sample path; equivalent to positional input.
- `--intent <text>`: optional general template, layout, and design direction.
- `--font-hint <text>`: optional, repeatable font preference hint.
- `--base-profile <path>`: optional existing Markdown PDF profile used as a signal and compatibility target.
- `--cover-image <path>`: optional local still raster cover image; singular in v1.
- `-o, --output <directory>`: optional template bundle output directory.
- `--dry-run`: run signal collection, Codex selection when needed, synthesis planning, and validation without writing recipe files or copying assets.
- `--keep-codex-report`: also write the diagnostic report.
- `--codex-report-output <path>`: explicit diagnostic report path; implies `--keep-codex-report`.
- `--overwrite`: allow replacing selected generated files in an existing output directory.

The command should also accept the deterministic recipe flags supported by `md pdf-template init` and `md to-pdf`:

- `--preset <name>`
- `--page-size <size>`
- `--orientation <orientation>`
- `--margin <value>` and side-specific margin flags already supported by the renderer
- `--toc`
- `--toc-depth <depth>`
- `--toc-page-break`

Do not add narrow style flags just to expose prompt-internal categories. General direction stays in `--intent`; font preference stays in repeatable `--font-hint`; cover media uses explicit `--cover-image`.

### Signal Ladder

Classify command inputs before resolving generated default output directories:

| Inputs | Expected behavior |
| --- | --- |
| no input, no intent, no base profile, no cover image, and no recipe flags beyond defaults | fail as too low-signal; recommend `md pdf-template init` |
| `--base-profile` only | deterministic `document-layered` snapshot from the profile; no Codex call |
| recipe flags only | deterministic `document-layered` snapshot equivalent to `md pdf-template init`; no Codex call |
| `--cover-image` only | deterministic `cover-media-layered` bundle with copied asset and conservative cover hooks; no Codex call |
| `--intent` and/or Markdown input | Codex-assisted template decision |
| profile-Codex unmatched template directions | Codex-assisted escalation path using the same input, intent, and base profile |

Rules:

- positional input and `-i, --input <path>` are aliases.
- conflicting normalized positional and `-i, --input` paths fail before collecting signals.
- `--base-profile` is an input signal, not the output target.
- invalid base profiles fail before Codex.
- `--output` is resolved only after the command has enough signal to proceed.
- no-signal invocations fail before reserving a generated default output directory.
- deterministic rows still use this command because they need template identity, output collision checks, optional reports, copied cover assets, and dry-run behavior.

### Render Contract

Template-Codex writes a bundle. Rendering remains a separate deterministic action:

```bash
cdx-chores md to-pdf \
  --input ./report.md \
  --profile ./report-profile.yml \
  --template ./pdf-template/template.html \
  --css ./pdf-template/style.css \
  --output ./report.pdf
```

Default v1 render posture is layered:

```text
profile recipe fields
  -> explicit md to-pdf recipe flags
  -> generated internal recipe
       -> --template replaces generated template HTML
       -> default CSS remains enabled
       -> --css applies after default CSS
```

The generated template and stylesheet must preserve later-render hooks needed by profile and renderer behavior:

- `$body$`
- title metadata hooks used by the current standalone template structure
- `$if(toc)$ ... $toc$ ... $endif$`
- `#TOC` layout target when ToC support is present
- cover and page-chrome hooks used by profile-backed rendering
- Shiki `.cdx-code*` selectors and code-block hook styling

Self-contained rendering with `--no-default-css` is an advanced posture. V1 should not optimize the default docs or command summary around that mode, but static validation should avoid making it impossible to support later.

### Template Families And Slots

Use two v1 template families:

| Template family | Meaning |
| --- | --- |
| `document-layered` | Default layered skeleton for documents without managed cover media. Preserves current standalone structure and lets recipe presets plus slots control density, table, typography, spacing, and code treatment. |
| `cover-media-layered` | Layered skeleton with managed local cover-media hooks. Selected when `--cover-image` or explicit usable cover-media direction requires copied assets and cover composition slots. |

Keep `recipe_preset` separate from `template_family`:

| Field | Values |
| --- | --- |
| `template_family` | `document-layered`, `cover-media-layered` |
| `recipe_preset` | `article`, `report`, `wide-table`, `compact`, `reader` |
| `slots.cover.style` | `plain`, `report` |

Selection rules:

- no managed local cover image uses `document-layered`.
- `--base-profile` with ordinary profile cover or page chrome, but no local cover image, uses `document-layered`.
- recipe flags only use `document-layered`.
- `--cover-image <path>` uses `cover-media-layered`.
- title-only or profile-compatible cover composition without local image media uses `document-layered` with supported cover slots.
- intent that asks for local image or cover media without `--cover-image` records a missing-media unsupported direction and succeeds only if remaining directions still form a usable bundle.

V1 cover-media slots:

| Slot | Values |
| --- | --- |
| `slots.cover.layout` | `background`, `image-above-title`, `image-below-title` |
| `slots.cover.image_fit` | `cover`, `contain` |
| `slots.cover.title_placement` | `top-left`, `top-center`, `center`, `lower-left`, `lower-center` |
| `slots.cover.aspect_ratio` | `auto` |

`--cover-image` without design intent should use a conservative contained layout, not a full-page cropped background. Full-page background covers require explicit intent or strong document/design signals.

Slot decisions should not expose raw pixel sizing. A large source image should not produce generated CSS such as `width: 4000px`; it should produce bounded decisions such as `image_fit: contain` or `image_fit: cover`, and deterministic CSS should scale the copied asset inside the selected page-relative cover-media region.

### Cover Media And Managed Assets

V1 accepts only local still raster files for `--cover-image`:

- PNG
- JPEG
- WebP

V1 rejects:

- GIF
- animated PNG
- animated WebP
- SVG
- BMP
- TIFF
- PDF
- remote URLs
- non-local asset references

Rules:

- resolve user-provided relative `--cover-image` paths from the CLI working directory.
- copy accepted cover images into `assets/` inside the effective output directory.
- create `assets/` only when managed assets exist.
- use collision-safe bundle filenames when needed.
- reference copied assets from generated HTML/CSS with bundle-relative paths.
- collect bounded image metadata, such as format, dimensions, aspect ratio, orientation bucket, and fit-pressure summary, when practical.
- use `aspect_ratio: auto` when dimensions are unavailable.
- never download, inspect, copy, or emit remote cover-media references in v1.
- existing remote references in accepted Markdown, HTML, or CSS remain a later render-time `--allow-remote-assets` concern, not a template-Codex behavior.

Persisted reports and generated files must not include raw local source directories. They may include source labels, source basenames, formats, dimensions, and bundle-relative paths.

Image dimensions are asset metadata, not direct rendered dimensions. Deterministic synthesis owns the scaling CSS:

| Signal | Values |
| --- | --- |
| `dimensions` | `{ width, height }` when available; otherwise unknown |
| `aspect_ratio` | numeric ratio when available; otherwise unknown |
| `orientation` | `landscape`, `portrait`, `square`, `panoramic`, `tall`, or `unknown` |
| `fit_pressure` | `normal`, `crop-risk`, `letterbox-risk`, or `unknown` |

`fit_pressure` summarizes layout risk from the image aspect ratio and selected cover-media region. It should not become a CLI flag. Codex may use it to choose bounded fit slots, but deterministic CSS must constrain the rendered image with page-relative sizing. The deterministic `--cover-image`-only path should use `image_fit: contain` so oversized images scale down and preserve the full image.

### Codex Contract

Add a Markdown PDF template Codex adapter under the existing Codex adapter boundary.

The adapter should receive:

- supported template families
- supported recipe presets
- supported slot enums and defaults
- summarized document signals
- normalized base-profile signal
- normalized recipe flag signal
- bounded font facts and font hints
- managed asset summaries, not raw copied bytes, including dimensions, aspect ratio, orientation, and fit pressure when available
- later-render placeholder and hook requirements
- disallowed behavior facts: remote URLs, absolute local paths, arbitrary extra files, missing placeholders, and missing required hooks

The adapter should return structured data, not full raw files:

- `decision_mode`: `adapted`, `conservative-fallback`, or `no-usable-template`
- `template_family`
- `recipe_preset`
- bounded `slots`
- managed asset usage by bundle-relative path
- optional bounded CSS blocks tied to named slots
- warnings
- unsupported directions
- fallback reason when relevant

The implementation should turn the research sketch into a strict structured-output schema:

```text
decision_mode
template_family
recipe_preset
slots
  cover
  tables
  code
  spacing
  typography
  colors
css_blocks[]
  slot: enum
  css: bounded string
managed_assets[]
  source_label
  bundle_path
warnings[]
unsupported_directions[]
fallback_reason
```

Validation rules:

- reject unknown enum values unless a deterministic fallback maps them to a documented allowed value.
- reject unknown asset references.
- reject CSS blocks that reference remote URLs or absolute local paths.
- reject CSS blocks that remove or break required hook selectors.
- drop invalid optional CSS blocks only when the failure is non-security styling validation and the remaining bundle is still useful.
- fail closed when unsafe or non-portable material cannot be removed before synthesis.

Codex must not return arbitrary extra files. Deterministic synthesis owns file paths, boilerplate, copied assets, report placement, identity comments, and final validation.

### Deterministic Synthesis

Generate artifacts from repo-owned boilerplate and validated decisions:

```text
pdf-template/
  template.html
  style.css
  assets/
    cover.png
  template.codex-report.json
```

Rules:

- `template.html` includes a template identity comment.
- `style.css` includes a template identity comment.
- `template.html` is synthesized from the selected family and preserved later-render placeholders.
- `style.css` is synthesized from repo-owned base rules plus validated slot decisions and optional bounded CSS blocks.
- deterministic synthesis, not Codex, decides final relative paths.
- deterministic synthesis, not Codex, maps `image_fit: contain` and `image_fit: cover` to page-relative CSS sizing rules.
- generated files must stay inside the effective output directory.
- generated HTML/CSS must not include absolute local paths or remote URLs.
- generated CSS must not use intrinsic source pixel dimensions as rendered width or height.
- V1 should avoid a mandatory metadata file unless implementation discovers comments are too weak for tests or future replay.

### Output, Overwrite, Dry Run, And Reports

Output directory:

- `--output <directory>` follows `md pdf-template init` directory semantics.
- the path must be a directory or a missing path that can be created.
- a non-empty output directory fails unless `--overwrite` is passed.
- `--overwrite` replaces only selected generated files and must not silently delete unrelated files.
- existing files inside `--output` are never read as template inputs, merge bases, or refinement sources, even when they are named `template.html` or `style.css`.
- when `--output` is omitted and the command has enough signal, derive a non-colliding default directory:
  - with input: `<input-stem>.pdf-template-<uid>/`
  - without input: `md-pdf-template-<timestamp>-<uid>/`
- generated defaults retry with a bounded UID loop to avoid collisions.

Report output:

- report output is default off.
- `--keep-codex-report` writes `template.codex-report.json` inside the output directory by default.
- `--codex-report-output <path>` writes the exact JSON path and implies `--keep-codex-report`.
- explicit report paths must be `.json`.
- report paths must not collide with input Markdown, base profile, output directory, generated files, or managed asset source paths.
- dry-run with report flags may write only the diagnostic report.

Report JSON should include:

- artifact type, such as `markdown-pdf-codex-template-report`
- report artifact ID
- template bundle ID
- decision mode
- signal mode
- selected template family
- selected recipe preset
- input document summary or fingerprint when present
- intent and font hints
- base-profile summary and redacted source metadata when present; repository-relative source paths may be recorded only when they are safely inside the current repository
- recipe flag summary
- managed assets with redacted source display
- bundle-relative written or planned files
- validation results
- warnings and unsupported directions
- fallback reason when applicable
- recommended follow-up render command with repository-relative or placeholder paths only

Normal execution should print a concise summary:

- decision mode
- template family
- recipe preset
- output directory
- managed asset count
- report path when written
- fallback reason or unsupported directions when relevant
- follow-up render command

`--dry-run` should:

- collect signals.
- call Codex when needed.
- validate the planned decision.
- print the same summary and planned paths.
- skip writing `template.html`, `style.css`, and copied assets.
- write the report only when explicitly requested.

### Decision Modes

Implement these outcomes:

| Mode | Meaning | CLI behavior | Writes |
| --- | --- | --- | --- |
| `deterministic` | no Codex required; recipe flags, base profile, or cover image are enough | success | bundle unless `--dry-run`; optional report |
| `adapted` | Codex produced valid bounded decisions | success | bundle unless `--dry-run`; optional report |
| `conservative-fallback` | Codex response was usable only after safe reduction | success with visible note | conservative bundle unless `--dry-run`; optional report |
| `no-usable-template` | Codex unavailable, invalid, unsafe, or unsupported after validation | failure | no recipe files; requested failure report only |

Error and exit behavior:

| Outcome | Exit | Writes |
| --- | --- | --- |
| deterministic | `0` | selected bundle files, copied assets, optional report |
| adapted | `0` | selected bundle files, copied assets, optional report |
| conservative-fallback | `0` | selected bundle files, copied assets, optional report |
| no usable template | non-zero | no recipe files or copied assets; requested report only |
| invalid base profile | `2` | no Codex call and no bundle writes |
| invalid cover image | `2` | no Codex call and no bundle writes |
| output collision without `--overwrite` | `2` | no writes |

Conservative fallback is allowed only after security, path-hygiene, asset-boundary, and later-render compatibility checks pass or after unsafe optional material has been fully removed before synthesis.

### Static Validation

V1 runtime validation should be static and later-render aware. The command should not run Pandoc, run WeasyPrint, render a PDF, or generate static ToC markup from the input Markdown.

Hard validation failures:

- `template.html` omits required placeholders such as `$body$`.
- ToC-capable templates omit `$if(toc)$ ... $toc$ ... $endif$` or the `#TOC` layout target.
- generated files omit selected-family hooks for cover, page chrome, or Shiki code selectors.
- generated HTML/CSS references absolute local source paths.
- generated HTML/CSS introduces remote URLs.
- generated files, copied assets, or default in-bundle reports would write outside the output directory.
- explicit `--cover-image` points to an unsupported format or non-local resource.
- Codex returns unsupported asset references, unsafe URLs, absolute source paths, or arbitrary file requests that cannot be removed while preserving a usable bundle.

Fallback-compatible reductions:

- invalid non-security optional CSS blocks can be dropped.
- unsupported slot values can map to the closest allowed slot.
- unavailable image dimensions can use `aspect_ratio: auto`.
- unsupported design directions can move to `unsupported_directions`.
- cover-media intent without usable local media can fall back to `document-layered` only when non-media directions still form a useful bundle.

### Privacy And Path Hygiene

Persisted artifacts must avoid local-environment leakage:

- do not persist raw absolute source paths.
- do not persist raw remote URLs found in input Markdown.
- do not persist raw local font file paths.
- do not persist raw source image directories.
- do not include private source snippets in reports.
- use repository-relative paths in docs and job records.
- use displayed terminal paths only for terminal output, not persisted JSON.
- keep base-profile paths in persisted reports redacted unless they can be represented safely as repository-relative paths.

Managed asset reports should prefer:

```json
{
  "source_label": "--cover-image",
  "source_display": "<redacted>",
  "source_basename": "cover.png",
  "source_kind": "local-file",
  "bundle_path": "assets/cover.png",
  "format": "png",
  "dimensions": {
    "width": 1600,
    "height": 900
  }
}
```

## Implementation Phases

### Phase 1: Command Surface And Shared Types

- [x] Add `md pdf-template codex` command registration and help text.
- [x] Add action types for command options and normalized command state.
- [x] Support positional `[input]` and `-i, --input <path>` aliasing.
- [x] Add recipe flag parity with `md pdf-template init`.
- [x] Add `--intent`, repeatable `--font-hint`, `--base-profile`, `--cover-image`, `--output`, `--dry-run`, `--keep-codex-report`, `--codex-report-output`, and `--overwrite`.
- [x] Add early validation for input alias conflicts, invalid base profiles, invalid cover image paths, and invalid output/report path shapes.
- [x] Add signal-mode and decision-mode type definitions shared by action, adapter, synthesis, validation, and report modules.
- [x] Add CLI help tests and option parsing tests.

Recommended module targets:

- `src/cli/actions/markdown/pdf-template-codex.ts`
- `src/cli/markdown-pdf/template-codex/types.ts`
- `src/cli/markdown-pdf/template-codex/options.ts`

### Phase 2: Signal Collection And Classification

- [x] Reuse or extract existing Markdown document signal collectors from profile-Codex where appropriate.
- [x] Collect document title/frontmatter, heading, ToC pressure, table pressure, code-block, language, duplicate-title, and asset-count signals.
- [x] Load and summarize `--base-profile` as a profile signal and compatibility target.
- [x] Normalize recipe flag signals and preserve explicit flag precedence over profile recipe fields.
- [x] Collect bounded font summary and repeatable font hints.
- [x] Validate `--cover-image` format and locality before Codex.
- [x] Collect cover image dimensions, aspect ratio, orientation bucket, and fit-pressure summary when practical.
- [x] Classify low-signal, deterministic, Codex-assisted, and no-usable-template paths.
- [x] Ensure no-signal runs fail before deriving default output directories.
- [x] Add tests for signal classification, path alias conflicts, invalid profile rejection, invalid cover image rejection, and no-signal behavior.

Recommended module targets:

- `src/cli/markdown-pdf/template-codex/signals.ts`
- `src/cli/markdown-pdf/template-codex/cover-assets.ts`
- `src/cli/markdown-pdf/template-codex/signal-mode.ts`

### Phase 3: Output Planning, Identity, And Collision Checks

- [x] Generate template bundle IDs in the `md-pdf-template-YYYYMMDDTHHMMSSZ-xxxxxxxx` format.
- [x] Resolve explicit `--output <directory>` with `md pdf-template init` directory semantics.
- [x] Derive generated default output directories only after signal classification allows the command to proceed.
- [x] Implement bounded collision retries for generated output directories.
- [x] Enforce non-empty output directory failure unless `--overwrite` is passed.
- [x] Ensure `--overwrite` replaces only selected generated files.
- [x] Ensure existing `template.html`, `style.css`, and asset files in `--output` are never read as input signals, merge bases, or refinement sources.
- [x] Reject source/sink collisions across input Markdown, base profile, output directory, report output, and managed asset sources.
- [x] Plan copied asset target paths inside `assets/` with collision-safe filenames.
- [x] Add tests for generated output paths, explicit output paths, overwrite behavior, unrelated-file preservation, and collision failures.

Recommended module targets:

- `src/cli/markdown-pdf/template-codex/identity.ts`
- `src/cli/markdown-pdf/template-codex/output-plan.ts`
- `src/cli/markdown-pdf/template-codex/path-collisions.ts`

### Phase 3.1: Test Modularization And Refactor Baseline

This phase is refactor-only. It should preserve existing behavior while making
the completed Phase 1-3 coverage easier to extend before Phase 4 adds template
family and synthesis tests.

- [x] Create a job record for the test modularization refactor.
- [x] Split `test/cli-actions-md-to-pdf-template-codex.test.ts` by
  implementation layer instead of continuing to grow one large file.
- [x] Extract shared template-Codex binary/image fixture helpers and small path
  helpers into a focused helper module.
- [x] Keep existing test names and assertions semantically equivalent unless a
  rename is needed to clarify the new file boundary.
- [x] Record that new Phase 4-8 tests should use focused template-Codex files
  instead of appending unrelated coverage to a single catch-all file.
- [x] Run maintainability and test coverage review on the refactor commit range
  before moving to Phase 4.

Recommended test targets:

- `test/cli-actions-md-to-pdf-template-codex/command-state.test.ts`
- `test/cli-actions-md-to-pdf-template-codex/signal-mode.test.ts`
- `test/cli-actions-md-to-pdf-template-codex/signal-collection.test.ts`
- `test/cli-actions-md-to-pdf-template-codex/image-metadata.test.ts`
- `test/cli-actions-md-to-pdf-template-codex/output-paths.test.ts`
- `test/cli-actions-md-to-pdf-template-codex/output-directory.test.ts`
- `test/cli-actions-md-to-pdf-template-codex/output-targets.test.ts`
- `test/cli-actions-md-to-pdf-template-codex/output-collisions.test.ts`
- `test/cli-actions-md-to-pdf-template-codex/action.test.ts`
- `test/cli-actions-md-to-pdf-template-codex/fixtures.ts`

Verification:

```bash
bun test test/cli-actions-md-to-pdf-template-codex/*.test.ts test/cli-actions-md-to-pdf-commands.test.ts
bunx tsc --noEmit
bun run format:check
bun run lint
bun run build
git diff --check
bun test --timeout 30000
```

### Phase 4: Deterministic Template Families And Synthesis

- [x] Add repo-owned boilerplate for `document-layered`.
- [x] Add repo-owned boilerplate for `cover-media-layered`.
- [x] Preserve `$body$`, title metadata hooks, conditional ToC placeholders, `#TOC`, cover/page-chrome hooks, and Shiki code selectors.
- [x] Resolve `recipe_preset` from explicit recipe flags, profile preset identity, or default renderer behavior.
- [x] Implement deterministic slot defaults for cover, tables, code, spacing, typography, and color tokens.
- [x] Implement deterministic `--base-profile` only synthesis.
- [x] Implement deterministic recipe-flags-only synthesis.
- [x] Implement deterministic `--cover-image` only synthesis with conservative contained cover layout.
- [x] Map `image_fit: contain` and `image_fit: cover` to deterministic page-relative CSS sizing rules.
- [x] Ensure generated cover-media CSS never uses source pixel dimensions as rendered width or height.
- [x] Write template identity comments into `template.html` and `style.css`.
- [x] Add unit tests for both template families and deterministic signal-ladder rows.

Job record:

- `docs/plans/jobs/2026-06-23-markdown-pdf-template-codex-phase-4-deterministic-synthesis.md`

Recommended module targets:

- `src/cli/markdown-pdf/template-codex/families.ts`
- `src/cli/markdown-pdf/template-codex/slots.ts`
- `src/cli/markdown-pdf/template-codex/synthesize-template.ts`
- `src/cli/markdown-pdf/template-codex/synthesize-css.ts`

### Phase 5: Codex Adapter And Strict Decision Schema

- [x] Add Markdown PDF template prompt construction under the existing Codex adapter boundary.
- [x] Include supported template families, recipe presets, slot enums, asset summaries, asset sizing signals, and hook requirements in bounded prompt facts.
- [x] Define strict structured-output schema for template decisions.
- [x] Require all schema properties needed by the Codex structured-output API.
- [x] Parse decision mode, template family, recipe preset, slots, CSS blocks, managed assets, warnings, unsupported directions, and fallback reason.
- [x] Validate enum domains before synthesis.
- [x] Validate managed asset references against the output plan.
- [x] Validate that Codex decisions use bounded image-fit slots instead of raw pixel sizing directives.
- [x] Validate optional CSS blocks for slot ownership, size limits, remote URLs, absolute local paths, and required selector preservation.
- [x] Implement unavailable Codex and invalid structured-output handling as `no-usable-template`.
- [x] Add adapter unit tests with stubs for adapted, conservative fallback, invalid structured output, unavailable Codex, and unsafe CSS block cases.

Job record:

- `docs/plans/jobs/2026-06-23-markdown-pdf-template-codex-phase-5-adapter-schema.md`

Recommended module targets:

- `src/adapters/codex/markdown-pdf-template/`
- `src/cli/markdown-pdf/template-codex/codex-decision.ts`
- `src/cli/markdown-pdf/template-codex/css-blocks.ts`

### Phase 6: Static Validation And Managed Asset Writes

- [x] Add static template-contract validation.
- [x] Validate required Pandoc placeholders and ToC regions.
- [x] Validate profile/render hook preservation for cover, page chrome, and Shiki code selectors.
- [x] Reject absolute local paths and remote URLs in generated HTML/CSS.
- [x] Ensure all generated files and copied assets stay inside the output directory.
- [x] Copy accepted cover images into `assets/` during normal execution.
- [x] Skip recipe file writes and asset copies during `--dry-run`.
- [x] Support requested failure reports without writing recipe files on `no-usable-template`.
- [x] Add tests for hard validation failures, fallback-compatible reductions, copied assets, dry-run behavior, and output-boundary checks.

Job record:

- `docs/plans/jobs/2026-06-23-markdown-pdf-template-codex-phase-6-static-validation-managed-asset-writes.md`

Recommended module targets:

- `src/cli/markdown-pdf/template-codex/validate-template.ts`
- `src/cli/markdown-pdf/template-codex/write-bundle.ts`
- `src/cli/markdown-pdf/template-codex/asset-copy.ts`

### Phase 7: Diagnostic Report And CLI Summary

- [ ] Define the `markdown-pdf-codex-template-report` JSON shape.
- [ ] Link report ID and template bundle ID.
- [ ] Redact source paths for managed assets.
- [ ] Record bundle-relative asset paths, formats, dimensions, and source basenames.
- [ ] Record signal mode, decision mode, template family, recipe preset, base-profile summary, recipe signal, warnings, unsupported directions, validation results, and follow-up render command.
- [ ] Support `--keep-codex-report` default in-bundle report path.
- [ ] Support explicit `--codex-report-output <path>`.
- [ ] Allow report-only writes during dry-run or failure only when explicitly requested.
- [ ] Print a concise summary for successful and fallback decisions.
- [ ] Add report schema, redaction, explicit path, default path, and CLI summary tests.

Recommended module targets:

- `src/cli/markdown-pdf/template-codex/report.ts`
- `src/cli/markdown-pdf/template-codex/summary.ts`

### Phase 8: Integration Coverage And Render Compatibility

- [ ] Add action-level tests for deterministic paths.
- [ ] Add action-level tests for Codex-assisted paths with stubbed adapter responses.
- [ ] Add action-level tests for `no-usable-template` and requested failure reports.
- [ ] Add tests that generated template artifacts can flow into `md to-pdf --template --css` with Pandoc and WeasyPrint mocked or covered by existing fixture seams.
- [ ] Add committed synthetic cover fixtures for PNG, JPEG, and WebP.
- [ ] Add coverage for oversized cover images scaling down through deterministic `contain` CSS.
- [ ] Add coverage that explicit `cover` fit can crop only through bounded slot selection, not raw pixel sizing.
- [ ] Add rejection fixtures for unsupported cover-image formats.
- [ ] Add artifact-safe smoke commands under `examples/playground/` only when manual visual review artifacts are needed.
- [ ] Ensure generated smoke artifacts are cleaned before commit.
- [ ] Run focused test files first, then repo gates.

Focused validation target:

```bash
bun test test/cli-actions-md-to-pdf-template-codex-action.test.ts test/cli-actions-md-to-pdf-template.test.ts test/cli-actions-md-to-pdf-commands.test.ts
```

Repo gates:

```bash
bun run lint
bun run format:check
bun run build
bun test
git diff --check
```

### Phase 9: Documentation And Release Boundary

- [ ] Update Markdown PDF guide docs with the accepted direct template-Codex workflow.
- [ ] Document layered render as the default follow-up path.
- [ ] Document `--no-default-css` as an advanced self-contained posture.
- [ ] Document cover-image support and unsupported media formats.
- [ ] Document redacted report behavior without exposing local source paths.
- [ ] Keep `v0.1.5-canary.3` wording accurate until the implementation is verified and tagged.
- [ ] Add implementation job records under `docs/plans/jobs/` as phases land.
- [ ] Link completed job records back to this plan.
- [ ] Update related research status only after implementation evidence exists.

## Out Of Scope

- rendering the PDF automatically inside `md pdf-template codex`
- hybrid one-shot helper orchestration
- Interactive Markdown PDF mode
- existing template refinement from a user-supplied `template.html` or `style.css`
- reading existing files from `--output` as template inputs, merge bases, or refinement sources
- remote asset fetching or download
- animated cover media
- SVG cover media
- profile schema changes for local cover images
- arbitrary full-file HTML/CSS generation by Codex
- mandatory template metadata files beyond identity comments

## Risks And Mitigations

| Risk | Mitigation |
| --- | --- |
| Codex returns useful but unsafe CSS | validate CSS blocks before synthesis; fail closed for remote URLs, absolute paths, and hook-breaking material |
| The helper drifts into raw file generation | keep Codex output to bounded decisions and slot CSS; deterministic code owns final files |
| Template files break later `md to-pdf` rendering | static validation for placeholders, ToC hooks, profile hooks, Shiki selectors, and output-boundary rules |
| Cover media leaks source paths | copy into bundle assets and persist only redacted source display, basename, format, dimensions, and bundle path |
| `--output` behavior becomes ambiguous | classify signals before deriving generated output; use `md pdf-template init` directory semantics for explicit output |
| Template family names blur with renderer presets | keep `template_family` and `recipe_preset` as separate enum domains |
| Docs overstate the canary state | keep release wording as planned/in-progress until implementation, verification, and tagging are complete |

## Related Research

- [Markdown PDF Template Codex Helper](../researches/research-2026-06-18-markdown-pdf-template-codex-helper.md)
- [Markdown PDF Codex Helper Roadmap](../researches/research-2026-06-10-markdown-pdf-codex-profile-and-interactive-flow.md)
- [Markdown to PDF with WeasyPrint](../researches/research-2026-05-06-markdown-to-pdf-weasyprint.md)
- [Markdown to PDF Profiles, Fonts, and Page Chrome](../researches/research-2026-05-07-markdown-to-pdf-profiles-fonts-and-page-chrome.md)
- [Markdown PDF Shiki Code Highlighting](../researches/research-2026-05-16-markdown-pdf-shiki-code-highlighting.md)

## Related Plans

- [Markdown PDF Codex profile helper implementation](plan-2026-06-15-markdown-pdf-codex-profile-helper.md)
