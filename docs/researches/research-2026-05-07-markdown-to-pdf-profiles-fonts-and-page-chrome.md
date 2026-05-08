---
title: "Markdown to PDF Profiles, Fonts, and Page Chrome"
created-date: 2026-05-07
modified-date: 2026-05-07
status: completed
agent: codex
---

## Goal

Extend the Markdown-to-PDF design discussion beyond the first WeasyPrint implementation by defining a deterministic PDF profile direction for fonts, mixed-language content, cover pages, headers, footers, and page numbers.

This research is completed. The related implementation plan and job records now provide evidence for the profile, font, mixed-language, page chrome, and documentation slices.

## Why This Research

The completed Markdown-to-PDF research established the first deterministic `md to-pdf` lane:

```text
Markdown input
  -> Pandoc standalone HTML
  -> WeasyPrint PDF
```

That first lane focuses on page settings, ToC behavior, template/CSS materialization, asset resolution, and `doctor` capability checks. The next design layer needs to answer repeatable document-branding and typography questions without jumping into Interactive mode or Codex SDK assistance.

The main follow-up questions are:

- how users should select and validate fonts
- how mixed-language content should map Latin, Chinese, Japanese, Korean, and code glyphs to appropriate fonts
- whether PDF-specific settings should live in a reusable profile file
- how cover pages, headers, footers, and page numbers should be configured
- how to fixture these behaviors without making tests depend on a developer's installed system fonts

## Scope

This research covers:

- a PDF profile concept for Markdown-to-PDF rendering
- supported profile file formats
- font roles, fallback behavior, language-specific font assignment, and glyph coverage checks
- document-level `lang`, additional content-language declarations, and explicit inline/block language markup
- cover page and page chrome configuration
- a small fixture strategy for mixed-language font behavior

This research does not implement:

- profile parsing
- font discovery
- language detection
- template/CSS generation changes
- new CLI commands
- Interactive mode
- Codex SDK helper flows

## Key Findings

### 1. Profiles should be declarative rendering configuration

The profile should answer one question:

```text
How should this Markdown document become a PDF?
```

It should stay structured and deterministic. Raw CSS should remain in explicit stylesheet files passed through `--css`, while the profile uses validated fields that the tool can turn into HTML/CSS recipe output.

Suggested shape:

```yaml
page:
  size: A4
  orientation: portrait
  margin: 18mm

fonts:
  body:
    default: "Source Serif 4"
    zh-Hant: "Noto Serif CJK TC"
    ja: "Noto Serif CJK JP"
    ko: "Noto Serif CJK KR"
  code:
    default: "JetBrains Mono"
    symbols: "JetBrainsMono Nerd Font"

cover:
  enabled: true
  style: report

metadata:
  company: Example Co.

header:
  left: "{company}"
  right: "{title}"

footer:
  center: ""

pageNumbers:
  enabled: false

toc:
  enabled: true
  depth: 3
```

The profile should layer above presets and below raw templates:

```text
CLI overrides
  -> explicit profile file
  -> preset values
  -> built-in mini profile fallback
  -> generated HTML/CSS recipe
  -> template/CSS low-level override
```

The built-in mini profile should be the final fallback so basic `md to-pdf` usage remains profile-free:

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

### 2. YAML is the current documented-default recommendation, with JSON accepted

Profile files should support both human-authored and machine-generated workflows.

Implemented format contract:

| Format | Role |
| --- | --- |
| `.yml` / `.yaml` | documented default and generated profile format |
| `.json` | accepted for automation and generated-system input |

The docs should primarily show YAML examples to avoid duplicate examples throughout the guide. JSON support can be documented as a short compatibility note.

Suggested commands:

```bash
cdx-chores md pdf-profile init --output ./pdf-profile.yml
cdx-chores md to-pdf --input report.md --profile ./pdf-profile.yml
cdx-chores md to-pdf --input report.md --profile ./pdf-profile.json
```

Implemented validation direction:

- reject unknown profile extensions
- parse the profile into one normalized internal model
- require the parsed profile to be a plain object
- reject executable behavior in profile values
- keep raw CSS customization in `--css`
- fail on unknown profile keys by default so typos do not silently change output
- consider a later `--lenient-profile` mode only if generated-system compatibility needs it

### 3. Basic mixed-language support should use font fallback

Most users should not need language markup. A well-ordered fallback stack should handle mixed content in common documents:

```css
body {
  font-family:
    "Source Serif 4",
    "Noto Serif CJK TC",
    "Noto Serif CJK JP",
    "Noto Serif CJK KR",
    serif;
}
```

This basic path is important because many documents contain short phrases, names, punctuation, or occasional CJK text where exact font assignment is less important than successful rendering.

The fallback order matters. If a CJK font appears first in the global body stack, Latin words may render in that CJK font. For Latin-first documents, the base body stack should usually start with the Latin font.

### 4. Advanced mixed-language control should use language-marked content

Fallback alone is not enough when users want Latin text in one font and Japanese, Korean, Traditional Chinese, or Simplified Chinese in separate fonts.

The advanced pattern should be:

1. Set one document-level language.
2. Declare additional expected content languages for validation and profile generation.
3. Mark specific mixed-language spans or blocks when exact font assignment matters.
4. Generate `:lang(...)` CSS from the profile.

Document-level `lang` should remain singular:

```yaml
---
lang: en-US
---
```

It maps cleanly to:

```html
<html lang="en-US">
```

The document-level language should not accept comma-separated values. HTML `lang` is a single language tag, and overloading it would make CSS `:lang(...)`, accessibility, hyphenation, quote rules, and renderer behavior less clear.

Additional expected languages should use a separate field:

```yaml
---
lang: en-US
pdf:
  content-langs:
    - zh-Hant
    - ja
    - ko
---
```

`content-langs` should prepare and validate the profile, but it should not imply exact language boundaries in the content. Exact font switching still needs language-marked Markdown or HTML.

Preferred Markdown syntax uses Pandoc span attributes:

```md
English text with [日本語]{lang=ja}, [한국어]{lang=ko}, and [繁體中文]{lang=zh-Hant}.
```

Raw HTML can remain the fallback syntax:

```md
English text with <span lang="ja">日本語</span>.
```

Generated CSS can then target language-specific content:

```css
body {
  font-family: "Source Serif 4", serif;
}

:lang(zh-Hant) {
  font-family: "Noto Serif CJK TC", "Source Serif 4", serif;
}

:lang(ja) {
  font-family: "Noto Serif CJK JP", "Source Serif 4", serif;
}

:lang(ko) {
  font-family: "Noto Serif CJK KR", "Source Serif 4", serif;
}
```

### 5. Font querying should be a shared module, not only `md to-pdf` flags

Font support should be reusable across PDF rendering and future document workflows.

Suggested module boundary:

```text
src/fonts/
  types.ts
  coverage.ts
  discovery.ts
  adapters/
    macos.ts
    linux.ts
    windows.ts
    fontconfig.ts
```

The module should answer:

- what fonts are available
- which font files/faces back a family name
- whether a font can render given sample text
- which scripts or language samples appear supported
- whether special coding glyph ranges, such as Nerd Font private-use glyphs, are present

The cross-platform design should separate discovery from coverage:

| Layer | Responsibility |
| --- | --- |
| macOS adapter | discover system font candidates through the platform registry or known font directories |
| Linux adapter | prefer `fontconfig` when available, with known-directory fallback |
| Windows adapter | discover fonts from known font directories and registry-compatible metadata where practical |
| coverage provider | inspect actual font files or controlled samples for glyph support |

Operating-system discovery should identify candidate faces, but it should not be treated as proof that a font can render a document. Glyph coverage checks need deterministic inspection or mocked fixtures so results are testable across platforms.

Suggested normalized model:

```ts
type FontFace = {
  family: string;
  fullName: string;
  style: "normal" | "italic" | "oblique";
  weight?: number;
  path?: string;
  format?: "ttf" | "otf" | "ttc" | "woff" | "woff2" | "unknown";
  source: "system" | "bundled" | "custom";
};

type FontCoverage = {
  supportsText: boolean;
  missingCodepoints: string[];
  scripts: string[];
  nerdFont: {
    detected: boolean;
    matchedRanges: string[];
  };
};
```

Implemented first CLI surface:

```bash
cdx-chores font list
cdx-chores font list --family "Noto Sans CJK TC"
cdx-chores font list --discovery native
cdx-chores font list --json --debug
```

`fonts` is accepted as an alias, but public docs should prefer the singular `font` command group.

Deferred command ideas, not implemented in this slice:

```bash
cdx-chores font inspect --family "Noto Sans CJK TC"
cdx-chores font check --family "Noto Sans CJK TC" --text "繁體中文 測試"
cdx-chores font check --family "JetBrainsMono Nerd Font" --text "git  main " --require nerd
```

`inspect` and `check` require a later command plan because the completed slice only exposes candidate discovery and diagnostics through `font list`. Glyph coverage exists as a deterministic internal capability for Markdown-to-PDF profile checks and tests, not as a public `font check` command.

For Markdown-to-PDF, the profile should consume this capability through warnings or failures:

```text
Warning: selected code font does not appear to support Nerd Font glyphs: U+E0B0, U+F418
Warning: selected body font may not cover zh-Hant text in this document
```

Suggested check modes:

| Mode | Behavior |
| --- | --- |
| `off` | do not analyze profile font coverage |
| `warn` | warn about likely missing glyph/script coverage |
| `strict` | fail before rendering when required coverage is missing |

### 6. Cover pages fit profile-driven HTML/CSS better than PDF post-processing

The implemented direction keeps cover pages in the generated recipe model. That means rendering them as part of the Pandoc HTML and WeasyPrint CSS flow instead of adding a separate PDF post-processing step:

```html
<section class="pdf-cover">
  ...
</section>

<main class="pdf-body">
  ...
</main>
```

```css
.pdf-cover {
  page: cover;
  break-after: page;
}

@page cover {
  margin: 0;
}

@page {
  margin: 18mm 16mm;
}
```

Cover data should come from frontmatter and profile fields:

```yaml
---
title: Quarterly Engineering Report
subtitle: Runtime and CLI Operations
author: Dev Pi2Pie
company: Example Co.
date: 2026-05-07
---
```

Suggested profile controls:

```yaml
cover:
  enabled: true
  style: report
  fields:
    title: "{title}"
    subtitle: "{subtitle}"
    author: "{author}"
    company: "{company}"
    date: "{date}"
```

Initial built-in cover styles:

- `plain`
- `report`

The first profile slice should avoid `proposal` and `technical` because style and orientation combinations can grow quickly. The fixture set should instead prove:

- `plain` portrait
- `report` portrait
- `report` landscape

### 7. Headers, footers, and page numbers fit paged-media fields

The implemented direction keeps page chrome in the profile because users often need company names, authors, document titles, dates, or page numbers on every page.

Suggested profile controls:

```yaml
header:
  left: "{company}"
  center: ""
  right: "{title}"

footer:
  left: "{author}"
  center: ""
  right: "{date}"

pageNumbers:
  enabled: false
```

Generated CSS can use WeasyPrint paged-media margin boxes:

```css
@page {
  @top-left {
    content: "Example Co.";
  }

  @top-right {
    content: "Quarterly Engineering Report";
  }

  @bottom-center { content: ""; }
}
```

The placeholder set should stay small and deterministic:

| Placeholder | Meaning |
| --- | --- |
| `{title}` | Markdown frontmatter title or derived document title |
| `{subtitle}` | Markdown frontmatter subtitle |
| `{author}` | Markdown frontmatter author or CLI/profile override |
| `{company}` | Markdown frontmatter company or CLI/profile override |
| `{date}` | Markdown frontmatter date or render date policy |
| `{page}` | current PDF page number |
| `{pages}` | total PDF page count, only for document-wide numbering |

Page numbers should be off by default. When enabled, the first recommended slice should avoid total-page defaults:

```yaml
pageNumbers:
  enabled: true
  position: bottom-center
  format: "{page}"
  scope: body
```

Recommended first behavior:

| Area | Default page chrome |
| --- | --- |
| cover | no header, footer, or visible page number |
| ToC | no body header/footer; page number only when explicitly enabled and included by the chosen scope |
| body | configured header/footer; page number only when explicitly enabled |

`{pages}` should not be part of the default page-number format. It is safe for document-wide numbering, but body-only totals become ambiguous when cover and ToC pages exist. A later implementation can add body-only total pages only after WeasyPrint fixture evidence proves it can be done without a second PDF pass or surprising counter behavior.

Metadata should come from Markdown frontmatter first for document-specific values, with profile metadata available as reusable defaults and concise CLI overrides available when a command invocation needs to replace a value. Avoid adding many one-off flags such as `--company`, `--author`, `--subtitle`, and `--date`.

Preferred CLI override shape:

```bash
cdx-chores md to-pdf \
  --input report.md \
  --meta company="Example Co." \
  --meta author="Noname"
```

Resolution order:

```text
--meta key=value
  -> Markdown frontmatter
  -> profile metadata
  -> derived defaults
```

## Fixture Direction

Mixed-language font behavior needs a small fixture flow that avoids depending on the current machine's installed fonts.

Suggested fixtures:

```text
test/fixtures/docs/markdown-to-pdf-mixed-langs.md
test/fixtures/docs/markdown-to-pdf-mixed-langs-profile.yml
test/fixtures/docs/markdown-to-pdf-mixed-langs-profile.json
test/fixtures/docs/markdown-to-pdf-mixed-langs.expected.css
```

Suggested Markdown fixture:

```md
---
title: Mixed Language Font Fixture
lang: en-US
pdf:
  content-langs:
    - zh-Hant
    - ja
    - ko
---

# Mixed Language Font Fixture

Latin text should use the default body font.

Traditional Chinese: [繁體中文測試]{lang=zh-Hant}

Japanese: [日本語の文章]{lang=ja}

Korean: [한국어 문장]{lang=ko}

Code symbols: `git  main `
```

Suggested YAML profile fixture:

```yaml
page:
  size: A4
  orientation: portrait
  margin: 18mm

fonts:
  body:
    default: "Source Serif 4"
    zh-Hant: "Noto Serif CJK TC"
    ja: "Noto Serif CJK JP"
    ko: "Noto Serif CJK KR"
  code:
    default: "JetBrains Mono"
    symbols: "JetBrainsMono Nerd Font"
```

Stable tests should assert generated profile normalization, HTML, and CSS behavior rather than real system font availability:

- YAML and JSON profiles normalize to the same internal model
- the built-in mini profile resolves when no explicit profile is provided
- document-level `lang: en-US` maps to `<html lang="en-US">`
- Pandoc span attributes preserve language-marked spans
- generated CSS includes `:lang(zh-Hant)`, `:lang(ja)`, and `:lang(ko)`
- global body font stack keeps the Latin default first
- CJK fonts are not blindly promoted ahead of the Latin body font
- code font stack includes the selected Nerd Font candidate
- mocked font coverage can warn or fail for missing CJK or Nerd Font glyph coverage
- cover style fixtures cover `plain` portrait, `report` portrait, and `report` landscape
- default page chrome does not emit page numbers
- explicit page numbers use `{page}` by default and avoid `{pages}` unless document-wide numbering is requested

Optional WeasyPrint smoke coverage should run only when renderer/font availability is controlled. The reliable core fixture should not require a specific system font installation on every developer machine or CI environment.

## Implemented Direction

The implemented profile direction introduces a PDF profile concept as a follow-up to the deterministic Markdown-to-PDF lane:

```bash
cdx-chores md to-pdf --input report.md --profile ./pdf-profile.yml
```

Implemented profile stance:

- document YAML first
- accept JSON for automation
- keep profile fields structured and declarative
- keep raw CSS in explicit stylesheet files
- keep document-level `lang` singular
- use `pdf.content-langs` for expected mixed-language coverage
- support language-marked Markdown/HTML for exact mixed-language font assignment
- make font coverage checks deterministic and mockable
- provide a built-in mini profile fallback
- keep cover styles to `plain` and `report` in the first profile slice
- keep page numbers disabled by default
- use repeatable `--meta key=value` for concise CLI metadata overrides
- fail on unknown profile keys by default
- defer Interactive mode and Codex SDK helper behavior

Completed first-slice recommendations:

- `pdf.content-langs` can be represented in frontmatter/profile data; no CLI `--content-langs` convenience is required for this slice.
- ToC pages should not inherit body headers by default.
- Cover styles start with `plain` and `report`.
- Metadata comes from frontmatter first, with profile metadata as reusable defaults and repeatable `--meta key=value` overrides.
- The default mini profile emits no page numbers.

## Final Recommendations

1. Profile unknown keys should fail by default.
2. ToC pages should avoid body headers by default; page numbers remain opt-in.
3. Built-in cover styles should start with `plain` and `report`.
4. Metadata should primarily come from frontmatter, with profile metadata as reusable defaults and repeatable `--meta key=value` as the concise CLI override path.
5. Font work should use a cross-platform module with platform discovery adapters and deterministic coverage checks. The first implementation slice selected platform-command discovery; font-file parser selection is deferred and remains out of scope for that slice.
6. Font command follow-up work should use `--discovery auto|native|fontconfig` for discovery selection and `font list --debug` for command-run diagnostics; broader dependency checks stay with the existing top-level `doctor` command.
7. `font inspect` and `font check` should be treated as a pre-Codex-Helper checkpoint: inspect discovered metadata first, choose the coverage-provider strategy next, then expose text/glyph checks before Helper tries to suggest profile fixes.

## Related Research

- [Markdown to PDF with WeasyPrint](research-2026-05-06-markdown-to-pdf-weasyprint.md) - completed first-lane research for deterministic Markdown-to-PDF rendering through Pandoc HTML and WeasyPrint.
- [Font Command Discovery Options](research-2026-05-07-font-command-discovery-options.md) - follow-up research for `font list` diagnostics, discovery selection, and platform-specific adapter behavior.
- [Font Inspect and Check Commands](research-2026-05-07-font-inspect-and-check-commands.md) - draft checkpoint for adding `font inspect` and `font check` before Codex Helper font assistance.
- [PDF Backend Comparison for Merge, Split, and Image Workflows](research-2026-02-25-pdf-backend-comparison-for-merge-split-and-image-workflows.md) - related PDF backend context for the separate `pdf` command group.

## Related Plans

- [Markdown to PDF Profiles, Fonts, and Page Chrome Implementation](../plans/plan-2026-05-07-markdown-to-pdf-profiles-fonts-and-page-chrome-implementation.md) - completed implementation plan for the profile layer described by this research.
- [Markdown to PDF WeasyPrint Implementation](../plans/plan-2026-05-06-markdown-to-pdf-weasyprint-implementation.md) - implementation plan for the first deterministic `md to-pdf` workflow.
- [PDF CLI Workflows Implementation](../plans/plan-2026-03-11-pdf-cli-workflows-implementation.md) - related draft plan for PDF-native workflows.

## Related Jobs

- [Markdown to PDF Profile Phases 1-3](../plans/jobs/2026-05-07-markdown-to-pdf-profile-phases-1-3.md) - first profile implementation slice for profile parsing, command surface, metadata merge, page chrome, and opt-in page numbers.
- [Markdown to PDF Profile Phases 4-5](../plans/jobs/2026-05-07-markdown-to-pdf-profile-phases-4-5.md) - cover recipe support, profile font normalization, mixed-language CSS, and language-marked fixture coverage.
- [Markdown to PDF Profile Phases 6-7](../plans/jobs/2026-05-07-markdown-to-pdf-profile-phases-6-7.md) - shared font module, initial `font list` command, platform command discovery adapters, deterministic coverage checks, and expanded mixed-language fixtures.
- [Markdown to PDF Profile Phase 8 Docs](../plans/jobs/2026-05-07-markdown-to-pdf-profile-phase-8-docs.md) - public profile guide, README alignment, status closeout, and final validation evidence.
- [Markdown to PDF WeasyPrint Phases 1-5](../plans/jobs/2026-05-06-markdown-to-pdf-weasyprint-phases-1-5.md) - implementation, renderer, asset policy, tests, and `doctor` evidence for the first deterministic Markdown-to-PDF lane.
- [Markdown to PDF WeasyPrint Phase 6 Docs](../plans/jobs/2026-05-06-markdown-to-pdf-weasyprint-phase-6-docs.md) - public guide, README alignment, status closeout, and final validation evidence for the first lane.
