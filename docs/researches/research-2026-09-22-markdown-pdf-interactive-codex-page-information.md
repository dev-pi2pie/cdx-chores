---
title: "Interactive Markdown PDF Codex Page Information Signals"
created-date: 2026-09-22
modified-date: 2026-09-23
status: in-progress
agent: codex
---

## Goal

Define how Interactive Codex Assistant collects explicit page-number and
repeating page content (header/footer text) choices for Markdown PDF Profile
and Project preparation. The answers should become stable, reviewable input to
the Profile helper and produce the existing Profile contract.

This feature adds no page-information flags to `md pdf-profile init`,
`md pdf-profile codex`, `md pdf-project codex`, or `md to-pdf`. Direct commands
continue to write or read an editable Profile. It also adds no model-generated
clarification round, new Profile schema, or renderer behavior.

## Current Boundary

- Profile `formal-guide` already asks whether to enable page numbers, which
  ordinary pages to number, the label and position, then whether to add
  repeating header/footer text in the remaining positions. It compiles those
  answers into `pageNumbers`, `header`, and `footer`.[^formal-guide]
- `md pdf-profile init` writes `header: {}`, `footer: {}`, and disabled page
  numbers. Its inert defaults include `scope: body`, `countFrom: document`,
  `format: "{page}"`, and `position: bottom-center`. A fresh enabled Formal
  Guide choice instead defaults to body pages starting at 1 and recommends
  `Page {page}`.[^profile-defaults]
- The Codex Profile helper can patch page-number and header/footer fields, but
  its Interactive setup currently supplies only a sample, free-form intent,
  font hints, and an optional base Profile. Supported patch paths do not make
  an explicit page-information answer authoritative.[^profile-helper]
- Interactive Project preparation uses that Profile helper for its contained
  `profile.yml`, followed by Template preparation from the final Profile.
  Template-only preparation writes HTML/CSS and does not author a Profile.
  Neither Profile nor Project signal classification recognizes explicit page
  information today.[^project-helper]
- Direct `md to-pdf --page-numbers` and `--no-page-numbers` change only one
  render's enablement. Reusable page policy remains in the Profile.[^usage]

The completed [Interactive page-number UX research](research-2026-08-14-markdown-pdf-interactive-page-number-and-page-chrome-ux.md) deferred
structured Profile/Project Codex authority. This research addresses that
follow-up and the repeating-content slots coupled to page-number placement.
The accepted renderer meanings and page roles remain in
[Page Roles And Counter Semantics](research-2026-08-15-markdown-pdf-page-roles-and-counter-semantics.md).

The decisions below are settled for implementation planning. Implementation
and verification remain pending.

## Proposed Scope

Only Interactive Codex Assistant for **Profile** and **Project** collects the
new page-information answers. Template-bundle preparation skips the section.
The direct Profile and Project Codex commands keep their current options:
`--intent` gives advisory direction, and the generated Profile can be edited
for exact page information before deterministic rendering. The Project bundle
contains `profile.yml`; a standalone Profile helper uses its selected YAML or
JSON output path.

The Interactive input has two independent groups:

| Group                  | Explicit answers                                           | Final Profile owner |
| ---------------------- | ---------------------------------------------------------- | ------------------- |
| Page numbers           | OFF, or ON with body/document outcome, label, and position | `pageNumbers`       |
| Repeating page content | OFF, or ON with selected positions and content             | `header`, `footer`  |

Each group can be **unspecified**, **OFF**, or **ON**. Unspecified means the
user did not give exact direction for that group; it is not an instruction to
disable it. The user can choose either group or both. This sparse distinction
must survive setup revision, Codex preparation, reports, and final validation.

The existing [font-hint editor](../guides/markdown-pdf-interactive-usage.md#font-hints) stays separate. Its
guided `Page headers and footers` preference can inform Codex's shared
`fonts.pageChrome.default` choice. A page number uses that family and the style
of its selected header or footer area. Explicit page-information answers do
not select or clear fonts.

The new page-information section does not expose independent
`scope`/`countFrom`, custom `start`/`increment`, header/footer typography,
separator styling, or advanced cover and ToC policy. Those remain in the
Profile schema and existing authoring routes.

## Interactive Flow

Collect page information after optional Markdown sample selection and before
the PDF intent. Reuse Formal Guide's ordinary choices, six-position layout,
placeholder help, and reserved-slot interaction. The first page-information
question asks whether the user wants to specify anything; skipping it leaves
both groups unspecified. Inside a selected group, its ON/OFF question is an
explicit answer.

```text
Choose artifact
  |
  +-- Template bundle ----------------------> existing Template setup
  |
  +-- Profile or Project
        |
        v
      Choose Markdown sample, if needed
        |
        v
      Set page information explicitly?
        +-- No -> both groups unspecified -> skip to PDF intent
        |
       Yes
        |
        +-- Choose page numbers, repeating page content, or both
        |
        +-- Page numbers selected -> ON or OFF
        |     ON -> body/entire document -> label -> position
        |
        +-- Repeating page content selected
              Add repeating header or footer text? -> Yes or No
              Yes -> choose free positions -> text/placeholders
              No  -> clear all six content slots; preserve styles
        |
        v
      Resolve any remaining page-number slot conflict
        |
        v
      Enter PDF intent
        |
        v
      Setup menu: review choices / edit Page information / continue
        |
        v
      Review preparation (consent only for Codex requests)
        |
        v
      Prepare Profile: deterministic or Codex-assisted
        |
        v
      Apply exact answers -> validate final Profile
        |
        +-- Project -> Template preparation from final Profile
        |
        v
      Review final Profile and diagnostics
        |
        +-- change setup -> edit either page-information group
        +-- save Profile or bundle / render through existing lifecycle
```

Formal Guide currently asks `Enable reusable page numbers in this Profile?`
and `Add repeating header or footer text?`. The Project route may need a
surface-specific wording for the first question because its Profile is
contained in a bundle. The repeating-content question can be reused within the
selected group. A Yes answer uses `Repeating-content positions`, then a
position-specific prompt such as `Header left content`. Recipe review uses
`Revise repeating page content`. The six positions are Header/Footer left,
center, and right; each selected position accepts literal text or `{title}`,
`{company}`, `{author}`, and `{date}`. The page-number position is unavailable
for new repeating page content.[^formal-guide]

The setup menu gains a `Page information` action with separate edit paths for
the two groups. Changing either answer invalidates a previously prepared
candidate; unchanged setup may retain it. Recheck conflicts when the base
Profile or page-number position changes, preserving explicit content choices.
Project keeps its existing Profile and Template phases. This feature adds no
model-generated options or extra clarification request.

## Defaults And Authority

The three states of each group have different effects:

| State       | Page-number effect                                                                    | Repeating page content effect                                                                   |
| ----------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Unspecified | Existing base/candidate and Codex decision remain available.                          | Existing base/candidate and Codex decision remain available.                                    |
| OFF         | Final Profile has `pageNumbers.enabled: false`; valid inert details remain available. | All six content slots are cleared; header/footer styles and font configuration are preserved.   |
| ON          | Guided outcome, label, and position become exact Profile values.                      | Selected content is exact; unselected slots clear, except an explicitly retained reserved slot. |

For a fresh page-number ON answer, the guided defaults are body pages starting
at 1, `Page {page}`, and bottom center. Choosing entire document changes both
`scope` and `countFrom` to `document`; choosing body sets both to `body`.
`start` and `increment` remain 1. These are Formal Guide authoring choices,
not a change to `md pdf-profile init` defaults. The user can choose another
supported label or position through the same guided controls.

An explicit page-information answer takes priority over conflicting free-form
intent. A base Profile supplies starting values for unspecified fields; Codex
may recommend changes only where the user has not made an exact choice. The
accepted final normalized Profile must be checked against the explicit
answers before save or Project Template preparation. Apply the locally
collected answers deterministically after candidate preparation, then
normalize and validate. Prompt instructions alone do not enforce this
contract. Review and reports distinguish explicit answers from inherited or
Codex-selected values and show any retained slot conflict.

Page information alone must be valid Interactive input. Today the Profile
signal mode uses sample, intent, and font hints, while Project can classify a
run with none of its recognized inputs as too low-signal. The new answers must
not be lost or rejected when the user leaves PDF intent blank. Page-info-only
input, with or without a base Profile, uses deterministic preparation. Other
signals keep the existing rules for deciding whether each phase needs Codex.
Both paths use the same candidate review and final Profile validation.

## Review, Safety, And Validation

- Align the Profile helper prompt with the implemented four-token contract:
  `{page}` and `{pages}` are logical, while `{pdfPage}` and `{pdfPages}` are
  physical. Its current caution about total-page labels predates the proven
  logical-final and physical-total semantics.[^page-roles]
- Preserve page roles: a dedicated cover has no repeating page content or page
  number; ToC pages may have configured repeating page content and only
  document-scoped numbers; body pages follow the effective Profile. A metadata
  title belongs to body content unless the cover owns it.
- Keep the chosen page-number slot distinct from explicitly selected
  repeating page content. Resolve remaining inherited collisions with the
  explicit clear-or-retain interaction described below. Retained conflicts
  must be visible in candidate review before save.
- Show the requested answers, final Profile fields, and material conflicts in
  both Profile and Project candidate review. The current Project summary
  includes page-number settings but needs repeating page content visibility.
- Include page-information answers in setup equality, consent, dry-run,
  optional reports, and success and failure paths. When Codex runs, send the
  entered text as bounded structured input with placeholders unresolved.
  Consent shows the text being sent; local materialization preserves the
  exact collected values. Reports follow existing redaction rules and
  accurately identify deterministic preparation versus model requests.
- Continue to use shared Profile normalization, patch validation, capability
  advisories, and diagnostics. Authoring does not probe the installed
  renderer. The existing Interactive one-render page-number choice remains a
  separate transient override.

The implementation plan should verify fresh and revised Interactive Profile
and Project paths, explicit ON/OFF versus omission, page-info-only input,
base-Profile preservation, unselected-slot clearing, clear/retain conflict
choices, and OFF clearing even an occupied reserved slot while preserving
styles. Also verify literal-text preservation, report redaction, no model
request for page-info-only input, final Profile round trips, and Project
Template compatibility. Verify that accepted or inherited
`fonts.pageChrome.default` survives explicit Profile and Project
page-information answers, including OFF, when a `Page headers and footers` font
hint is also present. Existing renderer evidence can be reused unless generated
HTML/CSS or effective render behavior changes.

## Settled Decisions

1. **Selected positions define the final repeating content.** Preselect
   occupied eligible positions from the base Profile on first edit. Checked
   positions retain their content unless edited; unchecking clears them.
   Revisions start from the current answers and use the same rule. Leaving the
   group unspecified imposes no clearing. A conflicting reserved position is
   handled separately by decision 4. This follows Formal Guide's existing
   selection behavior.[^formal-guide]
2. **Send entered text as data; preserve it locally.** When Codex is needed,
   include exact entered text in bounded structured signals so it can account
   for language and length. Keep metadata placeholders unresolved. The model
   must not rewrite explicit content; final materialization applies the local
   values regardless of the model's response. Reuse the existing consent and
   report-redaction flow rather than adding a text-summary mechanism or
   another clarification round.
3. **Page-info-only preparation is deterministic.** Apply exact answers to
   the normalized base Profile or default Profile without calling Codex.
   Project accepts this as sufficient input and uses its existing
   deterministic Template preparation to create a compatible bundle from the
   final Profile. Sample, intent, font hints, or other recognized signals
   retain their existing execution rules. Show that no model request occurred
   when preparation is deterministic.[^project-helper]
4. **Offer explicit clearing for an occupied page-number position.** After
   applying the requested content changes, reuse Formal Guide's question:
   `Clear existing <position> content that conflicts with page numbering?`,
   defaulting to No. Yes clears the conflicting slot; No retains its stored
   content and shows a warning in candidate review. The slot remains owned by
   page numbering while enabled, so retaining text does not promise that it
   will render. Users can move the number through the existing revision flow.
   Reserve the number position to prevent new collisions. Explicit repeating
   content OFF clears all slots first and needs no conflict question.
   [^conflict-behavior]
5. **OFF clears text and preserves styles.** Clear all six header/footer
   content slots while retaining header/footer styles and font configuration.
   These styles are not necessarily inert: enabled page numbers also use
   their area's style. Formal Guide currently has an exception that can
   retain a reserved slot after OFF when its clear question is declined. The
   new explicit OFF contract excludes that exception. Before reusing shared
   collection logic, the implementation plan must reconcile this difference
   and verify both authoring paths; it must not silently inherit the
   exception.[^off-behavior]

## Related Research

- [Markdown PDF Page Roles And Counter Semantics](research-2026-08-15-markdown-pdf-page-roles-and-counter-semantics.md)
- [Markdown PDF Interactive Page Numbers And Repeating Page Content UX](research-2026-08-14-markdown-pdf-interactive-page-number-and-page-chrome-ux.md)
- [Markdown PDF Codex Helper Roadmap](research-2026-06-10-markdown-pdf-codex-profile-and-interactive-flow.md)

## Related Plans

- [Markdown PDF Interactive Codex page information implementation](../plans/plan-2026-09-23-markdown-pdf-interactive-codex-page-information.md)
- [Markdown PDF page-number configuration implementation](../plans/plan-2026-08-12-markdown-pdf-page-number-configuration.md)

[^formal-guide]: [Interactive Markdown PDF Usage](../guides/markdown-pdf-interactive-usage.md) and [Formal Guide collection](../../src/cli/interactive/markdown/formal-guide/collection.ts).

[^profile-defaults]: [Profile defaults](../../src/cli/markdown-pdf/profile/defaults.ts) and [Profile initialization](../../src/cli/markdown-pdf/profile/init-service.ts).

[^profile-helper]: [Markdown PDF Codex Profile Helper guide](../guides/markdown-pdf-codex-profile-helper.md) and [Profile signal mode](../../src/cli/markdown-pdf/profile-codex/signal-mode.ts).

[^project-helper]: [Markdown PDF Codex Project Helper guide](../guides/markdown-pdf-codex-project-helper.md), [Project signal mode](../../src/cli/markdown-pdf/project-codex/signal-mode.ts), and [Template output plan](../../src/cli/markdown-pdf/template-codex/output-plan.ts).

[^usage]: [Markdown PDF Usage](../guides/markdown-pdf-usage.md).

[^page-roles]: [Completed page-role research](research-2026-08-15-markdown-pdf-page-roles-and-counter-semantics.md).

[^conflict-behavior]: [Formal Guide prompts](../../src/cli/interactive/markdown/formal-guide/prompts.ts), [Formal Guide collection](../../src/cli/interactive/markdown/formal-guide/collection.ts), and [Page chrome generation](../../src/cli/markdown-pdf/profile/page-chrome.ts).

[^off-behavior]: [Formal Guide collection](../../src/cli/interactive/markdown/formal-guide/collection.ts) and [Page chrome generation](../../src/cli/markdown-pdf/profile/page-chrome.ts).
