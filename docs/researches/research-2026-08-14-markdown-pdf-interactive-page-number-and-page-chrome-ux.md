---
title: "Markdown PDF Interactive Page Numbers And Repeating Page Content UX"
created-date: 2026-08-14
modified-date: 2026-08-15
status: completed
agent: codex
---

## Goal

Make Markdown PDF Interactive Profile `formal-guide` authoring describe the
visible result: page numbers and optional repeating header/footer text placed
within one six-position page layout.

The common path should offer useful page-number labels and guided metadata
placeholders without asking users to reproduce the complete Profile schema in
terminal prompts. The full Profile contract remains available in YAML or JSON.
Direct and Interactive rendering retain the existing one-render enablement
override, and Codex-assisted page-number intent remains a separate future
design problem.

## Why This Follow-Up Exists

The parent [Markdown PDF Page-Number Configuration][page-number-research]
research and implementation plan established the durable ownership contract:
Profile owns reusable page-number and header/footer policy, while `md to-pdf`
owns only a temporary enable/disable override.

The first Interactive implementation exposed that contract too literally. It
asked for detailed page-number sequence fields, all six header/footer slots,
and optional styles even when a user wanted ordinary page numbers. The first
Phase 14 pass successfully shortened that flow and moved advanced sequence and
style fields back to Profile YAML or JSON.[^first-checkpoint]

## Why The Research Reopened

The first pass reduced prompt volume but did not finish the user mental model:

- `page chrome` remains visible in review and revision wording even though it
  is an internal schema and rendering term
- guided page numbers always use the bare `{page}` label and do not offer a
  common `Page 1` presentation or teach custom labels
- page-number placement and repeating header/footer placement appear as
  separate features even though both occupy the same six positions
- repeating-content inputs do not teach the metadata placeholders already
  supported by Profile rendering
- the terminal flow lacks ghost suggestions that can guide input without
  silently accepting or persisting a default

This reopened research refines presentation and guided authoring only. It does
not add a Profile field, renderer capability, or placeholder meaning.

## Scope

This research covers:

- user-facing language for Profile `formal-guide` page numbers and repeating
  header/footer text
- one shared six-position layout for page-number and repeating-content choices
- common page-number label presets and ghost-guided custom input
- metadata-placeholder hints for repeating header/footer content
- enabled and disabled page-number branches
- fresh authoring, same-session revision, occupied-slot, and value-retention
  behavior
- wording for the existing Interactive one-render page-number choice
- direct CLI help and the boundary between flags and Profile YAML
- focused validation for prompt-to-Profile compilation and persistence

This research does not:

- change the Profile schema, `schemaVersion`, normalization rules, or renderer
- add detailed page-number overrides to direct `md to-pdf`
- add a deterministic Project authoring mode
- add structured page-number signals to Profile or Project Codex Assistant
- add page-number policy to Template bundles
- add a logical-total placeholder or redefine `{page}` and `{pages}`
- move typography, separators, sequence arithmetic, or deliberate collisions
  into the common terminal path

## User-Facing Language

`pageChrome` remains an appropriate internal TypeScript and Profile-rendering
name. It should not be the term users must understand before configuring a
header, footer, or page number.

| Internal concept   | User-facing wording           |
| ------------------ | ----------------------------- |
| page chrome        | repeating page content        |
| page-chrome slot   | header/footer position        |
| revise page chrome | revise repeating page content |
| page-number format | page-number label             |

Guide documentation may introduce _page chrome_ once as the collective
technical term for repeating headers, footers, and page numbers. Interactive
prompts and ordinary review should use the concrete visible terms.

## One Six-Position Layout

Page numbers and repeating header/footer text share the same physical layout:

```text
                Repeating page layout

       Header left | Header center | Header right
       Footer left | Footer center | Footer right
```

An enabled page number owns one selected position. Optional repeating content
may use the other five positions. When page numbers are disabled, all six
positions are available.

Interactive should present this relationship once rather than asking users to
configure page-number placement and header/footer placement as unrelated
systems. The stored Profile remains unchanged: the page number continues to
use `pageNumbers.position`, while other content continues to use `header` and
`footer` slots.

The page-number position remains a single-choice prompt. After that selection,
Interactive should display the shared layout with the reserved position
identified, then use a checkbox prompt for zero or more repeating-content
positions.

| State                        | Page-number position                       | Repeating-content selection                                                 | Occupied reserved position                                                                        |
| ---------------------------- | ------------------------------------------ | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Fresh, numbering enabled     | Choose one; fresh default is bottom center | Empty checkbox selection over the other five positions                      | Not applicable                                                                                    |
| Fresh, numbering disabled    | Not asked                                  | Empty checkbox selection over all six positions                             | Not applicable                                                                                    |
| Revision, numbering enabled  | Current position is the default            | Existing non-reserved content is preselected among the other five positions | Show the preserved conflict and offer an explicit clear action before the five-position selection |
| Revision, numbering disabled | Not asked                                  | Existing content is preselected across all six positions                    | No position is reserved                                                                           |

The reserved position is never offered for new repeating content. If revision
finds existing content there, it remains preserved by default so entering the
revision flow cannot delete data. The explicit clear action resolves that one
conflict without turning the reserved position into another authorable content
slot.

## Enabled Page-Number Flow

The ordinary enabled path should be:

```text
Enable page numbering in this Profile? Yes
  |
  +-- Number which pages?
  |     Body pages, starting at 1
  |     Entire document, starting at 1
  |
  +-- Page-number label
  |     Page 1        (recommended)
  |     1             (compact)
  |     Custom...
  |
  +-- Page-number position
  |     one of the six human-readable positions
  |
  +-- Show the shared layout with that position reserved
  |
  +-- Add repeating header/footer text?
        No
        Yes -> select from the other five positions
```

The behavior choices retain the first-pass mappings:

| Guided choice                  | `scope`    | `countFrom` | `start` | `increment` |
| ------------------------------ | ---------- | ----------- | ------: | ----------: |
| Body pages, starting at 1      | `body`     | `body`      |     `1` |         `1` |
| Entire document, starting at 1 | `document` | `document`  |     `1` |         `1` |

`Body pages, starting at 1` remains the fresh `formal-guide` default. This is
an opinionated authoring default, not a change to the normalized Profile
default or to existing Profiles.

## Page-Number Labels And Ghost Input

The common label choices should compile to existing `pageNumbers.format`
values:

| Choice                 | Stored format                       |
| ---------------------- | ----------------------------------- |
| `Page 1` — recommended | `Page {page}`                       |
| `1` — compact          | `{page}`                            |
| `Custom...`            | validated input containing `{page}` |

The custom route should use the shared inline ghost-input behavior rather than
printing a dense explanation as another question:

```text
Custom page-number label
> Page {page} of {pages}

{page} is the current logical page number.
{pages} is the total physical number of pages in the PDF.
```

The ghost is a suggestion, not a persisted value. The user must deliberately
accept or type the label. On revision, an existing label is the editable
initial value; the ghost remains secondary guidance and must not replace it.

Guided custom input should reject an empty value and require `{page}` so the
result remains a page-number label. Common help teaches `{page}`, optional
`{pages}`, literal text, punctuation, and digits. For example,
`Page {page}/{pages}` follows the rendered PDF, while `Page {page}/5` contains
a literal `5` that can become stale.

Existing metadata placeholders remain accepted because
`pageNumbers.format` already uses the shared page-content resolver. The common
label prompt should not promote metadata as another page-number concept, but
must preserve a value such as `{company} — Page {page} of {pages}` during
revision and save/reload testing.[^metadata]

No new total token belongs in this phase. `{pages}` retains its existing
physical-document meaning. A future logical or numbered-body total would need
separate renderer and template-language research rather than overloading the
current token.[^placeholder-contract]

## Shared Ghost Interaction Contract

Markdown PDF should reuse the shared `promptTextWithGhost` interaction used by
custom rename templates.[^ghost-prompt] It should add Markdown-PDF-specific
completion contexts rather than interpreting page-content tokens through the
rename-template candidate resolver.

In an advanced terminal, the interaction is:

```text
Custom page-number label
> Page {page} of {pages}
  ---------------------- dimmed suggestion

Tab / Right arrow   accept the visible suggestion
Up / Down arrow     cycle candidates when the current fragment has alternatives
typing              update or dismiss the suggestion
Enter               validate and submit only the actual input value
Escape / Ctrl-C     retain the shared cancellation behavior
```

An unaccepted ghost is never the submitted value. `Enter` on an empty custom
label therefore fails validation even while a suggestion is visible.

The shared helper should gain an optional `initialValue`. Advanced mode starts
with that real editable value; simple mode passes it as the ordinary input
default. A ghost remains secondary guidance and must not overwrite a revision
value.

| Context                            | Initial value  | Empty-input ghost and fragment candidates                                                                    | Validation                                                        |
| ---------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| Fresh custom page-number label     | empty          | Full ghost `Page {page} of {pages}`; `{page}` and `{pages}` fragment candidates                              | Nonempty and contains `{page}`                                    |
| Revised custom page-number label   | stored format  | No replacement full ghost over the initial value; page-token candidates when editing a matching fragment     | Same custom-label validation                                      |
| Fresh repeating-content position   | empty          | Slot-aware full ghost; `{title}`, `{company}`, `{author}`, and `{date}` fragment candidates                  | Nonempty for a selected position                                  |
| Revised repeating-content position | stored content | No replacement full ghost over the initial value; metadata-token candidates when editing a matching fragment | Preserve unless edited or the position is deliberately unselected |

When a typed fragment has multiple candidates, Up and Down cycle them and Tab
or Right arrow accepts the visible suffix. Static full ghosts continue to use
Tab or Right arrow acceptance without implying a stored default.

Fresh simple mode prints the same help and suggestion, then uses ordinary input
with the same validation:

```text
Page-number label suggestion: Page {page} of {pages}
{page}: current logical page number
{pages}: total physical PDF pages

Custom page-number label:
```

During revision, simple mode uses the stored value as the ordinary input
default and prints the token help, but suppresses the fresh full suggestion so
it cannot appear to be an alternate default. Any other explanatory example is
never serialized unless the user enters it.

The same rule applies to repeating content: fresh simple input may print its
slot-aware suggestion and metadata-token help, while revision uses stored
content as the default, retains the token help, and suppresses the fresh
slot-aware suggestion.

Simple mode does not promise raw-key acceptance or candidate cycling. This is
an interaction fallback only; it must compile the same answer as advanced
mode.

The current `formal-guide` prompt factory has no runtime prompt context even
though `runMarkdownPdfAuthoring` already receives it. Fresh preparation and
recipe revision should pass that existing context into the prompt factory so
the shared helper can select advanced or simple behavior consistently. This
plumbing must not create another runtime-config source or change existing Back,
Cancel, Escape, and Ctrl-C semantics.

## Disabled Page-Number Flow

Disabling page numbers should remove all page-number-dependent questions but
must not remove the independent repeating-content route:

```text
Enable page numbering in this Profile? No
  |
  +-- Skip numbering outcome, label, and position
  |
  +-- Add repeating header/footer text?
        |
        +-- No -> continue to review
        |
        +-- Yes
              +-- all six positions are available
              +-- select one or more positions
              +-- enter text with placeholder ghost hints
```

Valid inert page-number values should remain available for same-session
revision and round-trip compatibility. Ordinary review should say that page
numbering is disabled rather than presenting those inactive details as if they
affect the current output.

## Repeating Content And Metadata Hints

After the user chooses to add repeating content, a checkbox-style position
selection is more direct than a second `Header`, `Footer`, or `Both` routing
question. Enabled page numbers remove their owned position from the selectable
set. Disabled page numbers leave all six positions selectable.

Only selected positions should prompt for content. Slot-aware ghost
suggestions can introduce useful existing placeholders without filling the
Profile automatically:

| Position      | Ghost suggestion |
| ------------- | ---------------- |
| Header left   | `{title}`        |
| Header center | `{company}`      |
| Header right  | `{date}`         |
| Footer left   | `{author}`       |
| Footer center | `{title}`        |
| Footer right  | `{date}`         |

The prompt help should state that placeholder values may come from CLI
metadata, Markdown frontmatter, or Profile metadata. Resolution retains the
current precedence: CLI metadata, then Markdown frontmatter, then Profile
metadata. Unknown or missing metadata values follow the current resolver and
render as empty text. Literal text remains valid.[^metadata]

Ghost support should extend the shared inline prompt helper with an optional
editable initial value. A separate Markdown-PDF-only terminal implementation
would duplicate keyboard, cancellation, and rendering behavior.

## Revision And Collision Behavior

Revision continues to expose independent actions for page numbering and
repeating page content.

The page-number transition contract is:

| Transition                                     | Outcome, arithmetic, label, and position behavior                                                                                         |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Fresh -> disabled                              | Skip dependent prompts; retain the normal inert Profile defaults                                                                          |
| Fresh -> enabled                               | Default to body/body, `start: 1`, `increment: 1`, `Page {page}`, and bottom center                                                        |
| Enabled -> disabled                            | Change only `enabled`; retain every valid inert page-number value and release the owned position                                          |
| Disabled -> enabled                            | Ask outcome, label, and position again; fix arithmetic to `1`/`1`; default each directly representable choice from retained values        |
| Enabled -> revise enabled                      | Use the same guided prompts and defaults as disabled -> enabled                                                                           |
| Accepted candidate -> save/reload verification | Preserve the compiled Profile through serialization and normalization; this is verification, not another Interactive revision entry point |

Outcome defaults retain body/body or document/document when the current values
match those guided choices. An advanced scope/origin combination cannot be
represented by this flow and defaults to body/body; accepting the guided
revision deliberately replaces it. `start` and `increment` likewise return to
`1` because they are not guided fields.

Label revision preselects `Page 1` for `Page {page}`, `1` for `{page}`, and
`Custom...` for every other value. The custom route exposes that value as
editable initial input. Position defaults to the valid current position.

Interactive currently revises only the accepted candidate retained within the
same `formal-guide` authoring session. Loading an arbitrary saved Profile back
into Interactive revision would be a separate product flow and is outside this
phase. Save/reload tests prove persistence and normalization compatibility
without claiming that entry point exists.

Repeating-content revision preselects non-reserved positions that already
contain text. Leaving a selected value unchanged preserves it; unselecting a
position deliberately clears its text. Advanced style and separator values
remain preserved because the simplified terminal cannot recreate them.

Moving a page number onto populated content preserves that content and shows
the existing collision diagnostic. The page number continues to win at render
time until the user accepts the explicit conflict-clear action, chooses another
position, or edits the Profile. Ghost examples remain non-authoritative and
never replace revision initial values.

The review should summarize the effective result using user-facing terms and
show the six-position ownership when it helps resolve a collision.

## Profile YAML Owns Advanced Configuration

The generated Profile remains the complete editable surface:

| Advanced need                                     | Profile field or behavior                                                |
| ------------------------------------------------- | ------------------------------------------------------------------------ |
| Hidden front matter that contributes to numbering | `scope: body` with `countFrom: document`                                 |
| Custom first number                               | `start`                                                                  |
| Non-unit sequence                                 | `increment`                                                              |
| Page-header/footer typography                     | `header.style` or `footer.style`                                         |
| Separator line                                    | `header.style.separator` or `footer.style.separator`                     |
| Deliberate slot collision                         | Configure the slot and accept the existing warning/page-number-wins rule |

Custom labels are no longer YAML-only, but YAML remains the appropriate place
for advanced label combinations and every full sequence or style field.

## Render-Time And Direct CLI Boundaries

The Interactive one-render choice remains a small tri-state:

```text
Keep recipe setting
Turn on for this PDF only
Turn off for this PDF only
```

It retains the same placement, navigation, state retention, reset rules, and
compilation to `undefined`, `true`, and `false` proven by the completed
selected-source and generated/saved lifecycle phases.[^render-choice]

Direct `md to-pdf` continues to expose only `--page-numbers` and
`--no-page-numbers`. These flags change only the current render and reuse
Profile or normalized-default details. Detailed flags would duplicate the
Profile schema and remain outside this follow-up.[^command]

`md pdf-profile init` should not gain a parallel family of page-number flags.
A serialized disabled block does not print page numbers; only effective
`enabled: true` does.

## Project And Codex Assistant Boundary

Interactive Project preparation remains Codex Assistant-only. Durable
page-number settings belong to the generated bundle's contained `profile.yml`,
and the existing one-render choice may temporarily enable or disable them.

This phase must not pass a free-form answer as if it were structured
page-number authority. A future canary can research dedicated Profile and
Project Codex signals, provenance, revision, and sparse output behavior. Until
then, exact Project page-number configuration is performed by editing
`profile.yml` and rendering the bundle normally.

## Reopened Implementation And Validation Direction

The reopened Phase 14 work should prove:

1. user-facing prompts and review do not require the term `page chrome`
2. enabled numbering offers the two existing outcomes, three label routes, and
   all six human-readable positions
3. label presets and custom input compile to exact existing `format` values
4. custom input teaches `{page}` and `{pages}` without changing either token
5. the shared layout reserves exactly the enabled page-number position
6. disabled numbering skips dependent questions and makes all six repeating
   content positions available
7. selected repeating-content positions preserve literal text and metadata
   placeholders through Profile save and reload
8. ghost suggestions do not become values without deliberate acceptance and
   do not replace revision initial values
9. advanced mode accepts and cycles Markdown-PDF-specific candidates with the
   shared keys, while simple mode prints equivalent help and returns the same
   compiled answer
10. fresh preparation and revision receive the existing prompt runtime context
    without changing navigation or cancellation behavior
11. revision preserves advanced styles, inactive values, and occupied-content
    collision diagnostics
12. direct, Interactive render-time, Project, Template, schema, and renderer
    ownership remain unchanged

Focused prompt, collection, compilation, persistence, review, and lifecycle
tests should be followed by broad Interactive and Markdown PDF regressions,
TypeScript, lint, formatting, build, and diff checks. Custom-label persistence
coverage should include one existing metadata placeholder alongside `{page}`
and `{pages}`. A bounded save-only smoke should cover enabled custom-label and
disabled repeating-content paths.

The live renderer matrix does not need to repeat unless implementation changes
normalized behavior, renderer CSS, scenario inputs, or evidence acceptance.

## First Implementation Checkpoint — 2026-08-14

The first Phase 14 pass implemented the original simplification and recorded
its full validation and review trail in the
[first Phase 14 Interactive UX job record][first-phase-14-job]. Its final
implementation/test review range is `7bbdc140..cdea2b23`; the subsequent
documentation-only closeout tip is `0294b4ad`.

That checkpoint proves both guided numbering outcomes, all six positions,
fresh slot ownership, disabled-state retention, revision-time collision
diagnostics, simplified-value reset, and deterministic Profile save/reload. A
built-CLI save-only smoke produced the expected `schemaVersion: 3` Profile with
body-origin numbering at bottom center, then removed its scoped scratch output.

Because the first pass did not change normalized Profile behavior, renderer
CSS, scenario inputs, or evidence acceptance, it correctly retained the
existing renderer matrix.

This evidence remains valid historical proof. Reopening the research does not
reinterpret that implementation as incomplete; it records a newly identified
usability refinement before Phase 15 guidance closeout.

## Settled Direction

- Use page numbers and repeating page content as the user-facing concepts.
- Present one six-position layout and reserve the enabled page-number slot.
- Offer `Page 1`, `1`, and ghost-guided custom page-number labels.
- Keep `{pages}` as the physical PDF total and defer logical-total semantics.
- Teach existing metadata placeholders through non-authoritative ghost hints.
- Preserve advanced sequence, style, separator, and deliberate-collision
  settings in Profile YAML or JSON.
- Preserve the simple one-render override and current Project/Template/Codex
  Assistant boundaries.

The reopened implementation completed in reviewed range
`0294b4ad..3400e2d0`. Focused, broad, repository-wide, static, build, and two
save-only Interactive smoke paths passed. The initial test review's four
coverage findings were resolved before the widened range was re-reviewed with
no remaining material findings. The [reopened Phase 14 job][reopened-phase-14-job]
records the detailed evidence.

## Related Research

- [Markdown PDF Page-Number Configuration][page-number-research]
- [Markdown PDF Profile Revision And Feature Compatibility][profile-revision-research]
- [Pattern, Placeholder, and Template Language Guide][pattern-language-research]
- [Markdown PDF Interactive Code Highlighting][interactive-code-research]

## Related Plans

- [Markdown PDF Page-Number Configuration Implementation][page-number-plan]
- [Reopened Phase 14 Interactive UX job record][reopened-phase-14-job]

## References

[^first-checkpoint]: [First Phase 14 Interactive UX job record][first-phase-14-job]

[^placeholder-contract]: [Current page-number placeholder contract](research-2026-08-11-markdown-pdf-page-number-configuration.md) and [Markdown PDF usage guide](../guides/markdown-pdf-usage.md)

[^metadata]: [Profile metadata precedence and header/footer placeholder guidance](../guides/markdown-pdf-usage.md)

[^ghost-prompt]: [Shared inline ghost prompt](../../src/cli/prompts/text-inline.ts) and [custom rename-template usage](../../src/cli/interactive/rename/pattern.ts)

[^render-choice]: [Interactive one-render page-number choice](../../src/cli/interactive/markdown/render-page-numbers.ts) and [effective review](../../src/cli/interactive/markdown/page-number-review.ts)

[^command]: [Markdown command registration](../../src/cli/commands/markdown.ts) and [Profile initializer](../../src/cli/actions/markdown/pdf-profile-init.ts)

[first-phase-14-job]: ../plans/jobs/2026-08-14-markdown-pdf-page-number-phase-14-interactive-ux.md
[interactive-code-research]: research-2026-07-23-markdown-pdf-interactive-code-highlighting.md
[page-number-plan]: ../plans/plan-2026-08-12-markdown-pdf-page-number-configuration.md
[page-number-research]: research-2026-08-11-markdown-pdf-page-number-configuration.md
[pattern-language-research]: research-2026-08-11-pattern-placeholder-and-template-language-guide.md
[profile-revision-research]: research-2026-08-14-markdown-pdf-profile-revision-and-feature-compatibility.md
[reopened-phase-14-job]: ../plans/jobs/2026-08-15-markdown-pdf-page-number-phase-14-reopened-interactive-ux.md
