---
title: "Markdown PDF Page Roles And Counter Semantics"
created-date: 2026-08-15
status: completed
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

The renderer mechanism, page-composition policy, production implementation,
and integrated real-PDF matrix are complete. Phase 14.5 keeps one counter
meaning per token and uses no revision-selected render compatibility mode.

The distinction is:

| Area                                                               | Current status      | Evidence gate                                              |
| ------------------------------------------------------------------ | ------------------- | ---------------------------------------------------------- |
| four token names and logical/physical separation                   | completed           | focused, integrated, and real-PDF evidence                 |
| `{pages}` logical-final formula                                    | completed           | body/document origins and non-default arithmetic           |
| revision `3`, no legacy render mode, and bounded migration warning | completed           | diagnostic, non-rewrite, and ANSI/plain tests              |
| historical metadata-title, ToC, and body behavior                  | recorded baseline   | deterministic pre-change fixtures                          |
| metadata-title placement with and without a cover                  | completed           | body-owned title and dedicated-cover matrix                |
| ToC repeating content and `toc.pageBreak` behavior                 | completed           | named-page, repeating-content, and real-PDF evidence       |
| inserted-blank ownership                                           | completed           | role extraction plus logical and physical counter evidence |
| one-pass or bounded multi-pass counter mechanism                   | completed: one pass | frozen and integrated renderer matrices                    |

The implementation passed the evidence gate without requiring a second render
or an approximate token meaning.

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

## Historical Page-Role Baseline

Before Phase 14.5, the built-in recipe ordered the generated regions as:

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

This baseline allowed a Profile to produce cover, metadata-title, ToC, and body
regions in sequence. The dedicated fixtures retain that historical behavior so
the accepted replacement is explicit rather than accidental.

## Accepted Page Composition Contract

The implemented direction keeps a title block as body content, not an implicit
cover-like page:

```text
No dedicated cover
ToC -> first body page containing the resolved metadata title -> body content

Dedicated cover
Cover -> ToC -> body content
         metadataTitle: auto suppresses a duplicate body title
```

The settled rules are:

- `metadataTitle: auto` renders in the body only when no dedicated cover or
  visible source title already represents it
- `metadataTitle: show` remains an explicit request and may repeat a title even
  when a cover exists
- `metadataTitle: hide` remains a hard suppression
- a separate title page is expressed through the dedicated cover feature, not
  created accidentally by a named-page transition

The dedicated cover remains the only explicit title-page role. Built-in and
newly managed Templates use the same cover, ToC, and single-body ordering.
Existing arbitrary Custom Templates retain template ownership and are not
rewritten; their body-hook compatibility is validated at render preparation.

## ToC Configuration And Repeating Content

The named `toc` page first clears all margin boxes and then restores the
configured effective repeating content. This makes the ownership boundary
explicit while preserving the dedicated cover as the protected exception:

| Target role         | Repeating header/footer    | Page-number visibility |
| ------------------- | -------------------------- | ---------------------- |
| cover               | never                      | never                  |
| ToC                 | configured content applies | document scope only    |
| body                | configured content applies | document or body scope |
| body metadata title | same as body               | same as body           |

The cover remains the protected chrome-free exception. Interactive wording
uses repeating page content rather than requiring users to understand the
internal `pageChrome` term.

The `toc.pageBreak` audit confirms that explicit break declarations and named-
page transitions are separate causes. In particular, `auto` or `none` does not
promise that ToC and body content share one physical page when the renderer
transitions from the named `toc` group to the named `body` group.

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

The four placeholders have one implemented current-canary meaning each:

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

The shared color helper now accepts an explicit stream. Warning presentation
uses `stderr`, while `stdout` remains the compatibility default for existing
callers.

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

WeasyPrint directly exposes physical page counters. Phase 14.5 proved that a
Profile-owned logical counter and one logical-final target can coexist with
those physical counters in one pass.

The evidence matrix covered:

- cover enabled and disabled
- metadata title `auto`, `show`, and `hide`
- ToC enabled and disabled, including `pageBreak` behavior
- `scope: body` and `scope: document`
- `countFrom: body` and `countFrom: document` in valid combinations
- non-default `start` and `increment`
- inserted blank pages and repagination
- all four placeholders alone and in one custom label
- supported WeasyPrint candidates from the existing renderer catalog

Because one pass produced the contract across the frozen candidates, no second
pass, pagination-stability loop, or intermediate final-output replacement was
introduced.

### Accepted One-Pass Evidence

The existing guarded renderer laboratory proved the four counters in one pass
on WeasyPrint `65.1`, `68.0`, and `69.0`. The experiment rendered one protected
cover, one ToC page, and one body page group containing three physical pages.
With logical `start: 5` and `increment: 2`, every candidate extracted the same
values:

| Physical page | Role              | `{page}` | `{pages}` | `{pdfPage}` | `{pdfPages}` |
| ------------: | ----------------- | -------: | --------: | ----------: | -----------: |
|             1 | cover             |   hidden |    hidden |      hidden |       hidden |
|             2 | table of contents |   hidden |    hidden |      hidden |       hidden |
|             3 | document body     |        5 |         9 |           3 |            5 |
|             4 | document body     |        7 |         9 |           4 |            5 |
|             5 | document body     |        9 |         9 |           5 |            5 |

The mechanism uses one body page group, a dedicated logical page counter, and
`target-counter()` to resolve its final value. The built-in physical `page` and
`pages` counters remain available for the physical pair. No second render,
pagination-stability loop, or intermediate final-output replacement is needed.

This establishes a production requirement: the built-in recipe or Custom
Template handoff provides exactly one unambiguous body page group and one
logical-final target owned by that group. Missing or ambiguous ownership fails
validation rather than silently falling back to physical counters.

The same baseline run also passed the pre-existing renderer scenarios, built-
in and custom-Template product-compatibility launches, Project launches,
dependency checks, and the actual CLI launch boundary. Representative
page images from the isolated experiment showed stable A5 page dimensions,
unclipped combined labels, a chrome-free cover and ToC, and no unexpected PDF
page-label metadata. Historical product evidence continued to expose the old
mixed-domain label, confirming why production replacement was necessary.

The reproducible public invocation is:

```text
bun scripts/spikes/markdown-pdf-page-number-renderer-evidence.ts run --live --keep --python <python-launcher>
```

The launcher and laboratory paths remain local-only. The catalog digest is the
SHA-256 of the stable serialized candidate, scenario, experiment, body-hook,
visual-boundary, and launch-fixture payload. The harness digest is the SHA-256
of the stable candidate IDs, scenario IDs, stage list, timeout, and output
bound. The accepted run used catalog digest
`c11864a4248ec151dce7c98f4f2bfd32d29fd06d67f88e836e11dcc4ed5d66bc`
and harness digest
`246473afb35a3c95bb8e1c7fd60f0163e658d55e99e37e028615071b1e08c2c5`.
They can be recomputed through `pageNumberRendererContractDigest()` and
`PAGE_NUMBER_RENDERER_HARNESS_DIGEST` in the existing contract modules.
Visual inspection covered experiment pages 1, 2, 3, and 5 plus built-in
product pages 1, 2, and 5. The successful
laboratory and both resolved failed attempts were then closed through the
ownership-guarded cleanup command.

The baseline verdict was **Continue** with the one-pass mechanism.

### Integrated Production Evidence

After implementation, the guarded laboratory reran the product and Project
paths on WeasyPrint `65.1`, `68.0`, and `69.0`. Every candidate passed with
catalog digest
`7b3761bff1b9300739936f7ccbb2ab032ea0cd1c525e26a58f451923d987cc59`
and harness digest
`dbf41562c71ee837861b4e68507fa295613ed98df840c0a4ef90b65ced8718d8`.

The accepted product cases establish:

- body-scoped labels with document-origin arithmetic: cover and ToC labels are
  hidden, while physical body pages 3, 4, and 5 show logical values 4, 6, and 8
  with logical final 8 and physical total 5
- body-origin arithmetic with `start: 5` and `increment: 2`: the ToC remains
  unlabeled and three body pages show 5, 7, and 9 with logical final 9
- a physical-only label on a renderer-inserted blank: the three pages show
  physical values 1/3, 2/3, and 3/3 without requiring a logical-final target
- no-cover automatic metadata title ownership: the ToC is physical page 1 and
  the title appears only inside the body on physical page 2; configured header
  and footer content repeats without overlap
- Project bundle and explicit-role paths agree on page roles and labels

Representative images confirmed a chrome-free cover, configured ToC chrome,
body-only label visibility, an unclipped physical-only blank-page label, and a
body-owned automatic metadata title. PDF page-label metadata remained the
default physical sequence. Every retained laboratory was closed through the
guarded cleanup path.

## Phase 14.5 Implementation Record

Phase 14.5 completed in this order:

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

## Completion Evidence

This research is `completed` because:

- the accepted page-role and ToC policy is implemented and recorded
- all four placeholder values are proven from real PDFs
- one-pass ownership is settled
- compatibility warning and no-color behavior are specified and tested
- exact-range maintainability and test-quality review covered
  `6b1b9bba..d0961278` after two accepted evidence gaps were fixed, and the
  widened re-review found no material findings
- the [Phase 14.5 job record][phase-14-5-job] contains the validation, commit,
  renderer, visual-review, cleanup, and closeout ledger

## Related Research

- [Markdown PDF Page-Number Configuration][page-number-research]
- [Markdown PDF Interactive Page Numbers And Repeating Page Content UX][interactive-research]
- [Markdown PDF Profile Revision And Feature Compatibility][profile-revision-research]
- [Profiles, Fonts, And Page Chrome][profile-page-chrome-research]
- [Pattern, Placeholder, And Template Language Guide][pattern-language-research]

## Related Plans

- [Markdown PDF Page-Number Configuration Implementation][page-number-plan]
- [Phase 14.5 Page Roles And Counters Job][phase-14-5-job]

## References

[^interactive-research]: [Completed Phase 14 Interactive UX research](research-2026-08-14-markdown-pdf-interactive-page-number-and-page-chrome-ux.md)

[^recipe-source]: [Built-in Markdown PDF recipe](../../src/cli/markdown-pdf/recipe.ts) and [page-chrome CSS generator](../../src/cli/markdown-pdf/profile/page-chrome.ts)

[interactive-research]: research-2026-08-14-markdown-pdf-interactive-page-number-and-page-chrome-ux.md
[phase-14-5-job]: ../plans/jobs/2026-08-15-markdown-pdf-page-number-phase-14-5-page-roles-and-counters.md
[page-number-plan]: ../plans/plan-2026-08-12-markdown-pdf-page-number-configuration.md
[page-number-research]: research-2026-08-11-markdown-pdf-page-number-configuration.md
[pattern-language-research]: research-2026-08-11-pattern-placeholder-and-template-language-guide.md
[profile-page-chrome-research]: research-2026-05-07-markdown-to-pdf-profiles-fonts-and-page-chrome.md
[profile-revision-research]: research-2026-08-14-markdown-pdf-profile-revision-and-feature-compatibility.md
