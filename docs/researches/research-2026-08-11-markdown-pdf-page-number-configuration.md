---
title: "Markdown PDF Page-Number Configuration"
created-date: 2026-08-11
status: draft
agent: codex
---

## Goal

Define a deterministic, user-facing page-number contract for `md to-pdf`
across Profile YAML/JSON, generated HTML, generated CSS, direct CLI overrides,
Interactive authoring, custom Template compatibility, and current guide docs.

The contract should add explicit visibility and sequence controls, preserve the
current cover-counting behavior by default, allow an explicit body-relative
sequence, make page-number wording and page-chrome layout reviewable, and avoid
assigning Profile-owned render policy to Template generation.

## Research At A Glance

The current implementation supports opt-in page numbers with a position,
format string, and body-only scope. It hides page chrome on cover and ToC pages,
but it does not expose the counter start, counter increment, document-wide
visibility, footer layout, or slot-collision behavior as dedicated contracts.

The proposed contract separates where numbers are visible (`scope`) from where
the logical sequence begins (`countFrom`). `countFrom: document` preserves the
current hidden-but-counted cover and front-matter behavior, while
`countFrom: body` starts the configured sequence at the first body page. The
contract also supports literal `start: 0`, uses the arithmetic name
`increment`, and preserves the existing `format` key and short placeholders.
Warning-backed fallbacks cover occupied page-number slots and legacy custom
Templates when document-origin inference remains safe. Body-origin numbering
requires a provable `.document-body` boundary and fails clearly when it is
missing. The first slice uses bounded header/footer style fields, the stable
body hook, and direct enable/disable overrides only. Renderer baselines are
selected by the pinned compatibility-smoke design below rather than by
unresolved version guesses. The resulting proposed shape is:

```yaml
fonts:
  pageChrome:
    default: "Inter"

footer:
  left: "{company}"
  right: "{date}"
  style:
    fontSize: 8.5pt
    fontWeight: 400
    lineHeight: 1.2
    color: "#667085"
    separator:
      width: 0.5pt
      style: solid
      color: "#d0d5dd"
      gap: 2mm

pageNumbers:
  enabled: true
  scope: body
  countFrom: body
  start: 0
  increment: 2
  position: bottom-center
  format: "Page {page}"
```

This shape is a research direction, not a shipped schema. The renderer CSS and
minimum WeasyPrint version for accepted advanced controls still require the
recorded smoke results before implementation, but the versions, fixtures, and
decision rule are defined below. The fallback behavior recorded below is a
design requirement, but it is not shipped until implementation and tests prove
it.

## Scope

This research covers:

- the normalized Markdown PDF Profile schema and YAML/JSON serialization
- direct `md to-pdf` page-number overrides and precedence
- Interactive Profile authoring and review
- page-number sequence, visibility, wording, position, and typography
- header/footer slot ownership and collision handling
- built-in and generated Template HTML hooks needed by Profile CSS
- WeasyPrint page counters, named pages, page groups, and margin boxes
- cover, front matter, ToC, and body-page behavior
- compatibility and migration from the current Profile contract
- deterministic CSS and real-render fixture validation
- updates to existing Markdown PDF guides and helper contracts

This research does not:

- change the PDF viewer's physical page index or PDF page-label metadata
- define arbitrary user-authored CSS inside the Profile
- move page-number policy into Template-Codex
- promise a body-only total-page counter without renderer or second-pass proof
- own the repository-wide pattern and template language guide

The cross-feature language inventory and new guide are owned by
[Pattern, Placeholder, and Template Language Guide][pattern-language-research].

## Current Shipped Contract

### Profile Shape

The normalized page-number Profile currently contains:[^profile-types]

```ts
interface NormalizedMarkdownPdfPageNumbers {
  enabled: boolean;
  position:
    | "top-left"
    | "top-center"
    | "top-right"
    | "bottom-left"
    | "bottom-center"
    | "bottom-right";
  format: string;
  scope: "body";
}
```

Defaults are:[^profile-defaults]

```yaml
pageNumbers:
  enabled: false
  position: bottom-center
  format: "{page}"
  scope: body
```

Unknown Profile keys fail validation, so adding any new field requires schema,
normalization, defaults, serialization, Codex patch-path, and test updates.[^profile-schema]

### Page-Chrome Content

The Profile currently exposes three header slots and three footer slots:

```yaml
header:
  left: "{company}"
  center: ""
  right: "{title}"

footer:
  left: "{author}"
  center: ""
  right: "{date}"
```

Page numbers select one of the same six CSS page-margin boxes. When enabled,
the current generator replaces the selected header/footer slot with
`pageNumbers.format`. A non-empty user value in that slot is silently lost.[^page-chrome-source]

The content parser treats `{page}` and `{pages}` as reserved page counters and
resolves other accepted brace tokens from merged metadata. Profile metadata,
Markdown frontmatter, and repeatable `--meta key=value` values merge in this
precedence order:

```text
--meta key=value
  -> Markdown frontmatter
  -> profile metadata
```

Unknown metadata placeholders currently resolve to an empty string. Cover
fields use a separate metadata-only resolver, so the brace language is not yet
one unified Profile placeholder contract.[^placeholder-source]

### Generated HTML And CSS

The built-in HTML order is:[^recipe-source]

```text
cover
metadata title block
ToC
main body
```

Generated Profile CSS writes ordinary header/footer/page-number content into
`@page` margin boxes. Named `@page cover` and `@page toc` rules clear all six
boxes. Clearing the visible boxes does not remove those pages from the physical
page counter.

The current `fonts.pageChrome.default` setting changes the font family inherited
by page-margin boxes. There are no dedicated Profile settings for page-chrome
font size, weight, line height, color, padding, or separators.[^font-source]

### Current Evidence Map

| Current claim                                | Source evidence                            | Test evidence                              |
| -------------------------------------------- | ------------------------------------------ | ------------------------------------------ |
| Profile fields and defaults                  | types, defaults, schema, and normalization | Profile normalization tests                |
| page-number content and slot replacement     | page-chrome CSS generator                  | recipe page-chrome tests                   |
| cover and ToC margin-box clearing            | cover and page-chrome CSS generators       | cover and ToC recipe assertions            |
| built-in cover/title/ToC/body order          | built-in recipe template                   | recipe template tests                      |
| Template-Codex required structural hooks     | Template-Codex family contract             | Template-Codex family and validation tests |
| direct CLI has no page-number-specific flags | `md to-pdf` command registration           | command option tests                       |

These sources establish the current implementation boundary. They do not prove
the proposed sequence-origin reset, increment, document visibility, or footer
layout; those remain subject to the renderer validation plan below.[^recipe-tests]

## Proposed Page-Number Contract

The contract has four parts: the logical sequence, visibility, label placement,
and inherited page-chrome style. They combine in this order:

```text
pageNumbers
|
+-- logical sequence
|   +-- countFrom: document | body   where the sequence begins
|   +-- start: integer >= 0          first logical value
|   `-- increment: integer >= 1      value added per sequence page
|                         |
|                         v
|                 logical value for each page
|
+-- visibility
|   +-- scope: body | document       where a value may be shown
|   `-- cover exception              cover pages are always hidden
|                         |
|                         v
|                 shown or hidden logical value
|
+-- label and placement
|   +-- format                       renders the shown value as text
|   `-- position                     selects one of six margin-box slots
|                         |
|                         v
|                 page-number text in a page-chrome slot
|
`-- inherited appearance
    +-- selected header/footer style
    +-- fonts.pageChrome
    `-- renderer defaults
```

These controls do not change physical PDF page indices, PDF page-label
metadata, or the physical page total exposed by `{pages}`.

### Numbering Model

The proposed values and defaults are:

| Field       | Proposed values      | Default    | Responsibility              |
| ----------- | -------------------- | ---------- | --------------------------- |
| `scope`     | `body` or `document` | `body`     | page-number visibility      |
| `countFrom` | `document` or `body` | `document` | logical sequence origin     |
| `start`     | integer `>= 0`       | `1`        | first value in the sequence |
| `increment` | integer `>= 1`       | `1`        | per-page arithmetic step    |

`scope` and `countFrom` are independent layers. `scope` decides whether a
logical value is printed; `countFrom` decides which pages participate in the
logical sequence. `scope: document` means all eligible non-cover pages because
the cover remains a protected visibility exception.

The supported combinations are:

| `scope`    | `countFrom` | Cover and pre-body pages                 | Body pages                         |
| ---------- | ----------- | ---------------------------------------- | ---------------------------------- |
| `body`     | `document`  | hidden; advance document-wide sequence   | shown; continue sequence           |
| `body`     | `body`      | hidden; outside body-relative sequence   | shown; begin at `start`            |
| `document` | `document`  | cover hidden; eligible later pages shown | shown; continue sequence           |
| `document` | `body`      | invalid configuration                    | would expose pages without a value |

`scope: document` with `countFrom: body` must fail validation. It would expose
eligible pre-body pages while declaring that they have no logical value.

With a one-page cover, one-page ToC, `start: 1`, and `increment: 1`, the two
sequence origins behave as follows. Visibility still follows the independently
selected `scope`:

```text
                         countFrom: document     countFrom: body
Cover                    logical 1, hidden       outside sequence, hidden
ToC page                 logical 2, scope rules  outside sequence, hidden
First body page          logical 3, shown        logical 1, shown
Second body page         logical 4, shown        logical 2, shown
```

`countFrom: document` preserves the current hidden-but-counted behavior.
`countFrom: body` starts a genuinely body-relative sequence, regardless of how
many cover, title, or ToC pages precede the body.

Legacy custom Templates without a reliable body-start hook retain a warning
fallback under document origin. Body origin must fail before rendering when the
body boundary cannot be proven; it must not guess where to reset the sequence.

#### Start And Increment

`start` is the first value in the selected sequence. Zero is a literal value,
not a disabled sentinel. `increment` is the amount added on every page in that
sequence; it does not mean “show a number every N pages.”

```yaml
pageNumbers:
  scope: body
  countFrom: body
  start: 0
  increment: 2
```

```text
Cover         outside sequence   hidden
ToC page      outside sequence   hidden
Body page 1   logical 0          shown
Body page 2   logical 2          shown
Body page 3   logical 4          shown
```

Using `start: 0` with document origin does not make the cover uncounted; it only
assigns zero to the cover. Body-relative numbering requires
`countFrom: body`.

A negative or fractional `start`, and a non-positive or fractional `increment`,
must fail validation rather than being clamped.

### Label And Placement

#### Format

The existing `format` key remains canonical and means the page-number label
template. Example alternatives include `{page}`, `Page {page}`, `第 {page} 頁`,
and `— {page} —`.

Renaming the key would add migration complexity without adding capability.
Documentation should call it the “page-number label template” while retaining
`format`. The first slice keeps it Profile-only, with `{page}` as its default.

In this contract, `{pages}` retains its physical PDF page-count meaning. It is
not a logical final page number when arithmetic is customized or body origin
excludes pre-body pages. For example:

```text
countFrom: document
start: 0
increment: 2
physical pages: 5

possible final label: Page 8 of 5
```

The CLI should therefore warn when `{pages}` is combined with non-default
arithmetic or `countFrom: body`. The value remains accepted, but `{page}`-only
wording is the recommended default. A logical final-number placeholder remains
unsupported until separate renderer or second-pass evidence exists.

#### Position And Collisions

The existing position vocabulary remains unchanged:

```text
top-left       top-center       top-right
bottom-left    bottom-center    bottom-right
```

When the selected slot already contains header or footer content, the page
number retains the current page-number-wins behavior. The CLI must warn with the
position and conflicting slot, but it must not relocate either value. Changing
this to a hard collision error would require a separate major-version policy.

### Page-Chrome Styling

Text and layout remain separate. Cover, header, footer, and page-number
templates produce text; typed Profile settings control page-chrome appearance;
Markdown frontmatter supplies metadata; and custom CSS remains the lower-level
path for arbitrary presentation.

The first slice proposes the same typed `style` shape for `header` and `footer`.
Page-number typography inherits from the area selected by `position`, followed
by `fonts.pageChrome` and renderer defaults. It does not propose
`pageNumbers.style`.

```yaml
footer:
  right: "{date}"
  style:
    fontSize: 8.5pt
    fontWeight: 400
    lineHeight: 1.2
    color: "#667085"
    separator:
      width: 0.5pt
      style: solid
      color: "#d0d5dd"
      gap: 2mm
```

The same `style` shape is available under `header`. The proposed first-slice
fields are `fontSize`, `fontWeight`, `lineHeight`, `color`, and the structured
separator fields `width`, `style`, `color`, and `gap`. Omitting `separator`
disables it. `gap` is the distance between the area text and its separator,
whether the separator sits below a header or above a footer.

`fontFamily` remains owned by `fonts.pageChrome`. Explicit dimensions, offsets,
positional padding, raw CSS, and page-number-specific style remain outside the
typed surface. The separator remains evidence-gated until renderer fixtures fix
its span and empty-area behavior.

## Placeholder-Language Compatibility Direction

The current short form is convenient:

```yaml
footer:
  left: "{company}"

pageNumbers:
  format: "Page {page}"
```

A namespaced form could reserve ownership more clearly in a future additive
extension:

```yaml
footer:
  left: "{meta.company}"

pageNumbers:
  format: "Page {page.number}"
```

Candidate namespaces include:

| Namespace    | Candidate meaning                        |
| ------------ | ---------------------------------------- |
| `meta.*`     | merged Profile/frontmatter/CLI metadata  |
| `page.*`     | logical page-number state                |
| `document.*` | renderer-derived physical document facts |

The first slice preserves the current short placeholders, including `{page}`,
`{pages}`, `{title}`, and `{company}`. It does not force users to migrate to a
namespace. If namespaced forms such as `{page.number}`,
`{document.pageCount}`, or `{meta.company}` are introduced later, they must be
additive aliases while the corresponding short forms remain supported.

The implementation already accepts dots in placeholder names, but nested
frontmatter is not flattened. A user can therefore already have a literal
metadata key such as `meta.company`. Future namespace support must define how
that literal key and a reserved namespace interact; it must not silently
reinterpret existing dotted metadata. Namespaces require an explicit resolver
and collision contract rather than relying on current metadata lookup.

The first slice preserves the current resolver behavior rather than adding a
new language:

- page chrome reserves exactly `{page}` and `{pages}`
- every other valid token, including a dotted name, is a literal metadata key
- a missing metadata value resolves to an empty string
- braces that do not match the current token grammar remain literal text
- there is no supported escape for rendering a literal reserved token
- cover fields keep their current metadata-only resolver; resolver unification
  is outside this feature

Namespaced paths and a shared literal-brace escape may be considered later by
the cross-feature language work. They must not block page-number configuration
or silently reinterpret existing dotted metadata keys.

The cross-feature research should consume this result and compare it with the
strict rename template and data glob contracts.

## Compatibility And Breaking-Change Review

The proposed behavior is mostly additive. Its remaining compatibility boundary
comes from Profiles that actually contain newly introduced fields:

| Change                                       | Compatibility posture                                                         |
| -------------------------------------------- | ----------------------------------------------------------------------------- |
| Add `start` and `increment`                  | additive when omitted defaults preserve current numbering                     |
| Add `scope: document`                        | additive opt-in                                                               |
| Add `countFrom: body`                        | additive opt-in body-relative sequence                                        |
| Default `countFrom: document`                | preserves current hidden-but-counted cover and front-matter behavior          |
| Reject `scope: document`, `countFrom: body`  | new-field combination fails instead of producing undefined pre-body numbers   |
| Keep `format` as the wording-template key    | preserves the current schema and avoids a no-capability rename                |
| Preserve page-number-wins slot behavior      | current output remains; a new warning exposes the collision                   |
| Add header/footer `style`                    | additive schema expansion                                                     |
| Preserve short placeholders                  | compatible; any future namespaces must be additive aliases                    |
| Preserve physical meaning of `{pages}`       | compatible; non-default arithmetic or body origin adds a warning              |
| Infer legacy custom-Template body pages      | document-origin compatibility warning until Templates provide the stable hook |
| Require body hook for `countFrom: body`      | new opt-in field fails rather than guessing a sequence reset                  |
| Fail unsupported effective advanced controls | existing behavior remains when no advanced page-number controls are requested |

The implementation plan should not describe the whole feature as either
breaking or non-breaking. It should state the exact compatibility posture for
each row and include fixtures for old Profiles. Keeping `format` removes the
otherwise unnecessary key-renaming boundary; old CLIs can still reject Profiles
that actually use newly added fields such as `start`, `increment`, or
`countFrom`.

### Diagnostic And Fallback Contract

Warnings are successful diagnostics, not partial failures. In the plain CLI,
they should be written to `stderr` and leave the successful exit status at
zero. They should be emitted once per rendered document and condition, never
once per physical page. Interactive output should show the same diagnostic once
in its result or review surface. A JSON or report mode must carry warnings in a
structured diagnostics collection and must not mix warning prose into a
machine-readable `stdout` payload; the exact result field should follow the
existing command-result convention identified during planning.

Hard configuration or capability errors should use the command's normal
nonzero failure path and structured error representation. The operational
matrix is:

| Condition                                                           | Result     | Diagnostic frequency                       |
| ------------------------------------------------------------------- | ---------- | ------------------------------------------ |
| `{pages}` with non-default arithmetic or `countFrom: body`          | success    | one warning per document                   |
| selected page-number slot already contains configured content       | success    | one warning for the selected slot/document |
| `scope: body`, `countFrom: document` uses legacy Template inference | success    | one warning per document                   |
| `countFrom: body` has no provable body-start hook                   | hard error | once, before rendering                     |
| renderer lacks an effectively requested advanced control            | hard error | once, before rendering                     |

Renderer gating is based on effective behavior after valid Profile and CLI
precedence, not merely on whether a default-valued key was written. The first
capability matrix is:

| Effective control                                         | Renderer posture                                                  |
| --------------------------------------------------------- | ----------------------------------------------------------------- |
| enable/disable, six positions, format text, `scope: body` | retain the existing render path                                   |
| `countFrom: document`, `start: 1`, `increment: 1`         | baseline; no advanced gate                                        |
| `start` other than `1`                                    | require the proven reset baseline for the selected origin or fail |
| `increment` other than `1`                                | require the proven counter-increment baseline or fail             |
| `scope: document`                                         | require the proven named-page/margin-box baseline or fail         |
| `countFrom: body`                                         | require the proven first-body reset/repagination baseline or fail |
| accepted non-default header/footer style field            | require that field's recorded renderer baseline or fail           |
| legacy body inference under `countFrom: document`         | warning fallback; it does not bypass any renderer capability gate |
| missing body hook under `countFrom: body`                 | hard error; do not approximate the reset boundary                 |

Every style field accepted after renderer research must be added to this
capability table with evidence. There is no generic “best effort” CSS fallback
for an explicitly requested advanced control.

## HTML, CSS, And Template Audit Requirements

Implementation should review every layer that can affect page chrome:

### Profile YAML And JSON

- schema allowlists
- normalization and defaults, including zero-preserving `start` handling
- serialization from `pdf-profile init`
- Profile-Codex patch paths and adapter schema
- Project/Profile artifact preservation
- direct CLI override precedence
- Interactive starter, formal-guide, and Codex paths

### Generated HTML

- built-in cover, metadata title, ToC, and `<main>` order
- named-page hooks for cover and ToC
- `.document-body` on the built-in and generated `<main>` element; the current
  Template-Codex output already emits the class, while its required-hook
  validator still needs to adopt it alongside `$body$`, title and ToC
  conditionals, `$toc$`, and `#TOC`[^template-contract]
- legacy custom Template warning inference under `countFrom: document`
- hard failure for `countFrom: body` when no body-start hook can be proven
- multi-page cover content and unexpected overflow

The audit inventory is:

| Page kind             | Current hook or page rule                     | Required behavior                                                |
| --------------------- | --------------------------------------------- | ---------------------------------------------------------------- |
| generated cover       | `.pdf-cover` with named `cover` page          | always hidden; advances only under `countFrom: document`         |
| metadata title output | `.document-title`; no named page group        | eligible under document visibility; pre-body for sequence origin |
| generated ToC         | `#TOC` with named `toc` page                  | visibility follows `scope`; pre-body for sequence origin         |
| document body         | built-in `<main>`; generated `.document-body` | stable visibility hook and `countFrom: body` reset boundary      |
| custom Template pages | required Pandoc hooks, no body page name      | warning inference for document origin; body origin requires hook |

### Generated CSS

The current generator emits ordinary page chrome globally and clears all six
boxes on named ToC pages; cover CSS separately clears the named cover page. The
new contract therefore requires actual scope and sequence branches. Fixtures
must determine the named-page selectors, rule order, and specificity without
restoring unrelated ToC headers or footers.

- document-origin page-counter reset and increment
- first-body reset and increment for `countFrom: body`
- cover visibility suppression with sequence behavior owned by `countFrom`
- selective `body` versus `document` page-number rules
- ToC page-number restoration without body header/footer restoration
- all six positions
- area-level typography and separator emission
- occupied-slot warning while preserving page-number-wins emission
- stylesheet precedence with Template and user CSS

CSS Paged Media permits explicit page-counter reset and increment values. The
exact WeasyPrint cascade still requires real-render fixtures for both sequence
origins rather than inference from generated CSS alone.[^css-page]

### Renderer And PDF Output

- installed WeasyPrint version and capability-specific baselines
- document-first and body-first reset semantics for `start: 0`
- increments greater than one
- single-page and multi-page cover behavior under both sequence origins
- ToC visibility under both scopes
- variable-length ToC exclusion under `countFrom: body`
- physical `{pages}` behavior
- text extraction and visual footer placement
- page-margin-box typography and separator behavior, including span and empty
  areas, across portrait, landscape, and compact margins[^weasyprint-css]
- confirmation that PDF viewer page labels are unchanged

If the user does not request any new page-number controls, an older supported
renderer should retain the existing output path. If explicit `start`,
`increment`, `scope`, or `countFrom` behavior depends on a newer proven
WeasyPrint baseline, the CLI must fail clearly when the installed renderer is
too old. It must not silently ignore the requested control or produce an
approximate visual fallback.

### Renderer Compatibility Smoke Design

The advanced-control renderer baselines are evidence tasks with a fixed matrix,
not remaining product questions. The first matrix uses exact WeasyPrint
releases:

| Version | Purpose                                                                                        |
| ------- | ---------------------------------------------------------------------------------------------- |
| `65.1`  | oldest serious candidate after fixes for page names, first pages, blank pages, and page groups |
| `68.0`  | boundary containing the page-group repagination fix                                            |
| `69.0`  | current development and launch baseline                                                        |

The matrix should record capability-specific baselines rather than forcing one
version on every page-number path. `countFrom: document` should avoid
page-group-relative selectors when they are unnecessary. `countFrom: body`
must prove the exact first-body reset selector and its behavior during
repagination; if that implementation uses `@page :nth(1 of body)`, the fix in
`68.0` is directly relevant.[^weasyprint-changelog]

Each version should run in an independent `uv` project using the same Python
minor version. The projects must not downgrade or otherwise mutate the user's
normal Conda environment. Before and after the matrix, record that Conda base
still reports WeasyPrint `69.0`; any change makes the run invalid. Capture the
installed WeasyPrint, Pydyf, FontTools, and Python versions for each project,
plus the shared native Pango version, so that a passing render is reproducible
as an environment claim rather than only a package-number claim.

The laboratory is disposable but intentionally retained through comparison:

```text
realpath(os.tmpdir())/cdx-chores-weasyprint-matrix-<unique>/
  fixtures/
  wp-65-1/
  wp-68-0/
  wp-69-0/
  results/
```

The operating-system temporary root may be exposed through a path alias. The
laboratory should store and print its canonical path instead of assuming a
platform-specific location or spelling. This follows the Interactive
owned-session alias handling, but it is not an Interactive recipe session. The
matrix root remains available for cross-version inspection and is removed only
as that exact root after the evidence is recorded. Each `md to-pdf` invocation
continues to own and remove its separate `cdx-chores-md-pdf-*` renderer scratch
directory.[^interactive-temp-session] [^renderer-temp-source]

An aborted or inconclusive run retains and prints the canonical matrix root for
diagnosis. Cleanup must target only that exact root and occurs after results are
recorded or after explicit confirmation that the incomplete evidence is no
longer needed. A later reusable runner may keep canonical fixture definitions
under `examples/playground/md-pdf/`, while materialized uv projects, PDFs, PNGs,
and environment reports remain in the OS temporary laboratory.

The smoke has two lanes:

1. A renderer-contract lane renders shared hand-written HTML and CSS directly
   with each pinned WeasyPrint. It isolates counters, named pages, visibility,
   and page-margin layout from Pandoc and CLI behavior.
2. An actual-launch lane puts the pinned project's `weasyprint` executable
   first on `PATH`, then runs `doctor --json` and the built `md to-pdf` command
   with the same Pandoc executable and shared Markdown/Profile inputs.

The contract fixtures cover:

- `start: 0`, `increment: 2`, and the default arithmetic
- both `countFrom` values with the expected first sequence value
- hidden-but-counted covers under `document` origin and excluded covers under
  `body` origin
- single-page and multi-page covers
- title/front-matter, single-page and multi-page ToC, and body transitions
- both visibility scopes and all six page-number positions
- physical `{pages}`, inserted blank pages, and long-content repagination
- portrait, landscape, narrow margins, typography, and separators
- generated and legacy custom Template body hooks, including warning fallback
  for document origin and hard failure for an unprovable body origin

The upstream `:nth(1 of body)` repagination case remains a separate sentinel
until the generator strategy is fixed. If the accepted `countFrom: body`
implementation emits that selector or depends on equivalent page-group state,
the sentinel becomes a required contract fixture. Otherwise it remains
informative and does not disqualify an older version by itself. A reproducible
failure of an accepted contract fixture does disqualify that version for the
affected capability.

Candidate failures must be classified before applying the selection rule. A
reproducible mismatch in expected page sequence, visibility, scope, layout, or
CLI behavior is a contract failure and can disqualify the version. An uv setup,
dependency resolution, native-library, font-discovery, executable-launch, or
unrelated Conda failure is inconclusive: retain the laboratory, correct the
environment, and rerun the same version. It must not silently select a higher
minimum.

For each render, record the command result and warnings, PDF page count and
dimensions, extracted page-number text by physical page, and representative
page PNGs. Visual review must check visibility, sequence, placement, clipping,
overlap, and page transitions. PDF byte equality is not an acceptance
criterion because renderer versions may legitimately serialize or lay out the
document differently.

The baseline-selection rule is deterministic for each renderer-sensitive
capability:

```text
65.1 passes that capability's fixtures -> capability baseline 65.1
65.1 has a contract failure and 68.0 passes
                                       -> capability baseline 68.0
68.0 has a contract failure and 69.0 passes
                                       -> capability baseline 69.0
69.0 has a contract failure            -> constrain the capability before planning
any environment/setup failure          -> inconclusive; repair and rerun
```

Until the matrix is run, the research records the smoke design but does not
claim final capability baselines. Once results are recorded, pre-render
validation must enforce the applicable version for the effectively requested
controls. `doctor` should report the installed renderer version and advanced
page-number capabilities without declaring the existing `md to-pdf` path
unavailable solely because one advanced baseline is not met. Compatibility
tests and user-facing setup guidance must use the same distinction.

### Candidate Direct CLI Surface

The current `md to-pdf` command has Profile, Template, CSS, metadata, page-size,
margin, ToC, and code-highlight controls, but no dedicated page-number flags.[^command-source]
The first implementation slice should expose only the render-time toggle:

```text
--page-numbers / --no-page-numbers
```

Precedence is:

```text
direct enable/disable override
  -> loaded Profile pageNumbers.enabled
  -> normalized default false
```

`start`, `increment`, `scope`, `countFrom`, `position`, `format`, and
header/footer style remain Profile-only in the first slice. Interactive
authoring may edit those durable Profile values, but render-only Interactive
state should not create a second detailed override surface.

## Validation Plan

The eventual implementation should include:

1. Profile schema, defaults, integer bounds, `scope`/`countFrom` combination,
   and serialization tests.
2. CLI/Profile/default precedence tests for the enable/disable override and
   Profile/default tests for every new field.
3. CSS generation tests for document-first and body-first resets, increment,
   visibility scopes, positions, and styles.
4. Occupied-slot tests proving page-number-wins output, conflict warnings, and
   no silent relocation for all header/footer targets.
5. Placeholder tests covering zero, metadata, reserved tokens, missing values,
   physical `{pages}` warnings for arithmetic and body-relative sequences, and
   short-form compatibility.
6. Existing `format` Profile compatibility tests.
7. Built-in and generated Template tests for cover, title, ToC, stable body
   hooks, warning-backed document-origin inference, and body-origin hard
   failure when the reset boundary cannot be proven.
8. Run the pinned `65.1`, `68.0`, and `69.0` renderer-contract and
   actual-launch matrix defined above.
9. Renderer capability-gate tests proving existing fallback behavior,
   clear failure for unsupported explicit controls, and `doctor` agreement.
10. Record PDF metadata, page-by-page text extraction, and rendered-page image
    inspection for the matrix rather than relying on generated CSS or PDF bytes.
11. Direct enable/disable and Interactive Profile-authoring tests.
12. Existing Profile compatibility fixtures and guide-example validation.

Generated CSS assertions alone are not sufficient evidence for completion.
Renderer-sensitive claims should stay `in-progress` until real PDF fixtures are
recorded.

## Documentation Impact

The feature work should update, as applicable:

- [Markdown PDF Usage][markdown-pdf-usage]
- [Markdown PDF Codex Profile Helper][profile-helper]
- Interactive Markdown PDF usage and formal-guide wording
- Profile examples produced by `md pdf-profile init`
- CLI option help for direct overrides

The Markdown PDF guides own current feature behavior. The cross-feature guide
should link to them for advanced PDF details rather than duplicating the full
renderer contract. This research should publish a concise final placeholder
handoff containing the accepted field names, reserved tokens, missing/unknown
behavior, escaping, and migration posture. The cross-feature research owns
applying that handoff to the new repository-wide guide.

## Related Research

- [Profiles, Fonts, And Page Chrome][profile-page-chrome-research]
- [Pattern, Placeholder, And Template Language Guide][pattern-language-research]

## References

[^css-page]: [CSS Paged Media Module Level 3: Page-Based Counters](https://www.w3.org/TR/css-page-3/#page-based-counters)

[^weasyprint-css]: [WeasyPrint Supported CSS Features](https://doc.courtbouillon.org/weasyprint/stable/api_reference.html#css)

[^weasyprint-changelog]: [WeasyPrint Changelog](https://doc.courtbouillon.org/weasyprint/stable/changelog.html)

[^interactive-temp-session]: [Interactive owned temporary-session lifecycle](../../src/cli/interactive/markdown/lifecycle.ts) and [user-facing lifecycle guide](../guides/markdown-pdf-interactive-usage.md#temporary-render-lifecycle)

[^renderer-temp-source]: [Markdown PDF renderer scratch lifecycle](../../src/cli/markdown-pdf/render.ts)

[^profile-types]: [Current page-number Profile type](../../src/cli/markdown-pdf/profile/types.ts)

[^profile-defaults]: [Current normalized Profile defaults](../../src/cli/markdown-pdf/profile/defaults.ts)

[^profile-schema]: [Current Profile schema allowlists](../../src/cli/markdown-pdf/profile/schema.ts) and [normalization](../../src/cli/markdown-pdf/profile/normalize.ts)

[^page-chrome-source]: [Current page-chrome CSS generator](../../src/cli/markdown-pdf/profile/page-chrome.ts)

[^placeholder-source]: [Cover metadata placeholder resolver](../../src/cli/markdown-pdf/profile/placeholders.ts) and [cover usage](../../src/cli/markdown-pdf/profile/cover.ts)

[^recipe-source]: [Built-in Markdown PDF recipe](../../src/cli/markdown-pdf/recipe.ts)

[^font-source]: [Profile font CSS generator](../../src/cli/markdown-pdf/profile/fonts.ts)

[^recipe-tests]: [Recipe page-chrome tests](../../test/cli-actions-md-to-pdf-recipe.test.ts) and [Profile normalization tests](../../test/cli-actions-md-to-pdf-profile.test.ts)

[^template-contract]: [Template-Codex required hook contract](../../src/cli/markdown-pdf/template-codex/families.ts)

[^command-source]: [Markdown command registration](../../src/cli/commands/markdown.ts)

[markdown-pdf-usage]: ../guides/markdown-pdf-usage.md
[pattern-language-research]: research-2026-08-11-pattern-placeholder-and-template-language-guide.md
[profile-helper]: ../guides/markdown-pdf-codex-profile-helper.md
[profile-page-chrome-research]: research-2026-05-07-markdown-to-pdf-profiles-fonts-and-page-chrome.md
