---
title: "Markdown PDF template Codex helper implementation"
created-date: 2026-06-23
modified-date: 2026-06-24
status: active
agent: codex
---

## Goal

Implement the direct `md pdf-template codex` helper for generating reviewable Markdown PDF template bundles from bounded document, profile-derived recipe, intent, font, and cover-media signals.

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
- recipe flags shared by `md pdf-template init` and `md to-pdf`: `--preset`, page shape, margins, `--toc`, `--toc-depth`, and `--toc-page-break`; these remain renderer/init controls, not the desired public surface for `md pdf-template codex`.
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

Do not add direct recipe flags to this public command surface. In particular,
`md pdf-template codex` should not accept `--preset`, `--page-size`,
`--orientation`, `--margin*`, `--toc`, `--toc-depth`, or `--toc-page-break` as
hidden or visible options. Detailed recipe control belongs to
`md pdf-template init`, reusable `--base-profile` inputs, or the later
`md to-pdf` render command.

Do not add narrow style flags just to expose prompt-internal categories. General direction stays in `--intent`; font preference stays in repeatable `--font-hint`; cover media uses explicit `--cover-image`.

### Signal Ladder

Classify command inputs before resolving generated default output directories:

| Inputs | Expected behavior |
| --- | --- |
| no input, no intent, no base profile, and no cover image | fail as too low-signal; recommend `md pdf-template init` for deterministic recipe-controlled templates |
| `--base-profile` only | deterministic `document-layered` snapshot from the profile; no Codex call |
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
- recipe-only deterministic templates should use `md pdf-template init` instead of `md pdf-template codex`.

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

Render-policy ownership should stay explicit. Profile-Codex and render-time
recipe sources own page size, orientation, margins, ToC behavior, page numbers,
and reusable render defaults by default. Template-Codex owns reviewable HTML/CSS
structure, local cover-image packaging, cover-media presentation, title
placement, table styling, and managed bundle assets. Strong document table
signals may influence a template-compatible `wide-table` recipe only when no
stronger profile or render-time recipe owner exists; weak table signals should
change table styling without forcing landscape.

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
- normalized recipe context from base-profile fields and renderer defaults
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
  - always use `md-pdf-template-<timestamp>-<uid>/`, regardless of input path
  - do not include the Markdown input stem, extension, or a fake `.pdf-template` extension in generated names
  - callers who want semantic bundle names should pass `--output <directory>`
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
- recipe context summary
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
| `deterministic` | no Codex required; base profile or cover image signals are enough | success | bundle unless `--dry-run`; optional report |
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
- [x] Add recipe flag parity with `md pdf-template init` during the initial implementation; superseded by Phase 8.1 command surface simplification.
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
- [x] Normalize recipe signals and preserve explicit flag precedence over profile recipe fields before Phase 8.1 removes the over-expanded public CLI recipe surface.
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
- [x] Resolve `recipe_preset` from recipe state, profile preset identity, or default renderer behavior.
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

- [x] Define the `markdown-pdf-codex-template-report` JSON shape.
- [x] Link report ID and template bundle ID.
- [x] Redact source paths for managed assets.
- [x] Record bundle-relative asset paths, formats, dimensions, and source basenames.
- [x] Record signal mode, decision mode, template family, recipe preset, base-profile summary, recipe signal, warnings, unsupported directions, validation results, and follow-up render command.
- [x] Support `--keep-codex-report` default in-bundle report path.
- [x] Support explicit `--codex-report-output <path>`.
- [x] Allow report-only writes during dry-run or failure only when explicitly requested.
- [x] Print a concise summary for successful and fallback decisions.
- [x] Add report schema, redaction, explicit path, default path, and CLI summary tests.

Job record:

- `docs/plans/jobs/2026-06-23-markdown-pdf-template-codex-phase-7-diagnostic-report-cli-summary.md`

Recommended module targets:

- `src/cli/markdown-pdf/template-codex/report.ts`
- `src/cli/markdown-pdf/template-codex/summary.ts`

### Phase 8: Integration Coverage And Render Compatibility

- [x] Add action-level tests for deterministic paths.
- [x] Add action-level tests for Codex-assisted paths with stubbed adapter responses.
- [x] Add action-level tests for `no-usable-template` and requested failure reports.
- [x] Add tests that generated template artifacts can flow into `md to-pdf --template --css` with Pandoc and WeasyPrint mocked or covered by existing fixture seams.
- [x] Add generated synthetic cover-byte coverage for PNG, JPEG, and WebP without committing playground image fixtures.
- [x] Add coverage for oversized cover images scaling down through deterministic `contain` CSS.
- [x] Add coverage that explicit `cover` fit can crop only through bounded slot selection, not raw pixel sizing.
- [x] Add rejection fixtures for unsupported cover-image formats.
- [x] Confirm no manual `examples/playground/` visual artifacts are needed for this phase.
- [x] Ensure generated smoke artifacts are cleaned before commit.
- [x] Run focused test files first, then repo gates.

Job record:

- `docs/plans/jobs/2026-06-23-markdown-pdf-template-codex-phase-8-integration-render-compatibility.md`

Focused validation target:

```bash
bun test test/cli-actions-md-to-pdf-template-codex/*.test.ts test/adapters-codex-markdown-pdf-template.test.ts test/cli-actions-md-to-pdf-actions.test.ts test/cli-actions-md-to-pdf-commands.test.ts
```

Repo gates:

```bash
bunx tsc --noEmit
bun run lint
bun run format:check
bun run build
bun test --timeout 30000
git diff --check
```

### Phase 8.1: Command Surface Simplification

This phase intentionally reduces complexity added earlier in the implementation.
The current public `md pdf-template codex --help` surface exposes recipe flags
that make the command look like `md pdf-template init` plus Codex. The revised
direction is to keep `md pdf-template codex` close to `md pdf-profile codex`:
bounded Codex/template signals, output/report controls, and no hidden accepted
recipe flags.

- [x] Remove recipe flags from `md pdf-template codex` CLI registration:
      `--preset`, `--page-size`, `--orientation`, `--margin*`, `--toc`,
      `--toc-depth`, and `--toc-page-break`.
- [x] Do not keep hidden compatibility for removed recipe flags.
- [x] Keep internal/action recipe support only where it is still needed for
      base-profile-derived signals, renderer defaults, and deterministic
      synthesis seams.
- [x] Add one focused command-layer test proving representative removed flags
      now fail as unknown options.
- [x] Prune obsolete command-layer pass-through tests for removed recipe flags
      instead of expanding redundant coverage.
- [x] Keep or adjust tests for supported public signals: input, intent, font
      hints, base profile, cover image, output, dry-run, report, and overwrite.
- [x] Verify `md pdf-template init` remains the direct recipe-control command.
- [x] Update help-output expectations to show the simplified command surface.
- [x] Add a job record that documents the sequence: compare current help to
      `md pdf-profile codex`, classify recipe flags as over-expanded public
      surface, remove public flags without hiding them, prove representative
      removed flags reject, prune obsolete tests, verify simplified help, and
      run gates.

Job record:

- `docs/plans/jobs/2026-06-23-markdown-pdf-template-codex-phase-8-1-command-surface-simplification.md`

Focused validation target:

```bash
bun test test/cli-actions-md-to-pdf-template-codex/*.test.ts test/cli-actions-md-to-pdf-commands.test.ts
```

Repo gates:

```bash
bunx tsc --noEmit
bun run lint
bun run format:check
bun run build
bun test --timeout 30000
git diff --check
```

### Phase 8.2: Codex Progress Feedback

This phase restores runtime feedback parity with `md pdf-profile codex`.
`md pdf-template codex` can spend visible time waiting on a Codex-assisted
template decision, but the current action calls the template Codex adapter
without the existing progress wrapper. The refinement should reuse the shared
direct-Codex progress helper instead of introducing a second spinner or status
implementation.

- [x] Add Codex progress feedback for `md pdf-template codex` only when
      `signals.signalMode` is `codex-assisted`.
- [x] Reuse `startDirectCodexProgress` with a template-specific label such as
      `Requesting Codex Markdown PDF template recommendation`.
- [x] Preserve deterministic paths without Codex progress output.
- [x] Preserve non-TTY behavior as a stable one-line request message.
- [x] Stop TTY progress with `done` for adapted decisions.
- [x] Stop TTY progress with `fallback` for conservative fallback decisions.
- [x] Stop TTY progress with `error` for `no-usable-template` decisions and
      thrown adapter errors.
- [x] Ensure progress cleanup happens exactly once through success, fallback,
      no-usable-template, and thrown-error paths.
- [x] Add action-level tests mirroring the existing
      `md pdf-profile codex` progress coverage.
- [x] Record the implementation sequence in a Phase 8.2 job record:
      compare profile progress behavior, apply the shared helper to template,
      prove deterministic paths stay quiet, verify TTY/non-TTY behavior, run
      gates, and review the phase commit range.

Job record:

- `docs/plans/jobs/2026-06-24-markdown-pdf-template-codex-phase-8-2-progress-feedback.md`

Focused validation target:

```bash
bun test test/cli-actions-md-to-pdf-template-codex/*.test.ts test/cli-actions-md-to-pdf-profile-codex-action.test.ts test/cli-actions-md-to-pdf-commands.test.ts
```

Repo gates:

```bash
bunx tsc --noEmit
bun run lint
bun run format:check
bun run build
bun test --timeout 30000
git diff --check
```

### Phase 8.3: Render-Time Bundle Asset And Cover CSS Compatibility

This phase fixes renderer compatibility gaps found by rendering a generated
cover-media template bundle through `md to-pdf`. The generated bundle copied the
cover image into `assets/`, but `md to-pdf` resolved the template-relative
`assets/...` URL against the Markdown input directory. The same smoke also
showed Template-Codex cover CSS using viewport units (`100vh`, `68vh`, `76vh`)
that WeasyPrint rejects in this paged-media path.

- [x] Replace Template-Codex cover-media viewport units with paged-media-safe
      definite sizing derived from normalized page size and orientation.
- [x] Reuse or mirror the renderer-safe cover sizing policy already applied to
      Markdown PDF profile cover CSS.
- [x] Ensure `contain` and `cover` image-fit slots still scale oversized cover
      images through bounded page-relative rules, not source pixel dimensions.
- [x] Teach `md to-pdf` custom-template rendering to resolve bundle-local
      relative HTML asset URLs beside the custom template when those assets
      exist there.
- [x] Preserve Markdown-input-relative asset resolution for normal Markdown
      body images and existing render behavior.
- [x] Keep remote assets disabled by default and keep absolute/local path
      hygiene unchanged.
- [x] Add regression coverage proving generated Template-Codex cover CSS does
      not emit `vh` units.
- [x] Add render compatibility coverage where `template.html` references
      `assets/cover.png`, the asset exists only beside the custom template, and
      the render path does not resolve it from the Markdown input directory.
- [x] Add coverage for the fallback case where a relative asset is genuinely
      Markdown-input-relative and should not be rewritten to the template
      bundle.
- [x] Record the implementation sequence in a Phase 8.3 job record:
      reproduce the warning/missing-asset cause, fix cover CSS sizing, fix
      bundle-local asset resolution, verify focused render coverage, run gates,
      and review the phase commit range.

Job record:

- `docs/plans/jobs/2026-06-24-markdown-pdf-template-codex-phase-8-3-render-asset-compatibility.md`

Focused validation target:

```bash
bun test test/cli-actions-md-to-pdf-template-codex/*.test.ts test/cli-actions-md-to-pdf-actions*.test.ts test/cli-actions-md-to-pdf-commands.test.ts
```

Repo gates:

```bash
bunx tsc --noEmit
bun run lint
bun run format:check
bun run build
bun test --timeout 30000
git diff --check
```

### Phase 8.4: Template Font Hint Materialization

This phase makes `--font-hint` materially useful for `md pdf-template codex`.
The command already accepts, normalizes, reports, and forwards font hints to the
template Codex prompt, but current template synthesis still writes fixed
default font stacks. Unlike `md pdf-profile codex`, there is no bounded template
decision field that can turn font preferences into durable generated CSS.

Use a flexible ownership rule to avoid surprising conflicts with render-time
profiles:

1. concrete base/render profile font choices outrank loose `--font-hint`
   preferences.
2. `--font-hint` can become template CSS when no concrete profile font source
   owns that role.
3. a validated bounded template font decision can intentionally override a
   profile font role, but the diagnostic report must make that override
   explicit and reviewable.

- [x] Define bounded template font decision fields or theme-token overrides for
      body, heading, and code font roles.
- [x] Keep font output deterministic and schema-owned; do not allow arbitrary
      font CSS blocks or raw full-file CSS generation.
- [x] Preserve `--base-profile` font precedence as the strongest concrete font
      source when a base profile is supplied.
- [x] Use loose `--font-hint` as a weaker preference signal than concrete
      profile fonts.
- [x] Allow `--font-hint` to materialize into template CSS when no concrete
      profile font source owns the selected font role.
- [x] Allow an explicit validated template font decision to override a profile
      font role only when the decision records template-level ownership.
- [x] Materialize accepted template font decisions into generated CSS variables
      such as `--template-body-font`, `--template-heading-font`, and
      `--template-monospace-font`.
- [x] Validate font role domains, non-empty font family strings, and CSS string
      escaping before writing generated styles.
- [x] Keep deterministic no-Codex paths stable unless they have base-profile
      font signals that can be safely mirrored into template theme tokens.
- [x] Record font hints, accepted template font decisions, and whether each
      accepted decision overrides a concrete profile font in the diagnostic
      report without exposing local font file paths.
- [x] Add adapter tests proving font hints are visible to Codex and bounded
      font decisions are accepted or rejected correctly.
- [x] Add synthesis/action tests proving font hints can change generated
      template CSS through bounded decisions, not only prompt text.
- [x] Add precedence tests proving loose font hints do not silently override
      base-profile fonts.
- [x] Add override tests proving explicit template-level font decisions can
      override profile fonts only through the bounded, reported path.
- [x] Add tests proving blank-only font hints remain ignored.
- [x] Record the implementation sequence in a Phase 8.4 job record:
      compare profile-Codex font patch behavior, define template font slots,
      encode the flexible profile-vs-template font ownership rule,
      validate/materialize accepted decisions, update reports, verify focused
      coverage, run gates, and review the phase commit range.

Job record:

- `docs/plans/jobs/2026-06-24-markdown-pdf-template-codex-phase-8-4-font-hint-materialization.md`

Focused validation target:

```bash
bun test test/cli-actions-md-to-pdf-template-codex/*.test.ts test/adapters-codex-markdown-pdf-template.test.ts test/cli-actions-md-to-pdf-profile-codex-action.test.ts test/adapters-codex-markdown-pdf-profile.test.ts
```

Repo gates:

```bash
bunx tsc --noEmit
bun run lint
bun run format:check
bun run build
bun test --timeout 30000
git diff --check
```

### Phase 8.5: Profile Policy Parity For Layout And Title Signals

This phase closes the remaining parity gap between `md pdf-profile codex` and
`md pdf-template codex` for document-informed layout and title decisions. The
ownership model is intentionally asymmetric: profile-Codex remains the stronger
route for page-number and reusable page/render policy, while template-Codex
remains the stronger route for local cover-image bundles, custom cover
composition, title placement, and table styling.

- [x] Reuse or mirror the profile-Codex table layout signal ladder for template
      decisions, including scanned row count, overflow rows, maximum line width,
      and maximum column count.
- [x] Treat strong wide-table document signals as permission to choose
      `recipe_preset: wide-table` and landscape-compatible synthesis only when
      no stronger base-profile or render-time recipe owner exists.
- [x] Keep weak table signals from forcing landscape; use them only for bounded
      table-density and styling slots.
- [x] Preserve explicit/base-profile page shape and recipe settings over
      document-derived template layout suggestions.
- [x] Keep page numbers profile-owned by default; do not add template
      page-number margin boxes unless a future bounded page-chrome ownership
      path is explicitly designed.
- [x] Port or mirror the profile title decision policy so duplicate frontmatter
      `title` and first `H1` values do not produce duplicate visible titles in
      custom template output.
- [x] Define cover-title ownership: when the cover slot owns visible title
      placement, suppress the separate metadata title block that would duplicate
      the same title; do not mutate the Markdown body or frontmatter.
- [x] Record layout/title ownership decisions and any suppressed duplicate
      title behavior in the diagnostic report without exposing local paths.
- [x] Add tests for strong wide-table input choosing wide-table/landscape only
      when no profile or render-time owner blocks it.
- [x] Add tests for weak table input not forcing landscape.
- [x] Add precedence tests proving base-profile recipe/page settings win over
      document table signals.
- [x] Add duplicate-title tests covering frontmatter `title` plus matching first
      `H1`, including cover-title placement.
- [x] Add `md to-pdf` compatibility coverage for template/profile combinations
      where page settings and page numbers must remain profile-owned.
- [x] Run a privacy-safe manual `--font-hint` smoke with a playground CJK sample
      and record only the sanitized outcome, not local font/resource names,
      absolute paths, raw report content, or generated bundle names.
- [x] Record the implementation sequence in a Phase 8.5 job record: compare
      profile-Codex policies, encode ownership boundaries, implement layout and
      title parity, update reports, run the privacy-safe `--font-hint` smoke,
      verify focused coverage, run gates, and review the phase commit range.

Job record:

- `docs/plans/jobs/2026-06-24-markdown-pdf-template-codex-phase-8-5-profile-policy-parity-layout-title.md`

Focused validation target:

```bash
bun test test/cli-actions-md-to-pdf-template-codex/*.test.ts test/adapters-codex-markdown-pdf-template.test.ts test/cli-actions-md-to-pdf-actions*.test.ts test/cli-actions-md-to-pdf-profile-codex-action.test.ts test/adapters-codex-markdown-pdf-profile.test.ts
```

Manual smoke target:

```bash
bun run build
node dist/esm/bin.mjs md pdf-template codex examples/playground/md-pdf/cjk-font-smoke.md --font-hint "<reviewed local CJK font preference>" --dry-run
```

Record this smoke as a sanitized outcome only. Do not persist exact local font
names, absolute local paths, raw diagnostic report content, or generated bundle
names in the job record.

Repo gates:

```bash
bunx tsc --noEmit
bun run lint
bun run format:check
bun run build
bun test --timeout 30000
git diff --check
```

### Phase 8.6: Generated Bundle Naming Cleanup

This phase removes the noisy input-derived generated bundle name. Default
generated directories should be short, generic, collision-safe artifact IDs;
semantic naming belongs to explicit `--output`.

- [x] Change omitted-output planning to always generate
      `md-pdf-template-<timestamp>-<uid>/`; keep explicit `--output` unchanged.
- [x] Remove the current input-derived `.pdf-template-<bundle-id>` composition
      so generated names do not include Markdown stems, extensions, or duplicated
      `pdf-template` wording.
- [x] Preserve bounded collision retries for generated defaults.
- [x] Update output-path/action/report tests, including a regression proving
      `README.md` does not produce an input-derived generated directory name.
- [ ] Record the implementation sequence in a Phase 8.6 job record, run focused
      output-path coverage, run repo gates, and review the phase commit range.

Job record:

- `docs/plans/jobs/2026-06-24-markdown-pdf-template-codex-phase-8-6-generated-bundle-naming.md`

Focused validation target:

```bash
bun test test/cli-actions-md-to-pdf-template-codex/output-paths.test.ts test/cli-actions-md-to-pdf-template-codex/action.test.ts test/cli-actions-md-to-pdf-template-codex/output-directory.test.ts test/cli-actions-md-to-pdf-template-codex/output-collisions.test.ts test/cli-actions-md-to-pdf-commands.test.ts
```

### Phase 8.7: Template Font Contract And Live Font-Hint Smoke

This phase keeps `--font-hint` as a supported Template-Codex signal, but treats
the current role-only font contract as incomplete. Rework the bounded font
contract first, then use diagnostics and live smoke to prove the contract returns
an inspectable result. Do not split this into more phase sections unless the live
review exposes a clearly separate scope.

- [ ] Rework Template-Codex `font_decisions` from role-only decisions to a
      profile-aligned role/key contract where practical: `body.default`,
      `body.<language-tag>`, `code.default`, `code.symbols`, and
      `heading.default`.
- [ ] Validate role/key combinations locally: body keys accept `default` or valid
      language tags, code accepts `default` or `symbols`, and heading accepts
      only `default`.
- [ ] Synthesize bounded CSS from the role/key contract: global fallback stacks
      from `body.default` and `pdf.content-langs`, `:lang(...)` rules for valid
      language-keyed body decisions, and code symbol fallbacks for code selectors.
- [ ] Keep language semantics honest: `pdf.content-langs` is expected coverage,
      not precise text labeling; exact targeting depends on rendered `lang`
      attributes such as Pandoc spans, and Template-Codex must not rewrite
      Markdown to add labels.
- [ ] Preserve sanitized classified Template-Codex runner failures instead of
      collapsing all failures to `Codex template decision unavailable`; compare
      categories with profile-Codex and add adapter/action tests for reportable,
      path-safe failures.
- [ ] Run the live smoke matrix: Template-Codex without `--font-hint`,
      Template-Codex with the sanitized CJK `--font-hint`, and profile-Codex as a
      control only when Template-Codex diagnostics are ambiguous.
- [ ] Complete the phase only when Template-Codex `--font-hint` returns a real
      successful Codex signal and an inspectable result: a generated template
      bundle plus requested diagnostic report whose summary/report show bounded
      font decisions rather than the generic unavailable fallback.
- [ ] If live smoke exposes a bounded contract bug, fix it inside Phase 8.7, add
      regression coverage, and rerun the matrix until the inspectable-success
      criterion is satisfied.
- [ ] Record only sanitized smoke outcomes in the Phase 8.7 job record, run
      focused coverage, run repo gates, and review the phase commit range.

Focused validation target:

```bash
bun test test/adapters-codex-markdown-pdf-template.test.ts test/cli-actions-md-to-pdf-template-codex/*.test.ts test/cli-actions-md-to-pdf-profile-codex-action.test.ts test/adapters-codex-markdown-pdf-profile.test.ts
```

Manual smoke matrix:

```bash
bun run build
node dist/esm/bin.mjs md pdf-template codex examples/playground/md-pdf/cjk-font-smoke.md --dry-run
node dist/esm/bin.mjs md pdf-template codex examples/playground/md-pdf/cjk-font-smoke.md --font-hint "<sanitized CJK-compatible font preference>" --dry-run
node dist/esm/bin.mjs md pdf-template codex examples/playground/md-pdf/cjk-font-smoke.md --font-hint "<sanitized CJK-compatible font preference>" --output "<playground smoke output directory>" --keep-codex-report --overwrite
node dist/esm/bin.mjs md pdf-profile codex examples/playground/md-pdf/cjk-font-smoke.md --font-hint "<same sanitized CJK-compatible font preference>" --dry-run
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
