---
title: "Markdown to PDF profiles, fonts, and page chrome implementation"
created-date: 2026-05-07
modified-date: 2026-05-07
status: active
agent: codex
---

## Goal

Implement a deterministic Markdown-to-PDF profile layer for reusable PDF rendering configuration, mixed-language font control, cover pages, page chrome, page numbers, and concise metadata overrides.

This plan builds on the completed `md to-pdf` WeasyPrint workflow. It does not introduce Interactive mode or a Codex SDK helper.

## Why This Plan

The related research narrows the next Markdown PDF direction:

- keep the existing direct `md to-pdf` path useful without requiring a profile file
- add a built-in mini profile as the final fallback
- document YAML profiles first while accepting JSON profiles for automation
- keep profile fields declarative and reject unknown keys by default
- support basic mixed-language documents through ordered font fallback
- support advanced mixed-language control through document `lang`, `pdf.content-langs`, and explicit language-marked Markdown or HTML
- keep cover styles to `plain` and `report` in this plan
- keep page numbers disabled by default and avoid `{pages}` unless document-wide numbering is explicitly requested
- use repeatable `--meta key=value` for concise CLI metadata overrides
- introduce a shared `src/fonts/` module for cross-platform discovery and deterministic coverage checks
- fixture CJK, Latin-extended, RTL smoke, and Nerd Font cases without CI dependence on installed system fonts

This plan turns those decisions into an implementation sequence.

## Starting State

The repository already has the first deterministic Markdown PDF lane:

- `src/cli/commands/markdown.ts` exposes `md to-pdf` and `md pdf-template init`.
- `src/cli/actions/markdown.ts` contains `actionMdToPdf` and `actionMdPdfTemplateInit`.
- `src/cli/markdown-pdf/validation.ts` normalizes presets, page options, margins, ToC behavior, and remote-asset policy.
- `src/cli/markdown-pdf/recipe.ts` generates the built-in Pandoc template and print CSS.
- `src/cli/markdown-pdf/render.ts` orchestrates Pandoc and WeasyPrint rendering.
- `doctor` already reports the `md.to-pdf` capability through Pandoc and WeasyPrint checks.

There is no profile parser, no `--profile`, no `md pdf-profile init`, no page-chrome profile model, no reusable font module, and no mixed-language PDF fixture flow.

## Scope

### Profile input

- Add `--profile <path>` to `md to-pdf`.
- Accept `.yml`, `.yaml`, and `.json`.
- Generate YAML by default for human-authored profiles.
- Accept JSON for automation and generated-system input.
- Reject unknown extensions.
- Parse profiles into one normalized internal model.
- Fail when the parsed profile is not a plain object.
- Fail on unknown profile keys by default.
- Keep raw CSS out of profile values; raw CSS remains `--css <path>`.

### Profile materialization

- Add:

```bash
cdx-chores md pdf-profile init --output ./pdf-profile.yml
```

- Infer the output format from `.yml`, `.yaml`, or `.json`.
- Write the built-in mini profile by default.
- Support `--preset <article|report|wide-table|compact|reader>` to materialize profile values derived from the existing Markdown PDF renderer presets defined in `src/cli/markdown-pdf/validation.ts`.
- Require `--overwrite` when the profile output already exists.

### Option precedence

Use this order:

```text
CLI overrides
  -> explicit profile file
  -> preset values
  -> built-in mini profile fallback
```

The built-in mini profile keeps profile-free usage stable:

```yaml
page:
  size: A4
  orientation: portrait
  margin: 18mm

fonts:
  body:
    default: serif
  code:
    default: monospace

cover:
  enabled: false

header: {}
footer: {}

pageNumbers:
  enabled: false
```

### Metadata

- Prefer Markdown frontmatter for document-specific metadata.
- Use profile `metadata` as reusable defaults.
- Add repeatable `--meta key=value` as the concise CLI override path.
- Avoid one-off metadata flags such as `--company`, `--author`, `--subtitle`, and `--date`.
- Resolve metadata in this order:

```text
--meta key=value
  -> Markdown frontmatter
  -> profile metadata
  -> derived defaults
```

### Page chrome

- Add profile-controlled `header`, `footer`, and `pageNumbers` fields.
- Keep page numbers disabled by default.
- When page numbers are enabled, default to:

```yaml
pageNumbers:
  enabled: true
  position: bottom-center
  format: "{page}"
  scope: body
```

- Treat `{pages}` as document-wide total pages only.
- Do not make `{pages}` part of the recommended default format.
- Suppress normal header/footer and page numbers on cover pages.
- Keep ToC page chrome empty by default.
- Apply configured header/footer and page numbers to body pages only.

### Cover pages

- Render cover pages through the generated HTML/CSS recipe, not PDF post-processing.
- Start with only two built-in cover styles:
  - `plain`
  - `report`
- Fixture the first combinations:
  - `plain` portrait
  - `report` portrait
  - `report` landscape
- Keep `proposal`, `technical`, and broader style combinations out of scope.

### Fonts and mixed language

- Add a shared font module under `src/fonts/`.
- Keep profile font normalization separate from system font discovery.
- Keep font discovery separate from glyph coverage.
- Use platform-specific discovery adapters:

```text
src/fonts/
  types.ts
  discovery.ts
  coverage.ts
  adapters/
    macos.ts
    linux.ts
    windows.ts
    fontconfig.ts
```

- Treat OS discovery as candidate discovery, not proof of glyph support.
- Add deterministic glyph coverage checks or controlled sample checks.
- Support role-based profile fonts:
  - body
  - heading
  - code
  - page chrome, if needed by generated CSS
- Support language/script-specific body fonts:
  - `default`
  - `zh-Hant`
  - `zh-Hans`
  - `ja`
  - `ko`
- Support code-symbol checks for Nerd Font private-use glyphs.
- Treat CJK as the first-class mixed-language target in this plan.
- Add Latin-extended and RTL smoke cases to confirm the model is not CJK-only.
- Limit RTL smoke coverage to profile normalization and generated HTML/CSS behavior.
- Keep automatic language detection out of this plan.
- Use document-level `lang` as one primary language only.
- Use `pdf.content-langs` for expected mixed-language coverage.
- Use explicit Pandoc span attributes or raw HTML `lang` markup for exact language-specific font switching.

## Non-Goals

- no Interactive mode Markdown PDF profile flow
- no Codex SDK profile helper
- no AI-generated raw CSS
- no broad cover-theme system beyond `plain` and `report`
- no `proposal` or `technical` cover style in this plan
- no page numbers by default
- no body-only `{pages}` total without renderer evidence
- no automatic language detection or automatic language-span rewriting
- no deep RTL shaping or bidi layout guarantee in this plan
- no system-font-dependent CI tests
- no broad metadata flag surface

## Proposed Command Surface

Render with an explicit profile:

```bash
cdx-chores md to-pdf --input report.md --profile ./pdf-profile.yml
```

Render with concise metadata overrides:

```bash
cdx-chores md to-pdf \
  --input report.md \
  --profile ./pdf-profile.yml \
  --meta company="Example Co." \
  --meta author="Noname"
```

Materialize the default mini profile:

```bash
cdx-chores md pdf-profile init --output ./pdf-profile.yml
```

Materialize a report-flavored profile:

```bash
cdx-chores md pdf-profile init \
  --preset report \
  --output ./report-profile.yml
```

Materialize JSON for automation:

```bash
cdx-chores md pdf-profile init --output ./pdf-profile.json
```

## Architecture

### Profile module

Add a dedicated module under `src/cli/markdown-pdf/profile/`:

```text
src/cli/markdown-pdf/profile/
  defaults.ts
  parse.ts
  normalize.ts
  schema.ts
  serialize.ts
```

Responsibilities:

- define the normalized profile model
- define the built-in mini profile
- read `.yml`, `.yaml`, and `.json`
- serialize generated profile files
- validate profile keys and value types
- merge CLI overrides, profile, preset defaults, and mini profile defaults
- expose normalized recipe inputs to the existing recipe module

### Recipe integration

Extend `src/cli/markdown-pdf/recipe.ts` so generated template/CSS can use:

- metadata placeholders
- cover page HTML
- page-specific CSS for cover/body areas
- header/footer margin boxes
- opt-in page numbers
- role and language-specific font stacks

Keep generated recipe output deterministic and inspectable.

### Shared font module

Add `src/fonts/` as a shared module, not as a Markdown-only helper. The Markdown PDF profile code consumes this module, but the module must not depend on Markdown PDF profile types.

Initial responsibilities:

- list candidate font faces through platform adapters
- normalize family, full name, style, weight, path, format, and source
- inspect or mock glyph coverage for sample text
- report missing codepoints
- report likely Nerd Font glyph support for selected code samples

Phase 6 uses platform-command discovery as the selected strategy for this plan slice:

- macOS: `system_profiler SPFontsDataType -json`
- Linux/fontconfig: `fc-list --format ...`
- Windows: PowerShell registry read of installed font names/files

Discovery remains candidate discovery only. Family names alone are not proof of renderability, so glyph decisions use controlled coverage inventories and sample text. Font-file parser selection is deferred and out of scope for this plan slice.

### Action and command wiring

Extend `MdToPdfOptions` and command wiring with:

- `profile?: string`
- `meta?: string[]`

Add `MdPdfProfileInitOptions` and `actionMdPdfProfileInit`.

Keep `actionMdToPdf` as the orchestration boundary:

- resolve paths
- read input and frontmatter metadata
- load and normalize profile
- apply CLI metadata overrides
- generate the recipe
- call the existing Pandoc/WeasyPrint renderer
- print existing success and warning messages

## Phase Checklist

### Phase 1: Define profile model and validation

- [x] Add profile TypeScript types.
- [x] Add built-in mini profile defaults.
- [x] Add YAML and JSON profile parsing.
- [x] Add profile serialization.
- [x] Add unknown-key rejection.
- [x] Add `--meta key=value` parsing and validation.
- [x] Add merge order tests for CLI overrides, frontmatter, profile metadata, preset defaults, and mini profile fallback.

### Phase 2: Add profile command surface

- [x] Add `--profile <path>` to `md to-pdf`.
- [x] Add `md pdf-profile init`.
- [x] Infer generated profile format from output extension.
- [x] Reject unknown profile extensions.
- [x] Require `--overwrite` for existing profile outputs.
- [x] Add command and action tests for YAML and JSON profile inputs.

### Phase 3: Integrate page chrome and metadata

- [x] Generate header and footer CSS margin boxes from normalized profile fields.
- [x] Keep default header and footer empty in the mini profile.
- [x] Add opt-in `pageNumbers`.
- [x] Default page-number format to `{page}`.
- [x] Treat `{pages}` as document-wide only.
- [x] Suppress normal header/footer on cover pages.
- [x] Keep ToC page chrome empty by default.
- [x] Add fixture tests for no default page numbers and explicit page-number output.

### Phase 4: Add cover page recipe support

- [x] Generate cover HTML from metadata and cover profile fields.
- [x] Add `plain` cover style.
- [x] Add `report` cover style.
- [x] Support portrait and landscape output through existing page options.
- [x] Add fixtures for `plain` portrait, `report` portrait, and `report` landscape.
- [x] Keep broader cover styles out of scope.

### Phase 5: Add profile fonts and mixed-language CSS

- [x] Add role-based font profile normalization.
- [x] Generate default font fallback stacks.
- [x] Generate `:lang(...)` CSS for configured language-specific fonts.
- [x] Preserve Latin-first body font order unless the profile says otherwise.
- [x] Support `pdf.content-langs` from frontmatter/profile data.
- [x] Fixture Pandoc span attributes such as `[日本語]{lang=ja}`.
- [x] Add tests for language-marked HTML and generated CSS.
- [x] Keep this phase independent from real system font discovery.

### Phase 6: Add shared `src/fonts/` discovery and coverage

- [x] Add shared `src/fonts/` types.
- [x] Add platform discovery adapters for macOS, Linux, Windows, and fontconfig.
- [x] Choose and document the font-file parser or platform command strategy.
- [x] Add deterministic coverage checks for sample text.
- [x] Add mocked tests for missing CJK glyphs.
- [x] Add mocked tests for missing Nerd Font glyphs.
- [x] Avoid CI dependence on locally installed system fonts.

### Phase 7: Expand mixed-language fixtures

- [x] Keep `zh-Hant`, `zh-Hans`, `ja`, and `ko` as first-class fixture cases.
- [x] Add one Latin-extended smoke case, such as `vi` or `pl`.
- [x] Add one RTL smoke case, such as `ar` or `he`.
- [x] Keep Nerd Font code glyphs in a separate code-font fixture path.
- [x] Assert profile normalization and generated CSS for the expanded language set.
- [x] Avoid asserting renderer-specific RTL layout quality.
- [x] Keep all expanded fixture tests deterministic through mocked or controlled font inventory.

### Phase 8: Docs and verification

- [ ] Update the Markdown PDF usage guide with profile examples.
- [ ] Document YAML as the primary profile format and JSON as automation-compatible.
- [ ] Document fallback fonts as the basic path.
- [ ] Document language-marked spans as the advanced mixed-language path.
- [ ] Document CJK as the first-class mixed-language target and Latin-extended/RTL as smoke coverage.
- [ ] Document page-number defaults and `{pages}` constraints.
- [x] Add a job record when implementation starts.
- [x] Link completed implementation evidence back to this plan and the research doc before marking either complete.
- [x] Run focused Markdown PDF tests.
- [x] Run:

```text
bun run lint
bun run format:check
bun run build
git diff --check
```

## Implementation Evidence

Completed evidence is linked by slice:

- Phases 1-3: [Markdown to PDF Profile Phases 1-3](jobs/2026-05-07-markdown-to-pdf-profile-phases-1-3.md)
- Phases 4-5: [Markdown to PDF Profile Phases 4-5](jobs/2026-05-07-markdown-to-pdf-profile-phases-4-5.md)
- Phases 6-7: [Markdown to PDF Profile Phases 6-7](jobs/2026-05-07-markdown-to-pdf-profile-phases-6-7.md)

Phase 6-7 validation evidence:

- `bun test test/fonts.test.ts`
- `bun test test/cli-actions-md-to-pdf.test.ts`
- `bun test test/fonts.test.ts test/cli-actions-md-to-pdf.test.ts`
- `bun run lint`
- `bun run format:check`
- `bun run build`
- `git diff --check`

## Risks and Mitigations

- Risk: profile files silently ignore misspelled keys.
  Mitigation: fail on unknown keys by default and keep lenient parsing out of this plan.

- Risk: metadata flags become a bloated command surface.
  Mitigation: use repeatable `--meta key=value` instead of one flag per metadata field.

- Risk: page numbering surprises users when a cover page exists.
  Mitigation: keep page numbers disabled by default, default explicit page numbers to `{page}`, and reserve `{pages}` for document-wide totals.

- Risk: cover style combinations expand too quickly.
  Mitigation: start with `plain` and `report`, fixture both portrait and landscape through existing page orientation controls, and leave additional styles out of scope.

- Risk: font discovery differs across macOS, Linux, and Windows.
  Mitigation: keep platform adapters small, separate discovery from coverage, and make tests use controlled or mocked font inventory.

- Risk: CJK and Nerd Font support is inferred from family names instead of actual glyph coverage.
  Mitigation: add coverage checks based on font-file inspection or controlled samples and report missing codepoints.

- Risk: RTL smoke fixtures imply full bidi or shaping support.
  Mitigation: document RTL as profile/CSS smoke coverage only until renderer-specific layout evidence exists.

- Risk: automatic language detection creates incorrect spans or surprises document authors.
  Mitigation: keep language detection out of this plan and require explicit `lang` markup for exact font switching.

- Risk: raw CSS through profile fields becomes an execution or injection surface.
  Mitigation: keep profile values structured and leave raw CSS customization to explicit `--css` files.

## Related Research

- [Markdown to PDF Profiles, Fonts, and Page Chrome](../researches/research-2026-05-07-markdown-to-pdf-profiles-fonts-and-page-chrome.md)
- [Markdown to PDF with WeasyPrint](../researches/research-2026-05-06-markdown-to-pdf-weasyprint.md)
- [PDF Backend Comparison for Merge, Split, and Image Workflows](../researches/research-2026-02-25-pdf-backend-comparison-for-merge-split-and-image-workflows.md)

## Related Plans

- [Markdown to PDF WeasyPrint Implementation](plan-2026-05-06-markdown-to-pdf-weasyprint-implementation.md)
- [PDF CLI Workflows Implementation](plan-2026-03-11-pdf-cli-workflows-implementation.md)

## Related Jobs

- [Markdown to PDF Profile Phases 1-3](jobs/2026-05-07-markdown-to-pdf-profile-phases-1-3.md) - profile model, profile command surface, page chrome, metadata merge, and opt-in page-number implementation.
- [Markdown to PDF Profile Phases 4-5](jobs/2026-05-07-markdown-to-pdf-profile-phases-4-5.md) - cover recipe support, profile font normalization, mixed-language CSS, and language-marked fixture coverage.
- [Markdown to PDF Profile Phases 6-7](jobs/2026-05-07-markdown-to-pdf-profile-phases-6-7.md) - shared font module, platform command discovery adapters, deterministic coverage checks, and expanded mixed-language fixtures.
- [Markdown to PDF WeasyPrint Phases 1-5](jobs/2026-05-06-markdown-to-pdf-weasyprint-phases-1-5.md) - completed implementation evidence for the first deterministic Markdown PDF lane.
- [Markdown to PDF WeasyPrint Phase 6 Docs](jobs/2026-05-06-markdown-to-pdf-weasyprint-phase-6-docs.md) - completed public documentation and validation evidence for the first deterministic Markdown PDF lane.
