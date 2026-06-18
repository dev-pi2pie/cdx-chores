---
title: "Markdown PDF Template Codex Helper"
created-date: 2026-06-18
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
- `md pdf-template init` writes `template.html` and `style.css`.
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

`md pdf-template codex` should likely accept a base profile:

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

### 4. The output directory should be reviewable and portable by default

Recommended artifact shape:

```text
pdf-template/
  template.html
  style.css
  assets/
    cover.png
  template.codex-report.json  # optional
```

The first implementation should settle:

- whether `assets/` is always created or only created when needed
- whether local assets are copied by default or referenced in place
- how copied asset filenames avoid collisions
- how paths are written in `template.html` and `style.css`
- how explicit output collisions interact with `--overwrite`

Defaulting to copied local assets is likely the safer reviewable artifact model. It makes the template directory closer to a reusable bundle and avoids leaking absolute local paths into generated files.

### 5. Remote assets should stay explicit

The deterministic renderer blocks remote assets unless the render uses `--allow-remote-assets`.

Template-Codex should not quietly introduce remote asset dependencies. If the user requests remote assets, the helper should either:

- report the direction as unsupported for the first slice, or
- require an explicit opt-in and record it in the diagnostic report.

The first slice should prefer local copied assets and avoid remote fetch behavior unless implementation review finds a strong reason to include it.

### 6. Codex output should be constrained even when it writes HTML/CSS

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

### 7. The command should be direct and scriptable

The first template-Codex implementation should be a direct CLI flow, not an Interactive flow.

Draft command surface:

```bash
cdx-chores md pdf-template codex [input] \
  --intent <text> \
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
- `--intent` remains the general design direction, not a bundle of many narrow style flags.
- `--cover-image` should be explicit when local cover media is involved.
- `--base-profile` should validate before calling Codex.
- normal execution writes selected artifacts.
- `--dry-run` previews the decision and paths without writing recipe files.
- report output stays optional.

The exact command surface remains open until the implementation plan is drafted.

## Open Questions

- Should `--cover-image` be singular in v1, or should the command support repeated media inputs?
- Should local assets always be copied into `assets/`, or should reference-in-place be available?
- Should `--dry-run --keep-codex-report` write only the diagnostic report, matching profile-Codex behavior?
- Should template-Codex support an explicit `--base-template <directory>` in v1, or defer editing existing templates?
- Should the first slice validate generated HTML/CSS with render smoke tests, static checks, or both?
- How much of `style.css` may be raw Codex output versus deterministic CSS generated from bounded decisions?
- Should the diagnostic report share field names with profile-Codex reports or use a separate artifact type and version?
- What is the generated output name when `--output` is omitted?

## Recommendations

1. Keep this research separate from the parent roadmap so the profile-Codex history does not get buried in template-specific details.
2. Implement `md pdf-template codex` as the current `v0.1.5-canary.3` target.
3. Treat template-Codex as an artifact generator, not a render-time hidden assistant.
4. Prefer copied local assets inside the output directory unless the implementation plan settles a stronger portability rule.
5. Accept profile input as a signal and compatibility target, while documenting that template/CSS is the stronger visual layer.
6. Defer hybrid one-shot and Interactive mode until this direct command contract is implemented and verified.

## Related Research

- [Markdown PDF Codex Helper Roadmap](research-2026-06-10-markdown-pdf-codex-profile-and-interactive-flow.md)
- [Markdown to PDF with WeasyPrint](research-2026-05-06-markdown-to-pdf-weasyprint.md)
- [Markdown to PDF Profiles, Fonts, and Page Chrome](research-2026-05-07-markdown-to-pdf-profiles-fonts-and-page-chrome.md)
- [Markdown PDF Shiki Code Highlighting](research-2026-05-16-markdown-pdf-shiki-code-highlighting.md)

## Related Plans

- [Markdown PDF Codex profile helper implementation](../plans/plan-2026-06-15-markdown-pdf-codex-profile-helper.md)
