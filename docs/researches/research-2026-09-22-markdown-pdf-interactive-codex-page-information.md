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

## Starting Boundary

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
  at the start its Interactive setup supplied only a sample, free-form intent,
  font hints, and an optional base Profile. Supported patch paths alone did not
  make an explicit page-information answer authoritative.[^profile-helper]
- Interactive Project preparation uses that Profile helper for its contained
  `profile.yml`, followed by Template preparation from the final Profile.
  Template-only preparation writes HTML/CSS and does not author a Profile.
  Neither Profile nor Project signal classification recognized explicit page
  information at the starting boundary.[^project-helper]
- Direct `md to-pdf --page-numbers` and `--no-page-numbers` change only one
  render's enablement. Reusable page policy remains in the Profile.[^usage]

The completed [Interactive page-number UX research](research-2026-08-14-markdown-pdf-interactive-page-number-and-page-chrome-ux.md) covers
the existing guided page-number and page-chrome choices. This research defines
structured Profile/Project Codex authority for those choices and their
repeating-content slots.
The accepted renderer meanings and page roles remain in
[Page Roles And Counter Semantics](research-2026-08-15-markdown-pdf-page-roles-and-counter-semantics.md).

The Profile data, conflict semantics, optional report projection, and local
consent/review text display below are settled. The linked plan and job record
contain the implementation and verification evidence.

## Report Data Contract

The saved Profile keeps the entered page-number label and header/footer text
exactly. Codex receives that text only after consent and only when a request
is needed. These answers are page text, not filesystem paths; the feature does
not generate paths from them.

The report is the existing optional Codex diagnostic report for a Profile or
Project, not a separate page-information artifact. When either group has an
explicit answer, add the same small page-information section to either
report:

| Group | Requested choice | Final metadata (when a Profile is validated) |
| ----- | ---------------- | -------------------------------- |
| Page numbers | Unspecified/OFF/ON; for ON, selected scope, count origin, and position with derived start/increment of 1 | Enabled state, scope, count origin, start, increment, and position. Details retained while OFF are stored but inactive. |
| Repeating content | Unspecified/OFF/ON; for ON, selected header/footer positions | Positions with nonempty text stored in the final Profile. Record a reserved number position and its clear/retain outcome when relevant. |

The stored positions do not claim that text rendered. A retained reserved slot
remains in the Profile while page numbering owns its position. If no usable
Profile exists, omit final metadata. If both groups are unspecified, omit the
section. Do not report content provenance for the group or individual slots:
slots can mix entered, inherited, and Codex-selected text, and position alone
does not establish its source. The requested state records the explicit choice,
not the origin of every stored value. Local review may show verified
provenance. Existing report fields describe execution, so the new section does
not repeat request modes or counts.

The new page-information and model-result fields never copy the collected or
final page-number label or header/footer text, nor any preview, length, hash,
or raw Profile fragment. Codex can echo that text in existing report fields.
For explicit page-information runs, use this projection:

| Report | Keep | Omit or replace with fixed, value-free detail |
| ------ | ---- | ---------------------------------------------- |
| Profile | Result status, selected preset, changed top-level field names, and failure kind | Full `decision`, accepted patch and font values, unmatched-direction text, warning/fallback prose, and raw failure messages |
| Project | Project and phase modes, validation status, and fixed diagnostic condition IDs | Phase/project fallback and warning prose, unsupported-direction text, raw validation and handoff messages, and diagnostic contexts |

For Project reports, retain diagnostic condition IDs in the value-free summary
and leave persisted `handoff.diagnostics` empty on these runs; local review
uses the original diagnostics. Keep required warning and direction arrays
present but empty when their source text is withheld. The presence of the
page-information section identifies this value-free projection, including
deterministic runs; empty arrays do not claim that no warnings occurred.

Set `pageInformation.modelResultDetails` from actual execution: `not-requested`
when no model call was attempted, including failure before a call; `omitted`
when any call was attempted, including an unsuccessful one. Result status and
failure kind distinguish success from failure. Keep required messages
structurally valid with fixed text; never serialize original prose in those
placeholders. Local consent and review use the original in-memory result so
report omission does not remove
feedback there.

This is a field-specific projection for Interactive runs with explicit page
information. Direct commands and runs with both groups unspecified keep their
existing reports. Independently entered intent and font hints retain their
current report behavior, even if a user repeats the same words there. Do not
copy structured page answers into those fields or change the shared path
redactor.

Keep the Profile report at version 4: its reader accepts an absent optional
decision and additional metadata. Keep the Project report discriminator; it
has no full reader. This preserves structural reading, while the marker makes
the deliberate loss of model prose visible to consumers that inspect it.
Existing consumers may no longer receive that prose on explicit
page-information runs. In Phase 4, validate the new optional section when the
Profile reader encounters it while continuing to accept older version-4
reports without the section. Check the Project writer's projection directly;
bundle recognition only checks its discriminator. Test deterministic, model,
and failure cases, direct commands, and a model echo in patches and prose.
Use one synthetic marker only in structured page text and assert it is absent
from the entire serialized report. Separately test an independent intent
marker that remains in its existing input field. Assert that the saved Profile
keeps the exact page text.
Record the gate evidence in the single
[implementation job record](../plans/jobs/2026-09-23-markdown-pdf-interactive-codex-page-information.md).

## Terminal Presentation Contract

Follow [CLI Output And Color](../guides/cli-output-and-color.md) for all new
setup, consent, review, and warning lines. Keep plain text canonical and use
the shared per-stream picocolors wrapper for eligible TTY presentation. Respect
runtime color, `NO_COLOR` even when empty, global `--no-color`, and redirected
stdout or stderr independently. `FORCE_COLOR` does not override that policy.
Style fixed labels or headings only; the warning role emphasizes `Warning:`
while its body remains plain. Never put ANSI styling in reports, recipes, or
PDFs.

Local consent shows entered page text; candidate review shows entered and
model-proposed page text where applicable. Both use an escaped terminal
representation without path masking. Escape control and formatting characters,
including C0/C1, bidirectional controls, and Unicode line and paragraph
separators before interpolation. This affects display only: save the original
text in the Profile and send the original entered text as structured model
input after consent. Do not use the diagnostic-report path redactor as a
terminal formatter. Build local review
from the original preparation and validated Profile, separately from the
reduced optional report, so warnings and fallback details remain visible.
Removing ANSI from styled output must preserve the same wording, spacing, and
stream routing as plain output.

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
must survive setup revision, Codex preparation, and final validation. Its
optional report representation follows the metadata-only projection above.

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
      Apply exact answers -> normalize and check conflicts
        +-- unresolved conflict -> local setup revision
        |
        v
      Validate final Profile
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
the two groups. Each group offers `Remove explicit choice` to return ON or OFF
to unspecified without changing the other group's answer. Removal restores
base/Codex authority on the next preparation; it does not disable numbers or
clear text, and the previous prepared Profile is not the new base. Changing or
removing either answer invalidates a previously prepared candidate; unchanged
setup may retain it. Recheck conflicts when the base Profile, page-number
position, or either group's explicit authority changes, preserving the other
group's explicit choices and discarding obsolete conflict decisions.
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
contract. Candidate review distinguishes explicit answers from inherited or
Codex-selected values and shows any retained slot conflict. Report content
follows the separately decided projection.

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
  repeating page content. Recheck after local materialization and normalization
  because Codex can introduce a collision that was absent during setup. Use
  decision 6 below for unresolved conflicts; retained conflicts must be visible
  in candidate review before save.
- Show the requested answers, final Profile fields, and material conflicts in
  both Profile and Project candidate review under the decided terminal display
  policy. At the starting boundary, the Project summary included page-number
  settings but lacked repeating page content visibility.
- Include page-information answers in setup equality, consent, dry-run, and
  success and failure paths. When Codex runs, send the entered text as bounded
  structured input with placeholders unresolved. Consent shows the text being
  sent under the decided terminal display policy; local materialization
  preserves the exact collected values. Apply the metadata-only optional
  report projection above. Reports must accurately identify deterministic
  preparation versus model requests.
- Continue to use shared Profile normalization, patch validation, capability
  advisories, and diagnostics. Authoring does not probe the installed
  renderer. The existing Interactive one-render page-number choice remains a
  separate transient override.
- Render representative PDFs after final Profile materialization and again
  from saved recipes. Inspect extracted text and rasterized representative
  pages before closing those phase gates.

The implementation plan should verify fresh and revised Interactive Profile
and Project paths, explicit ON/OFF versus omission, page-info-only input,
base-Profile preservation, unselected-slot clearing, clear/retain conflict
choices, and OFF clearing even an occupied reserved slot while preserving
styles. Cover ON/OFF-to-unspecified revision, last-signal removal, and both
directions of model-introduced slot conflicts before Project Template work.
Also verify literal-text preservation, the decided report payload and privacy,
no model request for page-info-only input, final Profile round trips, and Project
Template compatibility. Verify that accepted or inherited
`fonts.pageChrome.default` survives explicit Profile and Project
page-information answers, including OFF, when a `Page headers and footers` font
hint is also present. Existing renderer evidence can be reused unless generated
HTML/CSS or effective render behavior changes. The focused visual checks after
materialization and saved-recipe handoff are required even when the renderer
contract itself does not change.

## Settled Decisions

1. **Selected positions define the final repeating content.** Preselect
   occupied eligible positions from the base Profile on first edit. Checked
   positions retain their content unless edited; unchecking clears them.
   Revisions start from the current answers and use the same rule. Selecting
   or replacing a base later does not add slots to an existing explicit ON
   selection: newly occupied eligible slots stay unselected and clear unless
   the user selects them during revision. Explicit OFF still clears all slots.
   Leaving the group unspecified imposes no clearing. Verify this later-base
   behavior independently from first-edit base preselection. A reserved slot is
   handled separately by decision 4. This follows Formal Guide's existing
   selection behavior.[^formal-guide]
2. **Send entered text as data; preserve it locally.** When Codex is needed,
   include exact entered text in bounded structured signals so it can account
   for language and length. Keep metadata placeholders unresolved. The model
   must not rewrite explicit content; final materialization applies the local
   values regardless of the model's response. Reuse the existing consent flow
   without adding a model-generated clarification round. The optional report
   follows the metadata-only projection above and is not derived automatically
   from the text sent to Codex.
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
   will render. A one-render number-OFF override releases the slot, allowing
   retained text to render without changing the saved Profile. Users can move
   the number through the existing revision flow.
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
6. **Resolve late conflicts locally before accepting a Profile.** When either
   group is explicit, check the normalized candidate for an enabled number
   sharing a nonempty content slot. A model-selected number must not silently
   hide explicitly selected text. Return unresolved conflicts to Interactive
   setup revision before acceptance, save, or Project Template preparation;
   helpers report the conflict without opening prompts themselves. The user
   can explicitly move/disable the number or revise the selected text. When
   the conflicting text is inherited or model-selected, use the existing
   clear-or-retain question. Clearing changes only that slot; it does not turn
   an unspecified repeating-content group ON or clear its other slots. Retain
   preserves the reviewed text with the existing warning. Bind each resolution
   to the number position and exact conflicting text; recheck it when either
   changes, including on regeneration. Explicit OFF clearing runs first and
   needs no resolution. Both groups unspecified retain existing behavior.
   Revision uses the normal preparation/consent flow with no automatic model
   retry or model-generated clarification round.

## Related Research

- [Markdown PDF Page Roles And Counter Semantics](research-2026-08-15-markdown-pdf-page-roles-and-counter-semantics.md)
- [Markdown PDF Interactive Page Numbers And Repeating Page Content UX](research-2026-08-14-markdown-pdf-interactive-page-number-and-page-chrome-ux.md)
- [Markdown PDF Codex Helper Roadmap](research-2026-06-10-markdown-pdf-codex-profile-and-interactive-flow.md)

## Related Plans

- [Markdown PDF Interactive Codex page information implementation](../plans/plan-2026-09-23-markdown-pdf-interactive-codex-page-information.md)
- [Markdown PDF page-number configuration implementation](../plans/plan-2026-08-12-markdown-pdf-page-number-configuration.md)

## Implementation Record

- [Interactive Codex page information implementation](../plans/jobs/2026-09-23-markdown-pdf-interactive-codex-page-information.md)

[^formal-guide]: [Interactive Markdown PDF Usage](../guides/markdown-pdf-interactive-usage.md) and [Formal Guide collection](../../src/cli/interactive/markdown/formal-guide/collection.ts).

[^profile-defaults]: [Profile defaults](../../src/cli/markdown-pdf/profile/defaults.ts) and [Profile initialization](../../src/cli/markdown-pdf/profile/init-service.ts).

[^profile-helper]: [Markdown PDF Codex Profile Helper guide](../guides/markdown-pdf-codex-profile-helper.md) and [Profile signal mode](../../src/cli/markdown-pdf/profile-codex/signal-mode.ts).

[^project-helper]: [Markdown PDF Codex Project Helper guide](../guides/markdown-pdf-codex-project-helper.md), [Project signal mode](../../src/cli/markdown-pdf/project-codex/signal-mode.ts), and [Template output plan](../../src/cli/markdown-pdf/template-codex/output-plan.ts).

[^usage]: [Markdown PDF Usage](../guides/markdown-pdf-usage.md).

[^page-roles]: [Completed page-role research](research-2026-08-15-markdown-pdf-page-roles-and-counter-semantics.md).

[^conflict-behavior]: [Formal Guide prompts](../../src/cli/interactive/markdown/formal-guide/prompts.ts), [Formal Guide collection](../../src/cli/interactive/markdown/formal-guide/collection.ts), and [Page chrome generation](../../src/cli/markdown-pdf/profile/page-chrome.ts).

[^off-behavior]: [Formal Guide collection](../../src/cli/interactive/markdown/formal-guide/collection.ts) and [Page chrome generation](../../src/cli/markdown-pdf/profile/page-chrome.ts).
