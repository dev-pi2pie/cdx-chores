---
title: "Markdown PDF Template Codex Helper"
created-date: 2026-06-18
modified-date: 2026-06-24
status: in-progress
agent: codex
---

## Goal

Define the direct `md pdf-template codex` helper for the current canary target, `v0.1.5-canary.3`.

The helper should draft reviewable Markdown PDF template artifacts for layout, cover media, and HTML/CSS-backed directions that `md pdf-profile codex` intentionally rejects.

## Milestone Goal

`v0.1.5-canary.3` should not be tagged until the template-Codex route is implemented, verified, and documented, or until a separate release decision records why it moved out of the canary.

The previous canary, `v0.1.5-canary.2`, completed the direct `md pdf-profile codex` helper. That profile helper remains the quick durable configuration path. This research owns the next layer: template-backed rendering artifacts.

## Relationship To Roadmap

The parent roadmap is [Markdown PDF Codex Helper Roadmap](research-2026-06-10-markdown-pdf-codex-profile-and-interactive-flow.md).

That roadmap keeps the settled profile-Codex history and the overall sequence:

```text
profile-Codex
  -> template-Codex
  -> hybrid one-shot helper
  -> Interactive mode
```

This document should stay focused on the second layer only: `md pdf-template codex`.

## Starting State

Current deterministic Markdown PDF support already has the pieces that a template helper can build on:

- `md to-pdf` renders Markdown through Pandoc-generated HTML and WeasyPrint.
- `md pdf-template init --output <directory>` writes `template.html` and `style.css`.
- `md pdf-template init` already accepts the same recipe flags as `md to-pdf`: `--preset`, page shape, margins, `--toc`, `--toc-depth`, and `--toc-page-break`.
- `md to-pdf` accepts `--template <path>` and `--css <path>`.
- `md to-pdf` can combine `--profile`, `--template`, and `--css`.
- custom `--template` replaces the generated template HTML.
- custom `--css` is loaded after generated CSS unless `--no-default-css` removes the generated CSS layer.
- `md pdf-profile codex` records template-only requests as unsupported profile directions instead of inventing raw HTML/CSS fields.

The current gap is not renderer capability. The gap is a reviewable assistant contract for the HTML/CSS recipe layer.

## Scope

This research covers:

- the direct `md pdf-template codex` command boundary
- document, profile, intent, font, and asset signals for template drafting
- output directory shape for `template.html`, `style.css`, managed assets, and optional diagnostics
- how template-Codex should relate to `--profile`, `--template`, `--css`, and `--no-default-css`
- local cover image and cover-media handling
- artifact review, dry-run, overwrite, and collision behavior
- Codex output shape: raw files versus bounded template decisions
- optional diagnostic report behavior

This research does not implement:

- command wiring
- Codex SDK calls
- renderer changes
- profile schema changes for cover images
- hybrid one-shot orchestration
- Interactive mode

## Settled V1 Direction

Use the existing command vocabulary where it already fits:

- `md pdf-template codex` is a direct, scriptable command.
- `-o, --output <directory>` means the template bundle directory when provided, matching `md pdf-template init`.
- when `--output` is omitted, v1 should generate a readable, non-colliding default bundle directory using the same Codex-helper posture as `md pdf-profile codex`, but only after the command has enough signal to proceed.
- the public `md pdf-template codex` command surface should stay close to `md pdf-profile codex`: bounded Codex/template signals, output/report controls, and no direct render-recipe flag surface.
- recipe controls should not be hidden or secretly accepted by this command. Detailed page shape, preset, margin, and ToC controls belong to `md pdf-template init`, reusable `--base-profile` inputs, or the later `md to-pdf` render command.
- the ownership split should stay explicit: profile-Codex is the stronger route for page and render policy such as page size, orientation, margins, ToC, page numbers, reusable font defaults, and preset-backed recipes; template-Codex is the stronger route for reviewable HTML/CSS structure, visual treatment, local cover-image packaging, and managed bundle assets.
- table pressure can influence both helpers, but with different authority. Profile-Codex may turn strong wide-table signals into profile recipe settings. Template-Codex may adapt table styling and may choose a wide-table-compatible recipe only when no stronger profile or render-time recipe owner exists.
- page numbers should remain profile-owned by default. Template-Codex should not emit template page-number chrome unless a later phase adds explicit bounded template-level ownership and conflict reporting.
- `[input]` plus `-i, --input <path>` should mirror the profile-Codex alias pattern.
- `--base-profile <path>` is an optional signal and compatibility target, not the output target.
- `--cover-image <path>` should be singular in v1. Repeated media inputs can wait until the asset model proves out.
- `--cover-image <path>` should accept local still raster PNG, JPEG, and WebP files only in v1.
- local cover images should be resolved from the CLI working directory unless absolute, copied into `assets/` by default, and referenced with bundle-relative paths.
- remote asset fetching is out of scope for v1.
- the custom template bundle is the command output. The effective output directory comes from `--output <directory>` or from a generated default, and the v1 helper should generate that bundle from deterministic template families, profile-derived recipe signals, document signals, intent/font signals, and managed cover assets.
- Codex should return bounded template decisions plus optional bounded CSS blocks; deterministic code should synthesize required HTML/CSS boilerplate and required hooks.

## Processing Model

Template-Codex should behave like a reviewable artifact compiler. The command collects bounded signals, decides whether Codex is needed, validates a bounded response, and writes a deterministic bundle.

```text
CLI input
  |
  |-- [input] / --input <path>
  |-- --intent <text>
  |-- --font-hint <text>...
  |-- --base-profile <path>
  |-- --cover-image <path>
  |-- --output <directory>, optional explicit bundle path
  |
  v
Normalize and validate command state
  |
  |-- resolve paths relative to cwd
  |-- validate explicit output/report/asset paths when provided
  |-- validate base profile if present
  |-- inspect cover-image metadata if present
  |
  v
Collect signals
  |
  |-- user intent signal
  |     free-form design/layout direction
  |
  |-- document signal
  |     title/frontmatter, headings, ToC pressure, table pressure,
  |     code-block pressure, language hints, duplicate title risk
  |
  |-- profile signal
  |     metadata, page shape, ToC, cover fields, page chrome,
  |     fonts, code highlighting, preset identity
  |
  |-- recipe signal
  |     base-profile recipe fields and renderer defaults used as bounded synthesis context
  |
  |-- asset signal
  |     local cover-image path, safe copied filename, relative bundle target
  |
  |-- escalation signal
  |     unmatched profile-Codex directions that need template/CSS work
  |
  v
Classify signal mode
  |
  |-- no target signals
  |     -> reject before deriving a default output directory;
  |        use md pdf-template init
  |
  |-- base profile only or cover-image only
  |     -> deterministic template decision
  |
  |-- intent, Markdown document signals, or unmatched template directions
  |     -> Codex-assisted template decision
  |
  v
Resolve effective output directory
  |
  |-- use --output when provided
  |-- otherwise derive a non-colliding default output directory
  |-- reject conflicting input/output/report/asset paths
  |
  v
Codex request envelope, only when needed
  |
  |-- supported template families, recipe presets, and bounded slots
  |-- summarized/redacted document signals
  |-- normalized profile and recipe signals
  |-- managed asset summaries, not raw copied bytes
  |-- later-render template placeholders, profile hooks, and Shiki hooks
  |-- disallowed behavior: remote URLs, absolute local paths,
  |   missing template-contract placeholders, arbitrary extra files
  |
  v
Codex bounded response
  |
  |-- decision mode
  |-- selected template family
  |-- recipe preset
  |-- cover/table/spacing/type/code slot decisions
  |-- managed asset usage
  |-- optional bounded CSS blocks
  |-- warnings and unsupported directions
  |
  v
Deterministic synthesis and validation
  |
  |-- create template.html from repo-owned boilerplate and slots
  |-- create style.css from repo-owned base rules and bounded CSS blocks
  |-- copy local assets into assets/
  |-- validate template contract, path hygiene, and asset references
  |
  v
Artifacts
  |
  |-- template.html
  |-- style.css
  |-- assets/...
  |-- template.codex-report.json, only when requested
```

The important boundary is that Codex recollects and interprets signals inside a constrained request envelope, but it does not own the final write operation. The deterministic writer owns file paths, boilerplate, required hooks, copied assets, report placement, and validation.

## Key Findings

### 1. Template-Codex should write artifacts, not hide generated HTML/CSS

`md to-pdf` should remain deterministic. Codex may help draft files, but rendering should consume accepted files.

Recommended flow:

```bash
cdx-chores md pdf-template codex \
  ./report.md \
  --intent "client report with cover image, readable code, and clean dense tables" \
  --base-profile ./report-profile.yml \
  --cover-image ./cover.png \
  --output ./pdf-template

cdx-chores md to-pdf \
  --input ./report.md \
  --profile ./report-profile.yml \
  --template ./pdf-template/template.html \
  --css ./pdf-template/style.css \
  --output ./report.pdf
```

This keeps the same reviewed-assist rule used by profile-Codex:

```text
Codex drafts artifacts.
The user can inspect, commit, or edit artifacts.
md to-pdf renders accepted artifacts deterministically.
```

### 2. Template-Codex owns directions that profile-Codex rejects

Profile-Codex remains intentionally bounded to profile fields.

Template-Codex is the correct owner for:

- local cover images and custom cover media
- custom cover composition and title placement
- exact table styling
- custom HTML structure
- custom CSS layout
- section or chapter layout treatment
- brand-like typography and color treatment
- template-only rendering behavior

This does not make profile-Codex obsolete. Profile-Codex remains the quick config route when a request can be represented by page settings, ToC, profile-compatible cover fields, page chrome, page numbers, fonts, code highlighting, and preset-backed recipe choices. Put another way: profile-Codex is better for page-number and reusable render policy; template-Codex is better for cover-image bundles and reviewable presentation artifacts.

### 3. Profile can be an input signal, but template/CSS is the stronger visual layer

`md pdf-template codex` should accept a base profile:

```bash
cdx-chores md pdf-template codex ./report.md \
  --base-profile ./report-profile.yml \
  --output ./pdf-template
```

The base profile should act as:

- a structured intent source
- a compatibility target
- a source of metadata, page, ToC, font, and cover/page-chrome expectations

But a custom template and stylesheet are lower-level rendering artifacts. When rendered with `md to-pdf`, a profile field affects the final PDF only if the template and stylesheet honor that hook.

The helper should make this relationship visible in its summary and optional report.

Template-Codex should therefore treat profile-owned render policy as an input boundary, not as a styling suggestion to silently override. Page size, orientation, margins, ToC behavior, and page numbers should be inherited from profile or render-time recipe sources unless the template phase defines a bounded, reported template-level override. By contrast, local cover-image copying, bundle-relative asset paths, cover-media layout, duplicate-title avoidance in the custom template, and table styling are template-owned presentation concerns.

### 4. Precedence should follow the current renderer model

The helper should not invent a second precedence model. It should mirror the current deterministic render path:

```text
built-in preset/default recipe
  -> base profile recipe settings
  -> selected template family and CSS decisions
  -> written template bundle
```

The later render keeps the existing `md to-pdf` relationship:

```text
profile recipe fields
  -> explicit md to-pdf recipe flags
  -> generated internal recipe
       -> --template replaces generated template HTML
       -> default CSS is included unless --no-default-css
       -> --css is applied after default CSS
```

This means `--profile` can still configure metadata, ToC settings, title behavior, cover fields, page chrome, fonts, and code options, but the generated template and stylesheet must preserve the later-render hooks needed for those features. Template-Codex should not generate static ToC content from the Markdown document. The actual ToC is materialized only during `md to-pdf` when render-time options enable it. Template-Codex should preserve the current conditional ToC hook region, `$if(toc)$ ... $toc$ ... $endif$`, and the `#TOC` layout target when the selected template family includes ToC support. If a user renders with `--no-default-css`, the generated `style.css` owns the required layout and code-block hook styling.

Default v1 render posture should be layered: when a profile is also used, render with `--profile`, `--template`, and `--css` while leaving default CSS enabled. The profile-derived default CSS remains the baseline for page chrome, font roles, cover defaults, and Shiki hooks; the generated template stylesheet is applied after it and should override only the template-backed decisions it owns.

Canonical layered render:

```bash
cdx-chores md to-pdf \
  --input ./report.md \
  --profile ./report-profile.yml \
  --template ./pdf-template/template.html \
  --css ./pdf-template/style.css \
  --output ./report.pdf
```

Self-contained render is an advanced posture:

```bash
cdx-chores md to-pdf \
  --input ./report.md \
  --profile ./report-profile.yml \
  --template ./pdf-template/template.html \
  --css ./pdf-template/style.css \
  --no-default-css \
  --output ./report.pdf
```

In self-contained mode, the bundle stylesheet owns all required layout, cover, page chrome, and code-block hook CSS. Template-Codex can support this later, but the first documented path should optimize for layered rendering because it matches the current renderer contract and lowers the risk of missing profile-owned CSS.

### 5. The output directory should be reviewable and portable by default

Recommended artifact shape:

```text
pdf-template/
  template.html
  style.css
  assets/
    cover.png
  template.codex-report.json  # optional
```

V1 should create `assets/` only when managed assets exist. Local cover images should be copied into that directory by default, using collision-safe filenames when needed, and generated HTML/CSS should reference those copied files relatively.

V1 cover media should stay intentionally narrow:

- accepted: local still PNG, JPEG, and WebP files
- unsupported: GIF, animated PNG, animated WebP, SVG, BMP, TIFF, PDF, remote URLs, and other non-local asset references
- path resolution: user-provided relative paths are resolved from the CLI working directory; generated bundle references remain relative to the template bundle
- metadata: when practical, collect local image dimensions, aspect ratio, orientation bucket, and fit-pressure summary as bounded signals; when metadata is unavailable, keep aspect-ratio handling in `auto` and use conservative layout CSS

Animated media is out of scope because animation has no durable PDF cover semantics. SVG is out of scope because it can contain nested references, active markup, and renderer-sensitive layout behavior. Users should convert other media to a still PNG, JPEG, or WebP before passing `--cover-image`.

`--output` follows `md pdf-template init` directory semantics when provided:

- the path must be a directory or a missing path that can be created
- a non-empty output directory should fail unless `--overwrite` is passed
- `--overwrite` allows replacing selected generated files, but should not silently delete unrelated files
- `--codex-report-output` must stay distinct from the output directory, input Markdown, base profile, and managed asset source paths

When `--output` is omitted and the command has enough signal to proceed, template-Codex should generate a generic default bundle directory instead of failing:

- use `md-pdf-template-<timestamp>-<uid>/` in the current working directory, regardless of whether an input path is present
- do not derive generated bundle names from the Markdown input stem or extension; callers who want semantic names should pass `--output`
- generated default directories should retry with a bounded UID loop to avoid collisions, matching the profile-Codex generated-output posture
- no-signal invocations should still reject before deriving or reserving a default output directory

Defaulting to copied local assets is the safer reviewable artifact model. It makes the template directory closer to a reusable bundle and avoids leaking absolute local paths into generated files.

Cover image dimensions are metadata, not direct rendered size. Large source images should not be emitted at intrinsic pixel dimensions in the generated template. The deterministic CSS layer owns scaling the copied image into a page-relative cover-media box.

Recommended v1 asset sizing signal:

| Signal | Values |
| --- | --- |
| `dimensions` | `{ width, height }` when available; otherwise unknown |
| `aspect_ratio` | numeric ratio when available; otherwise unknown |
| `orientation` | `landscape`, `portrait`, `square`, `panoramic`, `tall`, or `unknown` |
| `fit_pressure` | `normal`, `crop-risk`, `letterbox-risk`, or `unknown` |

`fit_pressure` should summarize layout risk from the image aspect ratio and selected cover-media region. It should not be a new user-facing flag. Codex can use this signal to choose between bounded slots such as `image_fit: contain` and `image_fit: cover`, while deterministic synthesis owns the actual CSS. The default `--cover-image`-only path should use `image_fit: contain` and CSS constraints such as page-relative `max-width` and `max-height` so oversized images scale down to fit the page. `image_fit: cover` may crop and should require explicit intent or strong design signals.

### 6. Remote assets should stay explicit

The deterministic renderer blocks remote assets unless the render uses `--allow-remote-assets`.

Template-Codex should not quietly introduce remote asset dependencies. V1 should report remote cover-media directions as unsupported template-Codex directions instead of downloading, inspecting, copying, or emitting remote cover-media references. Existing remote references in accepted Markdown, HTML, or CSS remain a render-time `md to-pdf --allow-remote-assets` concern.

### 7. Codex output should be constrained even when it writes HTML/CSS

Template-Codex has a broader surface than profile-Codex because HTML and CSS are the artifact format. Still, the helper should avoid an unbounded "dump arbitrary files" contract.

Possible contract directions:

```text
Option A: Codex returns raw template.html and style.css
  + fastest path to useful output
  - larger validation and safety surface
  - harder to ensure stable hooks and renderer compatibility

Option B: Codex returns bounded template decisions
  + deterministic code writes the files
  + easier validation and repeatability
  - slower to build
  - may limit useful custom layout in v1

Option C: hybrid contract
  + Codex returns a selected template family, bounded slots, asset usage, and optional CSS blocks
  + deterministic code owns boilerplate and required hooks
  - still needs a clear CSS validation story
```

The current working direction is Option C. It best matches the repo's reviewed-assist pattern while acknowledging that template-Codex exists specifically because profile fields are not expressive enough.

V1 should make Option C concrete with:

- two v1 template families: `document-layered` and `cover-media-layered`
- a separate `recipe_preset` value that remains one of the current renderer presets: `article`, `report`, `wide-table`, `compact`, or `reader`
- later-render template placeholders preserved by deterministic code, including `$body$`, title metadata, the conditional `$if(toc)$ ... $toc$ ... $endif$` ToC region, and the current standalone HTML structure
- required renderer hooks preserved by deterministic code, including profile cover/page-chrome hooks and Shiki `.cdx-code*` selectors
- bounded slots for cover composition, title block placement, table density, section spacing, color tokens, font-role alignment, and code-block treatment
- bounded CSS blocks only for named slots, with validation for remote URLs, absolute local paths, and required selector preservation

The family names are intentionally narrow. `article`, `report`, `wide-table`, `compact`, and `reader` are already public recipe preset names, so template-Codex should not reuse them as template family names. `plain` and `report` remain the v1 cover-style values for profile-compatible cover treatment. The string `report` can therefore appear in more than one enum domain, but only through explicitly named fields such as `recipe_preset: report` or `slots.cover.style: report`.

V1 enum domains:

| Field | Values |
| --- | --- |
| `template_family` | `document-layered`, `cover-media-layered` |
| `recipe_preset` | `article`, `report`, `wide-table`, `compact`, `reader` |
| `slots.cover.style` | `plain`, `report` |

V1 field roles:

| Field | Role |
| --- | --- |
| `template_family` | Chooses the repo-owned HTML/CSS boilerplate skeleton. It does not imply page density, table density, or renderer preset behavior by itself. |
| `recipe_preset` | Carries the current renderer preset semantics independently from `template_family`. It is resolved from base-profile preset identity or default recipe behavior before template synthesis. |
| `slots.cover.style` | Controls only profile-compatible cover-slot styling. It does not choose the template skeleton and does not imply `recipe_preset: report`. |

All `recipe_preset` values are valid with both v1 template families. `cover-media-layered` changes managed asset hooks and cover-media slots; it does not force a `report` preset. `document-layered` can still use `slots.cover.style: report` for title-only or profile-compatible cover treatment without becoming a cover-media bundle.

V1 cover-media slots should also stay bounded:

| Slot | Values | Notes |
| --- | --- | --- |
| `slots.cover.layout` | `background`, `image-above-title`, `image-below-title` | `--cover-image` without design intent should use a conservative contained layout, not a full-page cropped background. |
| `slots.cover.image_fit` | `cover`, `contain` | `cover` may crop; `contain` preserves the full image. |
| `slots.cover.title_placement` | `top-left`, `top-center`, `center`, `lower-left`, `lower-center` | Used for media-aware title placement. |
| `slots.cover.aspect_ratio` | `auto` | V1 records local metadata as a signal when available but should not expose an aspect-ratio CLI flag. |

Full-page background covers should require explicit intent or strong document/design signals. The deterministic `--cover-image`-only path should prefer a contained layout with the title block separate from the image.

Slot decisions should not contain raw CSS sizing values derived from source pixels. For example, a 4000px-wide image should not produce `width: 4000px`. It should produce a bounded decision such as `image_fit: contain`, and deterministic CSS should scale the copied image within the selected cover-media region.

V1 family meanings:

| Template family | Meaning |
| --- | --- |
| `document-layered` | The default layered template skeleton for documents without managed cover media. It preserves the current template structure and lets recipe presets plus slots control density, table, typography, spacing, and code treatment. |
| `cover-media-layered` | The layered template skeleton with managed local cover-media hooks. It is selected when `--cover-image` or explicit cover-media intent requires copied assets and cover composition slots. |

V1 selection rules should stay deterministic:

| Signal | Template family |
| --- | --- |
| no managed local cover image | `document-layered` |
| `--base-profile` with ordinary profile cover or page chrome, but no local cover image | `document-layered` |
| `--cover-image <path>` with or without `--base-profile` | `cover-media-layered` |
| intent asks for title-only or profile-compatible cover composition without local image media | `document-layered` with supported cover slots |
| intent asks for local image or cover media but omits `--cover-image` | keep `document-layered` only if other usable template directions remain and record the missing media request in `unsupported_directions`; otherwise return `no-usable-template` |

This keeps `cover-media-layered` tied to managed asset handling instead of any cover-related wording. A title-only cover or profile-supported cover style can still be represented as slots on `document-layered`.

Illustrative response shape:

```text
decision_mode: adapted
template_family: cover-media-layered
recipe_preset: report
slots:
  cover:
    mode: local-image
    image_ref: assets/cover.png
    layout: background
    image_fit: cover
    aspect_ratio: auto
    title_placement: lower-left
  tables:
    density: compact
    header_treatment: shaded
  code:
    line_number_gutter: preserve
css_blocks:
  - slot: cover
    css: bounded slot CSS only
  - slot: tables
    css: bounded slot CSS only
managed_assets:
  - source_label: --cover-image
    bundle_path: assets/cover.png
warnings: []
unsupported_directions: []
```

The implementation plan should turn this sketch into a strict structured-output schema.

### 8. Signal ladder should mirror profile-Codex but account for assets

V1 signal handling should be explicit:

| Inputs | Expected behavior |
| --- | --- |
| no input, no intent, no base profile, and no cover image | reject as too low-signal; use `md pdf-template init` for deterministic recipe-controlled templates |
| `--base-profile` only | deterministic template snapshot from the base profile and renderer defaults; no Codex needed |
| `--cover-image` only | deterministic `cover-media-layered` bundle; write copied asset and minimal cover hooks |
| `--intent` and/or Markdown input | call Codex with document/design signals |
| profile-Codex unmatched template directions | natural escalation path into template-Codex using the same input, intent, and base profile |

Document input should be optional but useful. It can provide heading depth, table shape, code-block density, title duplication risk, and language/code signals. The helper should sample or summarize document content using the same privacy posture as profile-Codex and should avoid sending raw local paths when persisted report paths are enough.

The deterministic rows still belong in the command because they keep one bundle-writing surface for profile-aware snapshots, cover-image bundling, identity comments, optional reports, and dry-run/collision behavior. Plain `md pdf-template init` remains the direct command for deterministic recipe-controlled templates when no template-Codex-specific signal or bundle behavior is needed.

The `--cover-image`-only path should use the fixed deterministic `cover-media-layered` family in v1. It should not ask Codex to invent cover composition unless the user also supplies intent or document signals.

### 9. Decision modes should define write and exit behavior

Template-Codex should use decision modes comparable to profile-Codex:

| Mode | Meaning | Write behavior | Exit |
| --- | --- | --- | --- |
| `deterministic` | no Codex required; base profile or cover image signals are enough | write bundle unless `--dry-run` | 0 |
| `adapted` | Codex produced valid bounded template decisions | write bundle unless `--dry-run` | 0 |
| `conservative-fallback` | Codex response was usable only after safe fallback or reduced scope | write conservative bundle unless `--dry-run` | 0 |
| `no-usable-template` | Codex unavailable, invalid, unsafe, or unsupported after validation | write no recipe files; write requested failure report only | 1 |

`--dry-run` should run signal collection, Codex selection when needed, and validation, then print planned paths and decisions without writing recipe files or copying assets. If `--dry-run --keep-codex-report` or `--codex-report-output` is passed, the command may write only the diagnostic report, matching profile-Codex behavior.

### 10. Artifact identity and report schema should be separate from profile-Codex

Template bundles need their own identity because the durable artifact is a directory, not a profile file.

Recommended identity:

```text
md-pdf-template-YYYYMMDDTHHMMSSZ-xxxxxxxx
```

The identity can be written into:

- an HTML comment in `template.html`
- a CSS comment in `style.css`
- the optional Codex report

V1 should avoid a mandatory metadata file unless implementation discovers that comments are too weak for tests or future replay. The optional report should use a distinct artifact type such as:

```text
markdown-pdf-codex-template-report
```

The report should capture the selected template family, recipe preset, decision mode, input summaries, base-profile summary, managed assets, written files, validation results, unsupported directions, and render follow-up command.

When `--keep-codex-report` is passed without `--codex-report-output`, the default report path should be `template.codex-report.json` inside the output directory. `--codex-report-output <path>` can override that location and should require a `.json` path that does not collide with input, profile, output directory, or managed asset sources.

This intentionally differs from profile-Codex report naming. Profile-Codex writes a single profile file, so a UID-linked sibling report is natural. Template-Codex writes a directory bundle, so the default report should live inside that bundle unless the user selects an explicit JSON path.

### 11. Validation should be static first, with smoke coverage in tests

V1 validation should be static template-contract validation. `md pdf-template codex` should not run Pandoc, run WeasyPrint, render a PDF, or generate static ToC markup from the input Markdown. It should validate that the generated bundle remains compatible with the later `md to-pdf` render path.

Validation should apply a strict precedence rule: security, path-hygiene, asset-boundary, and later-render compatibility failures are always hard errors. Conservative fallback is allowed only after those checks pass or after unsafe optional material has been removed before file synthesis.

Hard validation failures should stop the write with `no-usable-template`:

- generated `template.html` omits required later-render template placeholders such as `$body$`
- generated files omit required renderer hooks for the selected family, such as cover, page chrome, or Shiki code-block selectors
- generated HTML/CSS would reference absolute local source paths
- generated HTML/CSS would introduce remote URLs
- generated files, copied assets, or default in-bundle reports would write outside the effective output directory
- explicit CLI `--cover-image` points to an unsupported format or non-local resource
- Codex returns unsupported asset references, unsafe URLs, or absolute source paths that cannot be removed while preserving a usable bundle

Conservative fallback should remain available when validation can safely reduce design ambition:

- invalid optional CSS blocks can be dropped only when they fail non-security styling validation; optional blocks containing remote URLs, absolute local source paths, or required-hook removals are hard errors unless fully removed before synthesis
- unsupported slot enum values can fall back to the closest allowed slot
- unavailable image dimensions can use `aspect_ratio: auto`
- unsupported design directions can move into `unsupported_directions` on successful adapted or fallback decisions when the remaining directions still form a valid bundle
- cover-media intent without usable local media can fall back to `document-layered` when the non-media directions still make sense

The boundary is that unsafe, non-portable, or later-render-incompatible artifacts are hard errors. Reduced visual ambition is a conservative fallback.

The test suite should include a smoke render through `md to-pdf` using generated template artifacts where Pandoc and WeasyPrint are mocked or already covered by existing fixtures. That render smoke belongs in tests around integration compatibility, not as a runtime step inside `md pdf-template codex`. Live visual review can remain a manual smoke path under `examples/playground/`.

Cover-media tests should use committed synthetic fixtures for PNG, JPEG, and WebP validation and rejection fixtures for unsupported formats. Manual cover-media smoke outputs can follow the existing Markdown PDF fixture-script pattern by writing local review artifacts under `examples/playground/`, then cleaning those generated outputs before commit. Public docs, reports, and job records should not disclose machine-local source image paths.

### 12. Reports should redact copied-asset source paths

The optional report should record bundle-relative paths as the durable public artifact record. It should not persist raw local source paths by default.

This redaction boundary applies to all persisted artifacts and records produced by the helper path, including success reports, failure reports, dry-run reports, generated identity comments, generated HTML/CSS, job records, and public documentation. Persisted content may include bundle-relative paths, source basenames, source labels such as `--cover-image`, formats, and dimensions. It should not include machine-local source directories unless a future debugging flag explicitly opts into that disclosure.

Recommended managed-asset report shape:

```json
{
  "managed_assets": [
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
  ]
}
```

Terminal output can use the normal display-path helper for user ergonomics, but that display is non-persistent. Persisted reports should prefer `bundle_path`, `source_basename`, and redacted source display. If a future implementation needs opt-in source-path disclosure for debugging, that should be a separate explicit flag and should not affect public docs, default reports, or job records.

### 13. The command should be direct and scriptable

The first template-Codex implementation should be a direct CLI flow, not an Interactive flow.

Draft command surface:

```bash
cdx-chores md pdf-template codex [input] \
  --intent <text> \
  --font-hint <text> \
  --base-profile <path> \
  --cover-image <path> \
  --output <directory> \
  --dry-run \
  --keep-codex-report \
  --codex-report-output <path> \
  --overwrite
```

Likely rules:

- `[input]` and `--input <path>` should follow the profile-Codex alias pattern if script parity is useful.
- this command should not inherit the recipe flags from `md pdf-template init`: `--preset`, `--page-size`, `--orientation`, `--margin*`, `--toc`, `--toc-depth`, and `--toc-page-break`.
- removed recipe flags should not remain as hidden accepted options. If a caller needs those controls, use `md pdf-template init`, encode reusable preferences in `--base-profile`, or pass render-time recipe flags to `md to-pdf`.
- `--intent` remains the general design direction, not a bundle of many narrow style flags.
- `--font-hint` should be repeatable for parity with profile-Codex and should inform a structured template font decision contract rather than raw font CSS.
- template font decisions should mirror the profile-Codex role/key posture where practical: `body.default`, `body.<language-tag>`, `code.default`, `code.symbols`, and `heading.default`. `body.<language-tag>` should use valid language tags, while heading remains a single reusable slot.
- `pdf.content-langs` is an expected coverage signal, not a precise text-label signal. It can order body fallback stacks, but exact mixed-language font targeting depends on rendered `lang` attributes such as Pandoc spans from `[text]{lang=ja}`. Template-Codex should not rewrite Markdown to add language labels.
- `--cover-image` should be explicit when local cover media is involved.
- `--base-profile` should validate before calling Codex.
- `-o, --output <directory>` should be optional in v1; when omitted, the helper should generate a readable, non-colliding default bundle directory.
- normal execution writes selected artifacts.
- `--dry-run` previews the decision and paths without writing recipe files.
- report output stays optional.

The implementation plan should still settle smaller option details, but the v1 direction is a direct helper with an effective output directory and no hidden render step.

## Alternatives Considered

### Raw HTML/CSS dump

Letting Codex return full `template.html` and `style.css` directly is the fastest prototype path, but it leaves too much compatibility and safety work to post-hoc validation. It is easy to lose later-render template placeholders, Shiki hooks, profile-owned cover/page-chrome hooks, or local path hygiene.

### Manual `md pdf-template init` only

Keeping the workflow as `md pdf-template init` plus manual HTML/CSS editing remains the fallback path. It does not solve the current product gap: users need help crossing from high-level layout intent into a reviewable template bundle without touching the full CSS/HTML surface by hand.

### Expand the profile schema for cover images

Adding local cover-image fields to profiles would blur the quick durable config route with asset bundling and custom layout. Local media, custom cover composition, and exact table styling belong in the template artifact layer.

### Existing Template Refinement

Reading and modifying an existing user template bundle is useful, but it is explicitly out of v1 scope and should be treated as a separate refinement workflow. V1 `md pdf-template codex` should generate a new reviewable bundle at the effective output directory from the two deterministic template families, `document-layered` and `cover-media-layered`, plus profile-derived recipe, document, intent/font, and asset signals.

Operationally, v1 should not read an existing `template.html` or `style.css` as an input signal. If `--output <directory>` points at an existing template bundle, the command should treat that path only as the output target and apply the normal output-directory collision rules: fail on a non-empty directory unless `--overwrite` is passed, and even with `--overwrite`, replace only the generated bundle files without interpreting the previous files as a base. A future refinement workflow should use a separate command or clearly named option after it has its own read, diff, preservation, and validation contract.

## Recommendations

1. Keep this research separate from the parent roadmap so the profile-Codex history does not get buried in template-specific details.
2. Implement `md pdf-template codex` as the current `v0.1.5-canary.3` target.
3. Treat template-Codex as an artifact generator, not a render-time hidden assistant.
4. Support `-o, --output <directory>` as an explicit bundle destination while generating a readable, non-colliding default directory when omitted.
5. Accept profile input as a signal and compatibility target, while documenting that template/CSS is the stronger visual layer.
6. Prefer copied local assets inside the output directory, referenced relatively from generated HTML/CSS.
7. Use bounded template decisions plus deterministic file synthesis instead of raw full-file Codex dumps.
8. Defer hybrid one-shot and Interactive mode until this direct command contract is implemented and verified.

## Related Research

- [Markdown PDF Codex Helper Roadmap](research-2026-06-10-markdown-pdf-codex-profile-and-interactive-flow.md)
- [Markdown to PDF with WeasyPrint](research-2026-05-06-markdown-to-pdf-weasyprint.md)
- [Markdown to PDF Profiles, Fonts, and Page Chrome](research-2026-05-07-markdown-to-pdf-profiles-fonts-and-page-chrome.md)
- [Markdown PDF Shiki Code Highlighting](research-2026-05-16-markdown-pdf-shiki-code-highlighting.md)

## Related Plans

- [Markdown PDF template Codex helper implementation](../plans/plan-2026-06-23-markdown-pdf-template-codex-helper.md)
- [Markdown PDF Codex profile helper implementation](../plans/plan-2026-06-15-markdown-pdf-codex-profile-helper.md)
