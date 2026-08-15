---
title: "Markdown PDF Page Roles And Counter Semantics"
created-date: 2026-08-15
status: in-progress
agent: codex
---

## Goal

Define how the built-in Markdown PDF recipe composes cover, metadata-title,
table-of-contents, body, and renderer-inserted blank pages, then give logical
and physical page-number placeholders names that remain coherent across those
roles.

This research is the implementation boundary for Phase 14.5 of the
[Markdown PDF Page-Number Configuration plan][page-number-plan]. It follows a
completed Interactive UX refinement whose live render exposed two connected
gaps: the first pre-body page behaves like a title page without being the
configured cover, and `{pages}` reports a physical total while `{page}` may use
a body-relative logical sequence.

## Research At A Glance

The placeholder vocabulary and migration posture are settled:

```text
{page}      current logical number in the countFrom domain
{pages}     final logical number in the same counter sequence
{pdfPage}   current physical page in the rendered PDF
{pdfPages}  physical page count of the rendered PDF
```

Profile `schemaVersion` remains `3`. The current revision-3 canary contract has
not been released as a later stable Profile contract, so Phase 14.5 extends
that contract instead of inventing revision `4` from an internal plan boundary.

Renderer mechanics and the final page-composition policy remain in progress.
The research must not be marked `completed` until real PDF evidence proves the
accepted page-role and counter matrix.

The distinction is:

| Area                                                               | Current status        | Evidence gate                                                      |
| ------------------------------------------------------------------ | --------------------- | ------------------------------------------------------------------ |
| four token names and intended logical/physical separation          | settled design intent | prove exact values on real PDFs before implementation is accepted  |
| `{pages}` logical-final formula                                    | settled design intent | prove the selected logical domain and arithmetic across page roles |
| revision `3`, no legacy render mode, and bounded migration warning | settled design intent | cover declaration and warning conditions in focused tests          |
| current metadata-title, ToC, and body behavior                     | observed baseline     | freeze with deterministic and real-PDF evidence                    |
| metadata-title placement with and without a cover                  | preferred candidate   | compare body-block and explicit title-page outcomes                |
| ToC repeating content and `toc.pageBreak` behavior                 | preferred candidate   | prove named-page transitions and accepted chrome policy            |
| blank-page logical ownership                                       | unresolved            | extract page roles across forced blanks and repagination           |
| one-pass or bounded multi-pass counter mechanism                   | unresolved            | prove all four values across supported renderer candidates         |

“Settled design intent” does not mean implemented, renderer-proven, or shipped.
If the evidence gate cannot support the intended semantics without an unsafe or
unstable mechanism, Phase 14.5 must stop and revise this research rather than
ship an approximate token meaning.

## Why This Follow-Up Exists

Phase 14 made Profile `formal-guide` authoring shorter and taught page-number
labels and repeating-content placeholders through shared ghost input. It did
not change the renderer or the then-current meaning of `{pages}`.[^interactive-research]

A bounded post-implementation render used:

- no dedicated cover
- automatic metadata title
- an enabled ToC
- body-scoped, body-origin page numbers
- a `Page {page} of {pages}` label
- configured repeating header and footer text

The result exposed a page-role problem before it exposed a placeholder problem:

```text
physical page 1  metadata title on a generic pre-body page
physical page 2  named ToC page with cleared margin boxes
physical page 3  first named body page and logical body number 1
```

The metadata title therefore looks like a cover or title page, but it is not
owned by `cover.enabled`. It receives generic repeating content while the ToC
clears that content. Body-scoped page numbers are correctly absent from both
pre-body pages, but `{pages}` still reports the physical PDF total on body
pages. These effects are individually explainable from the current recipe and
CSS; together they are not a clear authoring contract.[^recipe-source]

The bounded smoke is discovery evidence, not the permanent renderer proof for
this research. Phase 14.5 must convert the finding into deterministic fixtures,
extracted PDF text, representative page images, and a recorded renderer
matrix.

## Current Page-Role Map

The built-in recipe currently orders the generated regions as:

```text
dedicated cover, when enabled
        -> metadata title block, when resolved visible
        -> table of contents, when enabled
        -> named document body
```

The corresponding behavior is:

| Current role    | Page-style ownership  | Repeating header/footer    | Page number                                    |
| --------------- | --------------------- | -------------------------- | ---------------------------------------------- |
| dedicated cover | named `cover` page    | cleared                    | cleared                                        |
| metadata title  | generic pre-body page | generic content applies    | hidden for body scope                          |
| ToC             | named `toc` page      | cleared                    | restored only by applicable page-number policy |
| body            | named `body` page     | configured content applies | follows effective page-number policy           |

Enabling the dedicated cover does not currently guarantee that an automatic
metadata title disappears. A Profile can therefore produce cover, metadata-
title, ToC, and body regions in sequence. That may be deliberate when
`metadataTitle: show` forces a repeated title, but it is surprising as an
automatic default.

## Page Composition Direction To Prove

The preferred direction is that a title block remains a block, not an implicit
cover-like page:

```text
No dedicated cover
ToC -> first body page containing the resolved metadata title -> body content

Dedicated cover
Cover -> ToC -> body content
         metadataTitle: auto suppresses a duplicate body title
```

Under this direction:

- `metadataTitle: auto` renders in the body only when no dedicated cover or
  visible source title already represents it
- `metadataTitle: show` remains an explicit request and may repeat a title even
  when a cover exists
- `metadataTitle: hide` remains a hard suppression
- a separate title page is expressed through the dedicated cover feature, not
  created accidentally by a named-page transition

Phase 14.5 must compare this direction with an explicit named title-page role
before changing production composition. It must record pagination, ToC order,
heading duplication, body-start hooks, and custom-Template compatibility for
the accepted option.

## ToC Configuration And Repeating Content

The current named `toc` page clears all normal margin boxes. This means an
enabled ToC does not receive configured repeating header or footer text. A
document-scoped page number may be restored independently, while body-scoped
page numbers remain hidden.

That exception is not represented by an ordinary Profile choice. Phase 14.5
must settle one explicit policy instead of leaving the result as a CSS side
effect. The preferred candidate is:

| Target role         | Repeating header/footer    | Page-number visibility |
| ------------------- | -------------------------- | ---------------------- |
| cover               | never                      | never                  |
| ToC                 | configured content applies | document scope only    |
| body                | configured content applies | document or body scope |
| body metadata title | same as body               | same as body           |

The cover remains the protected chrome-free exception. If evidence instead
supports a clean ToC page, the Profile needs a clear public policy for that
exception; Interactive users should not have to infer it from the internal
term `pageChrome`.

The research must also audit `toc.pageBreak`. An `auto` value does not by
itself prove that the ToC can share a physical page with adjacent content,
because changing from a named `toc` page to a named `body` page can establish a
page boundary. The final contract must distinguish an explicit break option
from a break caused by page-style ownership.

## Logical And Physical Counter Contract

`scope` controls visibility only. It does not choose a counter domain or alter
any placeholder value.

`countFrom` chooses the logical domain:

- `document` counts every physical page in output order, including a protected
  cover, ToC, body pages, and renderer-inserted blank pages
- `body` begins at the first body-owned page and excludes cover and ToC pages
- a blank page participates in the body domain only when evidence identifies
  it as body-owned; it always participates in the physical PDF sequence

Hidden labels still count. For example, a protected cover may have no visible
number while the following ToC is logical document page `2`.

The four placeholders have one intended current-canary meaning each. Phase 14.5
must prove these values before treating the contract as implemented:

| Placeholder  | Meaning                         | Affected by `countFrom` | Affected by `start` and `increment` |
| ------------ | ------------------------------- | ----------------------: | ----------------------------------: |
| `{page}`     | current logical number          |                     yes |                                 yes |
| `{pages}`    | final logical number            |                     yes |                                 yes |
| `{pdfPage}`  | one-based physical PDF position |                      no |                                  no |
| `{pdfPages}` | physical PDF page count         |                      no |                                  no |

For `N` pages in the selected logical domain:

```text
{pages} = start + ((N - 1) * increment)
```

For four body pages with `start: 5` and `increment: 2`, `{page}` produces
`5, 7, 9, 11` and `{pages}` produces `11`. `{pdfPage}` and `{pdfPages}` remain
physical values independent of that arithmetic.

The ordinary guided label can therefore remain:

```text
Page {page} of {pages}
```

Advanced custom labels may expose both domains:

```text
Page {page} of {pages} (PDF page {pdfPage} of {pdfPages})
```

## Breaking Change And Migration Warning

Changing `{pages}` from physical PDF count to final logical number is an
intentional canary breaking change. The renderer will not maintain two token
meanings, branch on `schemaVersion`, or rewrite input Profiles.

The current guides and eventual release notes must show the migration:

```yaml
# Historical physical-total intent
format: "Page {page} of {pages}"

# Current physical-total intent
format: "Page {page} of {pdfPages}"
```

A bounded successful warning applies only when all of these are true:

1. page numbers are effectively enabled for the render
2. the source Profile explicitly declares `schemaVersion: 1` or
   `schemaVersion: 2`
3. the active label contains the exact `{pages}` token

Revision `3`, a missing declaration, an unusable declaration, disabled page
numbers, and labels without `{pages}` skip this migration warning. Existing
revision-consistency diagnostics remain independent.

Suggested wording is:

> This Profile declares schemaVersion 2. `{pages}` now means the final logical
> page number for `countFrom: body`. To show the rendered PDF page count,
> replace `{pages}` with `{pdfPages}`.

The warning must report the effective `countFrom` value and must not block a
successful render.

## ANSI Warning Presentation

The plain terminal warning should use the shared color helper rather than raw
escape sequences. Its `Warning:` label or grouped warning heading uses ANSI
standard yellow (`33`) when the target `stderr` stream is an eligible TTY; the
explanation remains in the terminal's normal foreground color.

Redirected output, `NO_COLOR`, `--no-color`, and disabled runtime color produce
the same readable text without ANSI sequences. Structured diagnostics carry
severity, condition ID, message, and context without presentation escapes.

The current shared color helper derives TTY support from `stdout`. Phase 14.5
should make stream selection explicit before using it for `stderr` warnings,
while retaining `stdout` as the compatibility default for existing callers.

## Revision-3 Feature Registry Implications

Revision `3` remains the current Profile feature revision. Phase 14.5 records
`{pdfPage}` and `{pdfPages}` as revision-3 accepted template-language features
and updates renderer-capability relationships without treating the plan's
fractional phase number as a schema revision.

The `{pages}` reinterpretation is one current renderer contract, not a
revision-selected compatibility mode. An explicit revision `1` or `2` is only
a signal for the migration warning. Missing declarations remain quiet, and
supported content remains authoritative.

## Renderer Investigation

WeasyPrint directly exposes physical page counters, but the current CSS also
resets page-based numbering for logical body sequences. Phase 14.5 must prove
whether independent logical-current, logical-final, physical-current, and
physical-total values can coexist in one pass.

The evidence matrix must cover:

- cover enabled and disabled
- metadata title `auto`, `show`, and `hide`
- ToC enabled and disabled, including `pageBreak` behavior
- `scope: body` and `scope: document`
- `countFrom: body` and `countFrom: document` in valid combinations
- non-default `start` and `increment`
- inserted blank pages and repagination
- all four placeholders alone and in one custom label
- supported WeasyPrint candidates from the existing renderer catalog

If one pass cannot produce the contract, research must define a bounded second
pass with a stability guard before implementation. It must not assume that a
changed margin-box label can never affect pagination.

## Phase 14.5 Implementation Handoff

Phase 14.5 should proceed in this order:

1. freeze current page-role and ToC behavior in deterministic tests
2. run the focused renderer spike for page roles and four counter values
3. settle the metadata-title, cover, ToC, and blank-page matrix
4. implement the accepted page composition and counter mechanism
5. update the revision-3 feature registry and shared diagnostics
6. add the explicit revision-1/revision-2 migration warning and ANSI rendering
7. update Interactive ghost candidates and help for all four tokens
8. verify direct, Interactive Profile, saved Profile, and Project rendering
9. rerun the affected renderer evidence across the frozen candidates
10. complete focused, Markdown PDF, repository-wide, static, build, format,
    and exact-range review gates

## Completion Criteria

This research can become `completed` only when:

- the accepted page-role and ToC policy is recorded
- all four placeholder values are proven from real PDFs
- single-pass or bounded multi-pass ownership is settled
- compatibility warning and no-color behavior are specified and tested
- Phase 14.5 implementation and exact-range review evidence are linked

## Related Research

- [Markdown PDF Page-Number Configuration][page-number-research]
- [Markdown PDF Interactive Page Numbers And Repeating Page Content UX][interactive-research]
- [Markdown PDF Profile Revision And Feature Compatibility][profile-revision-research]
- [Profiles, Fonts, And Page Chrome][profile-page-chrome-research]
- [Pattern, Placeholder, And Template Language Guide][pattern-language-research]

## Related Plans

- [Markdown PDF Page-Number Configuration Implementation][page-number-plan]

## References

[^interactive-research]: [Completed Phase 14 Interactive UX research](research-2026-08-14-markdown-pdf-interactive-page-number-and-page-chrome-ux.md)

[^recipe-source]: [Built-in Markdown PDF recipe](../../src/cli/markdown-pdf/recipe.ts) and [page-chrome CSS generator](../../src/cli/markdown-pdf/profile/page-chrome.ts)

[interactive-research]: research-2026-08-14-markdown-pdf-interactive-page-number-and-page-chrome-ux.md
[page-number-plan]: ../plans/plan-2026-08-12-markdown-pdf-page-number-configuration.md
[page-number-research]: research-2026-08-11-markdown-pdf-page-number-configuration.md
[pattern-language-research]: research-2026-08-11-pattern-placeholder-and-template-language-guide.md
[profile-page-chrome-research]: research-2026-05-07-markdown-to-pdf-profiles-fonts-and-page-chrome.md
[profile-revision-research]: research-2026-08-14-markdown-pdf-profile-revision-and-feature-compatibility.md
