---
title: "Markdown PDF Interactive Page-Number And Page-Chrome UX"
created-date: 2026-08-14
status: draft
agent: codex
---

## Goal

Refine the Markdown PDF Interactive Profile `formal-guide` so common
page-number and repeating header/footer choices are clear without asking users
to reproduce the complete Profile schema through terminal prompts.

The full Profile contract remains available in YAML or JSON. Direct and
Interactive rendering retain the existing one-render enablement override, and
Codex-assisted page-number intent remains a separate future design problem.

## Why This Follow-Up Exists

The parent [Markdown PDF Page-Number Configuration][page-number-research]
research and implementation plan established the correct durable contract:
Profile owns reusable page-number and page-chrome policy, while `md to-pdf`
owns only a temporary enable/disable override.

The first Interactive implementation exposed that contract too literally.
After page numbers are enabled, Profile `formal-guide` currently asks for
visibility scope, count origin, first number, increment, position, and a raw
label template. It then asks for all three header slots, all three footer
slots, and optional styles even when the user wants only ordinary page numbers.
The resulting Profile is valid, but the authoring flow is longer and more
technical than the common task requires.[^formal-guide-prompts]

This follow-up changes presentation and guided defaults without adding a new
Profile schema or renderer behavior.

## Scope

This research covers:

- Profile `formal-guide` page-number collection and revision
- Profile `formal-guide` header/footer content collection
- the relationship between a selected page-number slot and page-chrome content
- wording for the existing Interactive one-render page-number choice
- direct CLI help and the boundary between flags and Profile YAML
- current Project and Codex Assistant limitations that must remain explicit
- focused validation for the simplified prompt-to-Profile mapping

This research does not:

- change the Profile schema, `schemaVersion`, normalization rules, or renderer
- add detailed page-number overrides to `md to-pdf`
- add a deterministic Project authoring mode
- add structured page-number signals to Profile or Project Codex Assistant
- add page-number policy to Template bundles
- redefine `{page}`, `{pages}`, renderer capabilities, or collision diagnostics

## Current Surface Review

| Surface                | Current behavior                                              | Direction                   |
| ---------------------- | ------------------------------------------------------------- | --------------------------- |
| Profile `starter`      | Writes the normal disabled page-number defaults               | Keep                        |
| Profile `formal-guide` | Collects the full page-number sequence and raw label fields   | Simplify                    |
| Profile page chrome    | Always asks header and footer slot questions                  | Gate behind explicit intent |
| Profile recipe review  | Offers independent page-number and page-chrome revision       | Keep                        |
| Interactive `to-pdf`   | Asks inherit, enable, or disable for one render               | Keep; clarify wording only  |
| Direct `md to-pdf`     | Exposes only `--page-numbers` and `--no-page-numbers`         | Keep; clarify help          |
| `md pdf-profile init`  | Writes an editable Profile with page numbers disabled         | Keep                        |
| Project authoring      | Codex Assistant-only; reusable settings live in `profile.yml` | Keep and document           |
| Codex Assistant        | Has no dedicated structured page-number signal                | Defer                       |

## Recommended Formal-Guide Flow

The common path should be:

```text
Enable reusable page numbers in this Profile? Yes

Number which pages?
  -> Body pages, starting at 1
  -> Entire document, starting at 1

Page-number position
  -> Bottom center
  -> Bottom right
  -> Bottom left
  -> Top center
  -> Top right
  -> Top left

Add repeating header or footer text? No
```

The two behavior choices compile to existing Profile values:

| Guided choice                  | `scope`    | `countFrom` | `start` | `increment` |
| ------------------------------ | ---------- | ----------- | ------: | ----------: |
| Body pages, starting at 1      | `body`     | `body`      |     `1` |         `1` |
| Entire document, starting at 1 | `document` | `document`  |     `1` |         `1` |

`Body pages, starting at 1` should be the fresh `formal-guide` default. This is
an opinionated Interactive authoring default, not a change to the normalized
Profile default or the meaning of an existing Profile.

The guided flow should use `format: "{page}"` without asking for a raw label
template. Position remains visible because it is a common, concrete visual
choice; its enum-backed choices should use human-readable labels.

If page numbers are disabled, dependent behavior and position questions should
be skipped while retained inert values remain valid for same-session revision.

## YAML Owns Advanced Page-Number Configuration

The generated Profile remains the complete and editable configuration surface:

| Advanced need                                           | Profile field or behavior                                                |
| ------------------------------------------------------- | ------------------------------------------------------------------------ |
| Hidden front matter that still contributes to numbering | `scope: body` with `countFrom: document`                                 |
| Custom first number                                     | `start`                                                                  |
| Non-unit sequence                                       | `increment`                                                              |
| Custom label text                                       | `format`                                                                 |
| Physical total-page text                                | `{pages}` in `format`                                                    |
| Page-chrome typography                                  | `header.style` or `footer.style`                                         |
| Separator line                                          | `header.style.separator` or `footer.style.separator`                     |
| Deliberate slot collision                               | Configure the slot and accept the existing warning/page-number-wins rule |

Keeping these values out of the common prompt flow does not remove support or
change round-trip behavior. It makes the Profile file the explicit advanced
editor rather than creating a second expert form in Interactive mode.

## Page-Chrome Collection

Header and footer content are independent of page numbers, but they should not
be mandatory questions. Profile `formal-guide` should first ask whether the
user wants repeating header or footer text. When accepted, it should ask for
`Header`, `Footer`, or `Both`, then collect only the selected areas.

During fresh authoring, the slot owned by the selected page-number position
should remain empty and should not be prompted. For example, a bottom-center
page number leaves `footer.center` page-number-owned while optional
`footer.left` and `footer.right` content remain available.[^page-chrome]
When page numbers are disabled, no slot is page-number-owned and each selected
header or footer area retains all three content slots.

Same-session revision must not silently discard existing content. If `Revise
page numbers` moves the number onto a populated slot, preserve the configured
content and show the existing collision diagnostic in review. The user can
then revise page chrome explicitly.

Style and separator prompts should leave the basic flow. Users who need those
bounded fields can edit the generated Profile. Existing Profiles and renderer
behavior remain unchanged.

## Interactive One-Render Choice

The existing render-time choice is already appropriately small:

```text
Page numbers for this PDF
  -> Use recipe setting
  -> Enable for this PDF
  -> Disable for this PDF
```

It should retain the same placement, navigation, state retention, reset rules,
and compilation to `undefined`, `true`, and `false` proven by the completed
selected-source and generated/saved lifecycle phases.[^render-choice]

Copy may emphasize its temporary nature:

```text
Keep recipe setting
Turn on for this PDF only
Turn off for this PDF only
```

No render-time choice must be interpreted as an implicit disable. Inheritance
means the resolved Profile value remains authoritative; without a Profile, the
normalized default remains disabled.

## Direct CLI Boundary

Direct `md to-pdf` should continue to expose only:

```text
--page-numbers
--no-page-numbers
```

The help text should make clear that these flags change only the current
render and reuse Profile or normalized-default details. Detailed flags for
scope, origin, start, increment, position, label, and styling would duplicate
the Profile schema and are outside this follow-up.[^command]

`md pdf-profile init` should not gain a parallel family of page-number flags.
Its generated Profile already exposes the disabled `pageNumbers` block for
deliberate editing. A serialized disabled block does not print page numbers;
only effective `enabled: true` does.

## Project And Codex Assistant Boundary

Interactive Project preparation remains Codex Assistant-only. Its durable
page-number settings belong to the generated bundle's contained `profile.yml`,
and the existing one-render choice may temporarily enable or disable them.

This phase must not pass a free-form prompt answer as if it were structured
page-number authority. A future canary can research dedicated Codex signals,
provenance, revision, and sparse output behavior across Profile and Project
generation. Until then, exact Project page-number configuration is performed by
editing `profile.yml` and rendering the bundle normally.

## Implementation And Validation Direction

Phase 14 should prove:

1. disabling page numbers skips all dependent page-number questions
2. the two guided behavior choices compile to the exact existing Profile values
3. fresh authoring fixes `start: 1`, `increment: 1`, and `format: "{page}"`
4. all six positions remain available with human-readable labels
5. declining page chrome skips header/footer slot and style questions
6. selected header/footer areas collect only relevant content and avoid the
   fresh page-number-owned slot, while disabled page numbers leave all three
   slots available in each selected area
7. revision preserves inert page-number values and does not silently delete an
   occupied page-chrome slot
8. the one-render tri-state, lifecycle state, diagnostics, and Profile
   serialization remain compatible
9. direct help contains only the enable/disable override and explains its
   temporary scope
10. Profile, Project, and Template ownership remains unchanged

Focused Interactive, Profile authoring, command help, and lifecycle tests are
sufficient when the compiled Profile and renderer inputs remain unchanged. The
live renderer matrix does not need to repeat unless implementation changes
normalized behavior, renderer CSS, scenario inputs, or evidence acceptance.

## Settled Direction

- Keep common Interactive authoring short and outcome-oriented.
- Keep the complete advanced contract in Profile YAML or JSON.
- Preserve the simple one-render override instead of adding detailed transient
  settings.
- Keep Project reusable policy in its contained Profile.
- Defer structured Codex Assistant page-number authority to a future canary.
- Complete this UX implementation before the parent plan's final guidance and
  lifecycle closeout.

## Related Research

- [Markdown PDF Page-Number Configuration][page-number-research]
- [Markdown PDF Profile Revision And Feature Compatibility][profile-revision-research]
- [Markdown PDF Interactive Code Highlighting][interactive-code-research]

## Related Plans

- [Markdown PDF Page-Number Configuration Implementation][page-number-plan]

## References

[^formal-guide-prompts]: [Current formal-guide page-number and page-chrome prompts](../../src/cli/interactive/markdown/formal-guide/prompts.ts) and [collection](../../src/cli/interactive/markdown/formal-guide/collection.ts)

[^page-chrome]: [Page-number slot ownership and page-chrome CSS generation](../../src/cli/markdown-pdf/profile/page-chrome.ts) and [shared diagnostics](../../src/cli/markdown-pdf/diagnostics.ts)

[^render-choice]: [Interactive one-render page-number choice](../../src/cli/interactive/markdown/render-page-numbers.ts) and [effective review](../../src/cli/interactive/markdown/page-number-review.ts)

[^command]: [Markdown command registration](../../src/cli/commands/markdown.ts) and [Profile initializer](../../src/cli/actions/markdown/pdf-profile-init.ts)

[interactive-code-research]: research-2026-07-23-markdown-pdf-interactive-code-highlighting.md
[page-number-plan]: ../plans/plan-2026-08-12-markdown-pdf-page-number-configuration.md
[page-number-research]: research-2026-08-11-markdown-pdf-page-number-configuration.md
[profile-revision-research]: research-2026-08-14-markdown-pdf-profile-revision-and-feature-compatibility.md
