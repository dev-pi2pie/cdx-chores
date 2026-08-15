---
title: "Markdown PDF Interactive Cover Page Authoring"
created-date: 2026-08-15
status: in-progress
agent: codex
---

## Goal

Add one clear cover-page decision to Interactive Markdown PDF Profile
`formal-guide` authoring without turning the terminal flow into a second copy
of the complete Profile cover schema.

The cover decision belongs before the table-of-contents decision because it
changes the first physical page and the resulting document order. Fresh
authoring and same-session revision must preserve the completed page-role,
page-number, and repeating-content contracts.

## Research At A Glance

The core authoring direction is settled:

```text
Layout and margins
        -> Cover page
        -> Table of contents
        -> Code presentation
        -> Page numbers
        -> Repeating page content
```

The common path asks one question:

```text
Add a cover page?
  No  — begin with the table of contents or document body
  Yes — create a separate first page from document metadata
```

For a fresh candidate, selecting Yes enables the existing normalized `plain`
cover with `{title}`, `{subtitle}`, `{author}`, `{company}`, and `{date}` field
templates. Style, field-template customization, and image-cover composition
remain outside the common terminal path. Revision changes only
`cover.enabled` and retains any existing advanced values.

| Area                                           | Status              |
| ---------------------------------------------- | ------------------- |
| cover decision before ToC                      | settled             |
| one metadata-cover question                    | settled             |
| independent `Revise cover page` action         | settled             |
| advanced style and field templates remain YAML | settled             |
| same-session inert-value preservation          | settled             |
| empty-cover metadata warning                   | settled             |
| duplicate company rendering                    | requires correction |
| arbitrary custom-Template compatibility        | settled direction   |

The research remains `in-progress` until the settled metadata, renderer, and
compatibility boundaries are implemented and Phase 14.6 records their evidence.

## Why This Follow-Up Exists

Phase 14 simplified page-number and repeating-content authoring. Phase 14.5
then established the rendered page order and removed the accidental cover-like
metadata-title page:

```text
Cover page, when enabled
        -> Table of contents, when enabled
        -> One document-body group
             -> metadata title, when resolved visible
             -> Markdown body
```

The Profile schema and built-in renderer already support a metadata-based text
cover, but `formal-guide` always emits the disabled default and provides no
fresh or revision choice. Users must currently edit `profile.yml` manually to
activate an otherwise supported structural page role.

Phase 14.6 closes that authoring gap. It does not reopen the completed counter
semantics or introduce a new Profile revision.

## Scope

This research covers:

- a Profile-only cover-page choice before ToC collection
- clear user-facing language that does not use the term `cover mode`
- fresh authoring and independent same-session cover revision
- retention of advanced `cover.style` and `cover.fields` values
- review of cover state, metadata source expectations, document order, and
  automatic metadata-title suppression
- a bounded warning when an enabled cover resolves no visible metadata
- built-in Template rendering and the boundary with arbitrary custom Templates
- focused prompt, compilation, persistence, lifecycle, and real-PDF evidence

This research does not:

- add or rename a Profile field
- change Profile `schemaVersion: 3`
- add cover style or individual cover-field questions to Formal Guide
- add image selection or image-cover composition to Profile authoring
- change Template or Project Codex Assistant cover decisions
- add a saved-Profile-to-Interactive revision entry point
- change page-number token meanings, arithmetic, or visibility

## Fresh Authoring Flow

Within Profile `formal-guide`, the structural questions should be ordered as
they affect the rendered document:

```text
Document preset
  -> Page size
  -> Orientation
  -> Margins
  -> Add a cover page?
  -> Include a table of contents?
  -> Remaining Profile presentation questions
```

The cover question should use a small select rather than an unexplained boolean
or the internal term `cover mode`:

```text
Add a cover page?
  No  — begin with the table of contents or document body (recommended)
  Yes — create a separate first page from document metadata
```

The accompanying help should say that the cover uses title, subtitle, author,
company, and date metadata when available. It should not ask the user to enter
each value again or serialize an example as data.

Fresh mappings are:

| Choice | `cover.enabled` | Style and fields                                  |
| ------ | --------------- | ------------------------------------------------- |
| No     | `false`         | retain normalized defaults as inert configuration |
| Yes    | `true`          | use normalized `plain` style and default fields   |

The new question is Profile-specific. Template Formal Guide remains limited to
its existing layout/ToC responsibilities, while Project preparation remains a
Codex Assistant workflow.

## Revision Contract

Profile recipe review should add one independent action:

```text
Revise cover page
```

That action asks only the cover decision and returns to the same accepted
candidate review. It does not re-ask layout, ToC, code, page numbers, or
repeating content.

| Transition            | Result                                                               |
| --------------------- | -------------------------------------------------------------------- |
| fresh -> disabled     | keep the ordinary disabled default                                   |
| fresh -> enabled      | enable the normalized metadata cover                                 |
| enabled -> disabled   | change only `enabled`; retain valid style and fields as inert values |
| disabled -> enabled   | restore retained style and fields                                    |
| revise without change | preserve the complete current cover answer                           |

Advanced values that the simplified flow cannot recreate must never disappear
merely because the user opens cover revision. This follows the same retention
principle already used for inactive page-number values and page-content style.

Interactive still revises only the accepted candidate retained in the current
authoring session. Save/reload tests prove serialization compatibility without
claiming that an arbitrary saved Profile can be reopened for Interactive
revision.

## Review And Metadata Readiness

The review should describe the visible outcome rather than repeat raw schema
keys:

```text
Cover page: Enabled — using document metadata
Document order: Cover -> Table of contents -> Body
Automatic body metadata title: Suppressed by the cover
```

When disabled:

```text
Cover page: Disabled
Document order: Table of contents -> Body
```

If ToC is disabled, the order ends at Body. If `metadataTitle: show` is an
advanced explicit value, review must state that the body title remains visible
even with a cover; only `auto` is suppressed.

Cover placeholders resolve from the normalized metadata map with existing
precedence:

```text
Profile metadata
  overridden by Markdown frontmatter
  overridden by CLI --meta values
```

Missing optional values render as empty. A cover is useful when at least one
configured cover field resolves to non-whitespace text after effective metadata
precedence is applied. When every configured field resolves empty, recipe
review and render diagnostics emit one non-blocking warning; rendering may
continue and the source Profile remains unchanged. The structured diagnostic
stays plain text, while terminal rendering uses the existing warning output on
stderr:

```text
The cover page is enabled, but its configured fields resolve to no visible
metadata. The PDF may contain an empty cover page. Add title, subtitle, author,
company, or date metadata; customize cover.fields; or disable the cover page.
```

The built-in renderer currently places company in its dedicated company line
and again in the author/company/date metadata line. Phase 14.6 must render
company exactly once in the dedicated company line; the compact metadata line
must contain author and date only. HTML assertions and extracted real-PDF text
must prove that the company value occurs once before the common authoring path
promotes `{company}` as a cover source.

## Template And CSS Boundary

Profile `cover.enabled` has different effects depending on the selected
Template:

| Render path                      | Current behavior                                                                  |
| -------------------------------- | --------------------------------------------------------------------------------- |
| built-in Template                | Profile generates cover HTML and generated cover CSS                              |
| arbitrary custom `template.html` | custom HTML replaces generated cover HTML; generated Profile cover CSS may remain |
| managed Project Template         | Template supplies compatible cover markup and Project validates cover ownership   |

The built-in path is the primary Phase 14.6 authoring target. It inserts the
cover before ToC and emits a named `@page cover` rule that clears margins,
header/footer content, and page numbers before breaking to the next page.

The accepted compatibility matrix is:

| Render path                                     | Phase 14.6 outcome                                                                                    |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| built-in Template with generated CSS            | supported; Profile supplies cover HTML and CSS                                                        |
| arbitrary custom Template without a proven hook | validation error before output; cover intent must not be silently dropped                             |
| arbitrary custom Template with a validated hook | reserved follow-up capability; not implied by the initial Formal Guide implementation                 |
| managed Project Template                        | supported only when Project compatibility validation proves cover markup and ownership                |
| built-in cover with `--no-default-css`          | allowed as an advanced override with one warning that custom CSS owns the page break and chrome reset |
| custom Template plus `--no-default-css`         | subject to both the custom-Template validation and advanced CSS-ownership warning                     |

An incompatible Template or managed Project is a validation error and produces
no final output. `--no-default-css` alone remains an intentional advanced
override rather than a hard error, but rendering warns that generated cover
layout and chrome-clearing rules are absent. This does not weaken the existing
hard error when any effective page-number request, whether Profile-sourced or
directly enabled for one render, is combined with `--no-default-css`; that
incompatibility takes precedence when both features are active. No-output tests
must cover both page-number sources. The remaining outcomes require direct,
Interactive, bundle, and no-output regression coverage.

Managed image covers remain Template/Project-owned. The Formal Guide question
must say that it creates a metadata-based cover page, not imply image selection
or Template composition.

## Page-Number And Repeating-Content Interaction

The completed Phase 14.5 contract remains unchanged:

- generated CSS keeps the cover chrome-free; under `--no-default-css`, an
  equivalent custom stylesheet is the user's responsibility
- `scope` controls page-number visibility only
- `countFrom: document` includes the visible, chrome-free cover page in logical
  arithmetic even though no page-number label appears on the cover
- `countFrom: body` excludes the cover and ToC
- `{pdfPage}` and `{pdfPages}` always reflect physical PDF position and count
- configured ToC/body repeating content does not appear on the cover

The cover question therefore belongs before ToC, while page-number and
repeating-content questions remain later. The resulting document roles are
known before the user chooses body or document numbering.

## Phase 14.6 Implementation Direction

Phase 14.6 should:

1. freeze the current disabled-cover Formal Guide output and built-in cover
   rendering before changes
2. implement the settled custom-Template and `--no-default-css` compatibility
   matrix
3. add a Profile-specific normalized cover answer and prompt before ToC
4. compile the choice without changing schema or advanced cover defaults
5. add independent cover revision with inert-value preservation
6. correct duplicate company rendering and add metadata-readiness review
7. verify cover/ToC/body order, automatic and explicit metadata-title behavior,
   and page-number arithmetic
8. run focused, broad Interactive/Markdown PDF, full repository, static, build,
   format, and exact-range review gates
9. render and inspect a bounded real PDF with cover, ToC, body, page numbers,
   and repeating content before closing the phase

## Completion Criteria

This research can become `completed` only when:

- the custom-Template and `--no-default-css` compatibility matrix is enforced
- fresh and revision cover behavior is implemented and proven
- advanced cover values survive simplified revision
- metadata readiness and company rendering are resolved
- a real PDF proves cover -> ToC -> body order and page-number interaction
- the Phase 14.6 implementation and exact-range review record is linked

## Related Research

- [Markdown PDF Interactive Page Numbers And Repeating Page Content UX][interactive-page-content-research]
- [Markdown PDF Page Roles And Counter Semantics][page-role-counter-research]
- [Markdown PDF Page-Number Configuration][page-number-research]
- [Profiles, Fonts, And Page Chrome][profile-cover-research]

## Related Plans

- [Markdown PDF Page-Number Configuration Implementation][page-number-plan]

[interactive-page-content-research]: research-2026-08-14-markdown-pdf-interactive-page-number-and-page-chrome-ux.md
[page-number-plan]: ../plans/plan-2026-08-12-markdown-pdf-page-number-configuration.md
[page-number-research]: research-2026-08-11-markdown-pdf-page-number-configuration.md
[page-role-counter-research]: research-2026-08-15-markdown-pdf-page-roles-and-counter-semantics.md
[profile-cover-research]: research-2026-05-07-markdown-to-pdf-profiles-fonts-and-page-chrome.md
