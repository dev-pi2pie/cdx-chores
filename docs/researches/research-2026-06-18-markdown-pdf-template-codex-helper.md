---
title: "Markdown PDF Template Codex Helper"
created-date: 2026-06-18
modified-date: 2026-06-19
status: in-progress
agent: codex
---

## Goal

Define the direct `md pdf-template codex` helper for the current canary target, `v0.1.5-canary.3`.

The helper should draft reviewable Markdown PDF template artifacts for layout, cover media, and HTML/CSS-backed directions that `md pdf-profile codex` intentionally rejects.

## Milestone Goal

`v0.1.5-canary.3` should not be tagged until the template-Codex route is implemented, verified, and documented or explicitly deferred.

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
- `-o, --output <directory>` is required in v1 and means the template bundle directory, matching `md pdf-template init`.
- v1 should not generate a default output directory when `--output` is omitted. Directory bundles are more invasive than a single generated profile file, so the user should choose the artifact location explicitly.
- the command should accept the same deterministic recipe flags as `md pdf-template init` and `md to-pdf` for page shape, preset, and ToC settings.
- `[input]` plus `-i, --input <path>` should mirror the profile-Codex alias pattern.
- `--base-profile <path>` is an optional signal and compatibility target, not the output target.
- `--cover-image <path>` should be singular in v1. Repeated media inputs can wait until the asset model proves out.
- local cover images should be copied into `assets/` by default and referenced with relative paths.
- remote asset fetching is out of scope for v1.
- `--base-template <directory>` is deferred from v1. The first slice should start from deterministic template families derived from the current recipe generator.
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
  |-- recipe flags: --preset, --page-size, --orientation, --margin*, --toc*
  |-- --output <directory>
  |
  v
Normalize and validate command state
  |
  |-- resolve paths relative to cwd
  |-- reject conflicting input/output/report/asset paths
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
  |     explicit preset/page/margin/ToC flags that override profile recipe fields
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
  |-- no target signals and no recipe flags beyond defaults
  |     -> reject; use md pdf-template init
  |
  |-- base profile only, recipe flags only, or cover-image only
  |     -> deterministic template decision
  |
  |-- intent, Markdown document signals, or unmatched template directions
  |     -> Codex-assisted template decision
  |
  v
Codex request envelope, only when needed
  |
  |-- supported template families and bounded slots
  |-- summarized/redacted document signals
  |-- normalized profile and recipe signals
  |-- managed asset summaries, not raw copied bytes
  |-- required Pandoc/profile/Shiki hooks
  |-- disallowed behavior: remote URLs, absolute local paths,
  |   missing hooks, arbitrary extra files
  |
  v
Codex bounded response
  |
  |-- decision mode
  |-- selected template family
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
  |-- validate required hooks, path hygiene, and asset references
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

This does not make profile-Codex obsolete. Profile-Codex remains the quick config route when a request can be represented by page settings, ToC, cover fields, page chrome, fonts, code highlighting, and preset-backed recipe choices.

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

### 4. Precedence should follow the current renderer model

The helper should not invent a second precedence model. It should mirror the current deterministic render path:

```text
built-in preset/default recipe
  -> base profile recipe settings
  -> explicit recipe flags
  -> generated template family and CSS decisions
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

This means `--profile` can still configure metadata, ToC, title behavior, cover fields, page chrome, fonts, and code options, but the generated template and stylesheet must preserve the hooks needed for those features. If a user renders with `--no-default-css`, the generated `style.css` owns the required layout and code-block hook styling.

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

`--output` follows `md pdf-template init` semantics:

- the path must be a directory or a missing path that can be created
- a non-empty output directory should fail unless `--overwrite` is passed
- `--overwrite` allows replacing selected generated files, but should not silently delete unrelated files
- `--codex-report-output` must stay distinct from the output directory, input Markdown, base profile, and managed asset source paths

Defaulting to copied local assets is the safer reviewable artifact model. It makes the template directory closer to a reusable bundle and avoids leaking absolute local paths into generated files.

### 6. Remote assets should stay explicit

The deterministic renderer blocks remote assets unless the render uses `--allow-remote-assets`.

Template-Codex should not quietly introduce remote asset dependencies. V1 should report remote-asset directions as unsupported template-Codex directions instead of downloading or embedding remote content. A later slice can add an explicit opt-in if there is a real workflow need.

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

- template families derived from the current recipe generator, starting with the default article/report-style family rather than a broad theme catalog
- required Pandoc hooks preserved by deterministic code, including `$body$`, `$toc$`, title metadata, and the current standalone HTML structure
- required renderer hooks preserved by deterministic code, including profile cover/page-chrome hooks and Shiki `.cdx-code*` selectors
- bounded slots for cover composition, title block placement, table density, section spacing, color tokens, font-role alignment, and code-block treatment
- bounded CSS blocks only for named slots, with validation for remote URLs, absolute local paths, and required selector preservation

Illustrative response shape:

```text
decision_mode: adapted
selected_template_family: report-layered
slots:
  cover:
    mode: local-image
    image_ref: assets/cover.png
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
| no input, no intent, no base profile, no cover image, and no recipe flags beyond defaults | reject as too low-signal; use `md pdf-template init` instead |
| `--base-profile` only | deterministic template snapshot from the base profile and recipe flags; no Codex needed |
| recipe flags only | deterministic template snapshot equivalent to `md pdf-template init`; no Codex needed |
| `--cover-image` only | deterministic default cover-media family; write copied asset and minimal cover hooks |
| `--intent` and/or Markdown input | call Codex with document/design signals |
| profile-Codex unmatched template directions | natural escalation path into template-Codex using the same input, intent, and base profile |

Document input should be optional but useful. It can provide heading depth, table shape, code-block density, title duplication risk, and language/code signals. The helper should sample or summarize document content using the same privacy posture as profile-Codex and should avoid sending raw local paths when persisted report paths are enough.

The deterministic rows still belong in the command because they keep one bundle-writing surface for profile-aware snapshots, recipe-flag snapshots, cover-image bundling, identity comments, optional reports, and dry-run/collision behavior. Plain `md pdf-template init` remains the simpler command when no template-Codex-specific signal or bundle behavior is needed.

The `--cover-image`-only path should use a fixed deterministic cover-media family in v1. It should not ask Codex to invent cover composition unless the user also supplies intent or document signals.

### 9. Decision modes should define write and exit behavior

Template-Codex should use decision modes comparable to profile-Codex:

| Mode | Meaning | Write behavior | Exit |
| --- | --- | --- | --- |
| `deterministic` | no Codex required; recipe flags or base profile are enough | write bundle unless `--dry-run` | 0 |
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

The report should capture the selected template family, decision mode, input summaries, base-profile summary, managed assets, written files, validation results, unsupported directions, and render follow-up command.

When `--keep-codex-report` is passed without `--codex-report-output`, the default report path should be `template.codex-report.json` inside the output directory. `--codex-report-output <path>` can override that location and should require a `.json` path that does not collide with input, profile, output directory, or managed asset sources.

This intentionally differs from profile-Codex report naming. Profile-Codex writes a single profile file, so a UID-linked sibling report is natural. Template-Codex writes a directory bundle, so the default report should live inside that bundle unless the user selects an explicit JSON path.

### 11. Validation should be static first, with smoke coverage in tests

V1 validation should reject generated artifacts that:

- omit required Pandoc hooks such as `$body$` or ToC support
- omit required renderer hooks for cover, page chrome, or Shiki code blocks
- reference absolute local source paths in generated HTML/CSS
- introduce remote URLs
- write outside the output directory
- produce unsupported asset references

The test suite should include a smoke render through `md to-pdf` using generated template artifacts where Pandoc and WeasyPrint are mocked or already covered by existing fixtures. Live visual review can remain a manual smoke path under `examples/playground/`.

### 12. The command should be direct and scriptable

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
- this command should also inherit the same recipe flags as `md pdf-template init`: `--preset`, `--page-size`, `--orientation`, `--margin*`, `--toc`, `--toc-depth`, and `--toc-page-break`.
- `--intent` remains the general design direction, not a bundle of many narrow style flags.
- `--font-hint` should be repeatable for parity with profile-Codex and should inform typography slots rather than raw font CSS.
- `--cover-image` should be explicit when local cover media is involved.
- `--base-profile` should validate before calling Codex.
- `-o, --output <directory>` should be required in v1.
- normal execution writes selected artifacts.
- `--dry-run` previews the decision and paths without writing recipe files.
- report output stays optional.

The implementation plan should still settle smaller option details, but the v1 direction is a direct helper with required `--output <directory>` and no hidden render step.

## Alternatives Considered

### Raw HTML/CSS dump

Letting Codex return full `template.html` and `style.css` directly is the fastest prototype path, but it leaves too much compatibility and safety work to post-hoc validation. It is easy to lose Pandoc hooks, Shiki hooks, profile-owned cover/page-chrome hooks, or local path hygiene.

### Manual `md pdf-template init` only

Keeping the workflow as `md pdf-template init` plus manual HTML/CSS editing remains the fallback path. It does not solve the current product gap: users need help crossing from high-level layout intent into a reviewable template bundle without touching the full CSS/HTML surface by hand.

### Expand the profile schema for cover images

Adding local cover-image fields to profiles would blur the quick durable config route with asset bundling and custom layout. Local media, custom cover composition, and exact table styling belong in the template artifact layer.

### Support `--base-template` in v1

Editing an existing user template is useful, but it broadens validation and merge behavior. V1 should start from deterministic template families derived from the current recipe generator, then revisit `--base-template <directory>` once generated bundle identity and validation are stable.

## Open Questions

- What exact template-family names should v1 expose internally?
- Should `--cover-image` accept only PNG/JPEG/WebP at first, or any local renderer-supported image file?
- Which static validation failures should be hard errors versus conservative fallback triggers?
- How should path redaction be represented for copied assets in the report?

## Recommendations

1. Keep this research separate from the parent roadmap so the profile-Codex history does not get buried in template-specific details.
2. Implement `md pdf-template codex` as the current `v0.1.5-canary.3` target.
3. Treat template-Codex as an artifact generator, not a render-time hidden assistant.
4. Require `-o, --output <directory>` in v1, matching `md pdf-template init`.
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

- [Markdown PDF Codex profile helper implementation](../plans/plan-2026-06-15-markdown-pdf-codex-profile-helper.md)
