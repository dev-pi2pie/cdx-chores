---
title: "Markdown PDF page-number configuration implementation"
created-date: 2026-08-12
status: draft
agent: codex
---

## Goal

Implement the page-number contract defined by
[Markdown PDF Page-Number Configuration][page-number-research] across Profile
configuration, generated HTML and CSS, direct `md to-pdf` overrides,
Interactive authoring and rendering, renderer capability checks, diagnostics,
and current guidance.

The implementation should preserve the current output when new controls are
omitted, while adding explicit control over:

```text
logical sequence -> countFrom + start + increment
visibility       -> scope + protected cover exception
label placement  -> format + position
appearance       -> selected header/footer style + fonts.pageChrome
```

Renderer-sensitive behavior must be implemented only after the temporary
compatibility smoke establishes a capability-specific WeasyPrint baseline.

## Why This Plan

The research settles the intended user-facing contract and compatibility
posture, but the implementation crosses several existing ownership boundaries:

- Profile owns reusable page-number and page-chrome policy.
- generated HTML owns stable page-kind and body-boundary hooks.
- generated CSS maps the Profile contract to WeasyPrint behavior.
- direct and Interactive `md to-pdf` own only a render-time enable/disable
  override.
- Interactive authoring edits durable Profile values without creating a second
  schema.
- Project authoring coordinates a final Profile with a compatible generated
  Template and exposes the complete result through bundle rendering.
- renderer validation and `doctor` must agree on capability availability.

The work therefore begins with renderer evidence, proceeds through shared
Profile and renderer layers, and ends with integrated real-PDF validation and
public guidance.

## Starting State

Current implementation seams:

- `src/cli/markdown-pdf/profile/types.ts`, `schema.ts`, `normalize.ts`, and
  `defaults.ts` define `enabled`, `position`, `format`, and body-only `scope`.
- `src/cli/markdown-pdf/profile/page-chrome.ts` writes header, footer, and page
  numbers into the six CSS page-margin boxes.
- an enabled page number currently replaces content in its selected slot
  without a diagnostic.
- generated cover and ToC page rules clear all page-margin boxes while physical
  page counting continues.
- generated Template-Codex HTML already emits `.document-body`, but required
  hook validation does not yet adopt it.
- the built-in recipe has a body `<main>` but does not expose the proposed
  stable body-boundary contract.
- direct `md to-pdf` has no page-number-specific option.
- `--no-default-css` disables generated page-chrome CSS, but its interaction
  with an effectively enabled page-number contract is not yet defined.
- direct `md pdf-template codex` supports `--base-profile` and partial bundle
  inputs, but its page-number/body-hook compatibility has not been reviewed.
- Interactive Profile authoring does not expose the proposed fields or
  page-chrome style.
- Interactive `md to-pdf` has no page-number-specific one-render choice or
  effective-state review.
- `md pdf-project codex` already runs its Profile phase before its Template
  phase, writes a complete bundle, validates selected cross-artifact ownership,
  and prints a follow-up `md to-pdf --bundle` command.
- Project compatibility validation does not yet cover page-number ownership,
  body-origin hook requirements, or page-chrome conflicts.
- renderer compatibility is currently expressed as general WeasyPrint
  availability, not capability-specific page-number baselines.

Missing evidence and implementation:

- verified counter reset, increment, visibility, and page-margin layout
  behavior across the candidate WeasyPrint versions
- normalized `countFrom`, `start`, `increment`, document visibility, and typed
  header/footer style
- stable body-boundary validation for body-relative numbering
- selective cover, ToC, front-matter, and body CSS branches
- warning and hard-error diagnostics for incompatible combinations
- capability-aware pre-render validation and `doctor` reporting
- direct enable/disable precedence, Interactive durable authoring, and the
  Interactive one-render lifecycle
- Project Profile/Template compatibility, bundle review, and follow-up render
  behavior
- integrated page-by-page PDF extraction and visual evidence

## Product Contract

### Profile configuration

The normalized contract adds the following fields. This is an illustrative
opt-in configuration, not the default Profile:

```yaml
header:
  left: "{company}"
  center: ""
  right: "{title}"
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
  countFrom: document
  start: 1
  increment: 1
  position: bottom-center
  format: "{page}"
```

The same typed `style` shape is available under `footer`. Page-number
appearance inherits from the selected header or footer area, then
`fonts.pageChrome`, then renderer defaults. No `pageNumbers.style` field is
added.

Defaults preserve the current behavior:

| Field       | Default    |
| ----------- | ---------- |
| `enabled`   | `false`    |
| `scope`     | `body`     |
| `countFrom` | `document` |
| `start`     | `1`        |
| `increment` | `1`        |
| `position`  | existing default |
| `format`    | existing default |

`scope: document` with `countFrom: body` is invalid. `start` accepts integers
greater than or equal to zero, and `increment` accepts integers greater than or
equal to one.

### Visibility and sequence

- `scope` controls where a logical value may be shown.
- `countFrom` controls where the logical sequence begins.
- cover pages remain hidden under both scopes.
- document origin preserves hidden-but-counted cover and pre-body pages.
- body origin begins at the first provable `.document-body` page.
- body origin fails before rendering when the body boundary cannot be proven.
- document origin may use the defined warning fallback for a legacy custom
  Template whose body boundary cannot be proven.

### Labels, slots, and diagnostics

- `format` remains the canonical page-number label-template key.
- `{page}` is the logical page value.
- `{pages}` remains the physical PDF page count.
- short metadata placeholders retain their shipped meaning.
- missing metadata still resolves to an empty string.
- an occupied selected slot keeps page-number-wins behavior and emits one
  warning per document.
- `{pages}` with body-origin or non-default arithmetic remains accepted and
  emits one warning per document.
- warnings preserve successful exit status and use structured diagnostics when
  output is machine-readable.
- direct `md to-pdf` does not gain a new JSON mode in this feature; structured
  diagnostics are exposed only through surfaces that already own
  machine-readable output, including `doctor --json` and Project reports.

### Direct and Interactive surfaces

The first direct CLI slice adds only:

```text
--page-numbers / --no-page-numbers
```

Precedence is:

```text
direct render override
  -> loaded Profile pageNumbers.enabled
  -> normalized default false
```

Omission remains distinct from explicit enable and disable. Detailed sequence,
visibility, format, position, and style controls remain durable Profile values.
Interactive Profile authoring may edit those values.

`--no-default-css` continues to disable all generated page-chrome CSS. An
effectively enabled Profile or direct page-number request is therefore
incompatible with `--no-default-css` and fails before rendering; deliberate
user-authored page counters remain available through custom CSS with Profile
page numbers disabled.

Interactive `md to-pdf` exposes the same enablement tri-state as a one-render
choice:

```text
Page numbers for this PDF
  -> Use recipe setting
  -> Enable for this PDF
  -> Disable for this PDF
```

The choices compile to `undefined`, `true`, and `false`. `Use recipe setting`
uses the resolved Profile value or the normalized default when no Profile is
present. The choice is transient render-session state: it must not be persisted
to a Profile, Template, Project, report, or preference. Interactive rendering
must not introduce detailed sequence, visibility, format, position, or style
overrides alongside this toggle.

### Renderer capability posture

- existing page-number behavior remains available on the existing supported
  render path.
- each advanced control is gated by its proven capability baseline.
- unsupported effectively requested behavior fails before renderer output is
  written.
- default-valued or ineffective new fields do not trigger an advanced gate.
- `doctor` reports the installed version and capability availability without
  declaring all of `md to-pdf` unavailable when only an advanced capability is
  unsupported.

## Scope

### In scope

- temporary compatibility smoke for WeasyPrint `65.1`, `68.0`, and `69.0`
- Profile types, defaults, schema, normalization, serialization, and Codex patch
  paths
- header/footer style and separator validation
- generated and built-in body hooks
- direct Template-helper body-hook compatibility with base Profiles and partial
  bundles
- page-number CSS sequence, visibility, placement, and inherited styling
- legacy Template fallback and stable body-boundary enforcement
- warnings, hard errors, structured diagnostics, and capability gates
- direct enable/disable override
- Interactive Profile authoring and review
- direct Project-helper Profile/Template coordination and complete-bundle
  compatibility
- Interactive `md to-pdf` one-render enablement, review, and lifecycle behavior
- generated Profile, Template, and Project compatibility
- real-render extraction, image inspection, and guide updates

### Out of scope

- PDF viewer page-label metadata
- changing physical PDF page indices or `{pages}` semantics
- a logical final-page-number placeholder
- arbitrary Profile-authored CSS
- `pageNumbers.style`
- detailed direct flags for sequence, visibility, label, position, or style
- moving page-number policy into Template-Codex
- unifying the cover and page-chrome placeholder resolvers
- introducing namespaced placeholders or literal-brace escaping
- owning the repository-wide pattern and template language guide
- recording local activation commands, environment names, resolved temporary
  paths, or other machine-specific setup in public records

## Implementation Approach

Keep the implementation layered around one normalized Profile contract:

```text
Profile schema and direct/Interactive enablement override
  -> effective page-number configuration
  -> body-hook and no-default-CSS validation
  -> renderer-capability validation
  -> generated page-kind and body-boundary hooks
  -> deterministic page-chrome CSS
  -> Project Profile/Template compatibility and bundle resolution
  -> Pandoc and WeasyPrint render
  -> structured diagnostics and PDF evidence
```

Use capability-specific baselines instead of one blanket minimum version. Keep
the committed renderer-contract source corpus compact and explicit under
`test/fixtures/markdown-pdf/`: prefer one typed catalog that materializes the
scenario HTML/CSS and one shared Markdown/Profile pair for the actual-launch
lane. Any expansion requires review in the Phase 1 job. Do not force-add
artifacts ignored by `examples/playground/.gitignore`.

Candidate copies, environments, generated inputs, PDFs, PNGs, and raw reports
belong in one uniquely named, ownership-marked OS temporary laboratory. Retain
the laboratory through extraction and visual review, then remove it after the
public-safe evidence record is complete. Retain it only for a failed or
inconclusive run, or when an explicit local keep option is used. Public records
describe tested versions, fixture outcomes, and conclusions without copying
local setup, retention choices, or resolved filesystem details.

## Implementation Phases

### Phase 1: Renderer Compatibility Evidence

Tasks:

- [ ] Record the exact proposed permanent fixture file list in the Phase 1 job
      before adding it, and review additions that expand that boundary.
- [ ] Add a typed fixture catalog under `test/fixtures/markdown-pdf/` that
      materializes the renderer-contract HTML/CSS scenarios into the temporary
      laboratory, plus one shared Markdown/Profile actual-launch pair.
- [ ] Keep copied inputs, generated HTML/CSS, PDFs, PNGs, reports, and candidate
      environments in the ownership-marked temporary laboratory; do not
      force-add ignored playground artifacts.
- [ ] Guard cleanup with the exact resolved laboratory path and an ownership
      marker, and refuse unmarked, missing-marker, or broader parent paths.
- [ ] After extraction, visual inspection, and public-safe evidence recording,
      remove a successful laboratory automatically unless an explicit local
      keep option was selected; retain failed and inconclusive laboratories for
      diagnosis, then remove them after the issue is resolved or the run is
      formally abandoned.
- [ ] Add deterministic tests for successful cleanup, failure retention,
      retained-laboratory closeout, explicit retention, and refusal to clean an
      unsafe path.
- [ ] Materialize isolated WeasyPrint `65.1`, `68.0`, and `69.0` candidate
      projects under one uniquely named OS temporary laboratory.
- [ ] Use the same Python minor version and fixture inputs for every candidate.
- [ ] Record effective WeasyPrint, Pydyf, FontTools, Python, and shared native
      Pango versions without recording local environment names or paths.
- [ ] Cover default arithmetic, `start: 0`, `increment: 2`, document origin,
      body origin, and the first-body reset boundary.
- [ ] Cover single-page and multi-page covers, title/front-matter output,
      single-page and multi-page ToCs, blank pages, and long-content
      repagination.
- [ ] Cover both visibility scopes, all six positions, portrait, landscape,
      narrow margins, typography, and separators.
- [ ] Keep the upstream page-group repagination case as a separate sentinel and
      promote it to a required fixture only if the selected generator strategy
      depends on equivalent page-group state.
- [ ] Extract page-number text by physical page and render representative PNGs
      for visual inspection.
- [ ] Add an actual-launch control lane that selects each candidate renderer,
      runs `doctor --json`, and renders a shared input through the currently
      shipped `md to-pdf` path.
- [ ] Treat the actual-launch control as proof of candidate selection and
      existing launch compatibility, not as proof of advanced controls that do
      not exist until later phases.
- [ ] Classify contract mismatches separately from setup, dependency, native
      library, font-discovery, or executable-launch failures.
- [ ] Establish the lowest passing version separately for reset, increment,
      document visibility, body origin, and each proposed style capability.
- [ ] Constrain or stop any capability that does not pass on `69.0` before
      implementing its public contract.
- [ ] Create or update
      `docs/plans/jobs/YYYY-MM-DD-markdown-pdf-page-number-phase-1-renderer-evidence.md`
      during execution with the public-safe version matrix, fixture outcomes,
      baseline decisions, limitations, and retained or constrained capability
      set.
- [ ] Update the research conclusions and lifecycle status only as supported by
      the recorded renderer evidence.

Phase checkpoint:

- **Continue** — every advanced control retained after the smoke has a
  reproducible renderer-contract baseline, and the actual-launch control proves
  each applicable candidate can be selected by the current CLI path.
- **Constrain** — some proposed controls are unsupported or unstable; revise
  the research and later phases to the passing subset.
- **Stop** — the core sequence or visibility model cannot be implemented
  reliably on the newest candidate; return to research before schema changes.
- An environment/setup failure is inconclusive and must be corrected and rerun
  for the same candidate; it cannot select a higher baseline.
- A successful laboratory is cleaned only after its evidence is reviewed and
  recorded; retained diagnostic laboratories remain local and are never named
  in public records. No unneeded laboratory remains after Phase 1 closes; an
  explicit local keep option is the only exception.

### Phase 2: Contract Value Domains And Profile Schema

Tasks:

- [ ] Convert every renderer-retained style capability from Phase 1 into an
      exact public value domain before changing the schema.
- [ ] Define accepted CSS units and numeric ranges for font size, line height,
      separator width, and separator gap, including whether unitless zero is
      valid for each field.
- [ ] Define the accepted font-weight domain, color grammar, and separator-style
      enum; reject arbitrary CSS tokens and values outside the documented
      subset.
- [ ] Record the finalized domains, defaults, normalization rules, and examples
      in the Phase 1 evidence job and related research so schema and guidance
      consume one decision source.
- [ ] Extend normalized types with `scope: document | body`,
      `countFrom: document | body`, `start`, and `increment`.
- [ ] Add the shared typed `style` shape to `header` and `footer` without adding
      `pageNumbers.style`.
- [ ] Preserve the existing `enabled`, `position`, and `format` defaults.
- [ ] Default `scope` to `body`, `countFrom` to `document`, `start` to `1`, and
      `increment` to `1`.
- [ ] Preserve literal `start: 0` through parsing, normalization, merging, and
      serialization.
- [ ] Reject negative or fractional `start` and non-positive or fractional
      `increment`.
- [ ] Reject `scope: document` with `countFrom: body` during configuration
      validation.
- [ ] Validate bounded font-size, font-weight, line-height, color, separator
      width, separator style, separator color, and separator gap values.
- [ ] Update schema allowlists, defaults, normalization, YAML/JSON
      serialization, deterministic initialization, and Codex Profile adapter
      paths.
- [ ] Preserve Project/Profile artifact loading and writing through the same
      normalized schema.
- [ ] Add old-Profile fixtures proving omitted new fields retain the shipped
      behavior.
- [ ] Add round-trip fixtures for every new field and validation boundary.

Phase checkpoint:

- Every exposed style value has an exact, renderer-proven grammar and boundary;
  no task relies on an undefined meaning of "bounded."
- Existing Profiles normalize without migration and retain current behavior.
- New values round-trip through YAML and JSON without loss or coercion.
- Invalid arithmetic, invalid scope/origin combinations, and invalid style
  values fail before rendering.
- The capability set retained after Phase 1 and the exposed schema still agree.

### Phase 3: HTML Body Hooks And Template Compatibility

Tasks:

- [ ] Add the stable `.document-body` hook to the built-in body `<main>`.
- [ ] Adopt `.document-body` in generated Template-Codex required-hook
      validation while preserving existing Pandoc, title, and ToC hooks.
- [ ] Define a provable boundary as exactly one usable `.document-body` element
      that owns the Pandoc `$body$` insertion point; reject missing, duplicate,
      or structurally unrelated matches for body-origin numbering.
- [ ] Inspect actual selected or generated HTML rather than synthesis metadata
      when proving the boundary.
- [ ] Preserve the warning-based legacy inference only for document-origin body
      visibility; never use it to satisfy a body-origin request.
- [ ] Review direct `md pdf-template codex --base-profile` behavior when the
      Profile requests document-origin or body-origin numbering.
- [ ] Preserve Profile-only and Template/CSS partial bundle inputs in the direct
      Template helper while requiring generated HTML to be compatible with the
      externally owned Profile contract.
- [ ] Keep Template signals and generated Template CSS free of duplicated
      Profile-owned page-number values.
- [ ] Add built-in, generated, legacy custom, missing-hook, duplicate-hook,
      direct Template-helper, base-Profile, and partial-bundle tests.

Phase checkpoint:

- Built-in and generated Templates expose exactly one usable body boundary.
- Body-origin compatibility is proven from actual HTML and fails before a
  usable artifact or render is reported when the proof is absent.
- Direct Template-helper output remains compatible with its base Profile
  without changing generic partial-bundle behavior or copying Profile policy.

### Phase 4: Page-Number And Page-Chrome CSS

Tasks:

- [ ] Generate document-origin reset and increment rules from normalized
      `start` and `increment`.
- [ ] Generate first-body reset and increment rules only through the
      Phase 1-proven selector strategy.
- [ ] Keep cover page numbers hidden while allowing sequence participation to
      follow `countFrom`.
- [ ] Implement selective `scope: body` and `scope: document` visibility.
- [ ] Restore only page-number content on eligible ToC pages without restoring
      unrelated headers or footers.
- [ ] Preserve all six existing positions and page-number-wins slot output.
- [ ] Emit header/footer typography and separator CSS only for Phase 1-proven,
      renderer-proven style fields.
- [ ] Preserve `fonts.pageChrome` ownership of font family.
- [ ] Preserve Template and user stylesheet precedence without adding
      `!important` or a parallel stylesheet order.
- [ ] Add deterministic CSS tests for all sequence, visibility, position,
      style, cover, title, ToC, body, and legacy Template branches.

Phase checkpoint:

- Generated CSS matches every retained Phase 1 fixture strategy.
- Cover, ToC, header, footer, and page-number rules do not restore or suppress
  unrelated page chrome.
- Existing default CSS output remains compatible when new controls are omitted.

### Phase 5: Direct `md to-pdf` Effective Render Configuration

Tasks:

- [ ] Register `--page-numbers` and `--no-page-numbers` on direct
      `md to-pdf` using the existing optional-boolean convention.
- [ ] Preserve the omitted/inherit, explicit-enable, and explicit-disable
      tri-state through command, action, preparation, and render layers.
- [ ] Resolve the direct override only into effective
      `pageNumbers.enabled`; never mutate or serialize the loaded Profile.
- [ ] Make the resolved Profile setting, direct override, and effective setting
      separately available to review and diagnostic logic.
- [ ] Keep `--no-default-css` authoritative: when page numbers are effectively
      enabled, reject the combination before intermediate or PDF output because
      the generated page-chrome contract is disabled.
- [ ] Keep deliberate custom-CSS page counters available when Profile page
      numbers are disabled; do not inspect or claim ownership of arbitrary user
      counter CSS.
- [ ] Add command help, forwarding, precedence, no-default-CSS, loaded-Profile,
      bundle, and no-Profile compatibility tests.

Phase checkpoint:

- Direct omission is behaviorally identical to the shipped path.
- Explicit enable and disable affect only the current render's effective
  toggle.
- The no-default-CSS boundary is deterministic and never claims to apply
  generated Profile page numbers after their owning stylesheet is disabled.
- No new direct `md to-pdf --json` surface is introduced.

### Phase 6: Diagnostics, Capability Gates, And Doctor

Tasks:

- [ ] Detect an occupied selected header/footer slot before page-number
      replacement and emit one successful warning per document.
- [ ] Warn once when `{pages}` is combined with non-default arithmetic or body
      origin while preserving its physical-page-count meaning.
- [ ] Warn once when document-origin body visibility uses the proposed legacy
      custom-Template inference.
- [ ] Fail before rendering when body origin has no provable body-start hook.
- [ ] Represent effective advanced controls as explicit renderer capabilities
      rather than one blanket advanced-version boolean.
- [ ] Gate only controls that are effective after Profile and direct-override
      precedence.
- [ ] Fail before output writes when an effectively requested capability is
      unsupported by the installed renderer.
- [ ] Keep existing behavior available when no advanced control is effectively
      requested.
- [ ] Route plain warnings to `stderr` without changing a successful exit code.
- [ ] Define one structured diagnostic payload reusable by `doctor --json`,
      Project reports, and later Interactive review; do not add a direct
      `md to-pdf` JSON mode or mix prose into JSON `stdout`.
- [ ] Extend `doctor` to report installed renderer version and page-number
      capability availability using the same baseline data as pre-render
      validation.
- [ ] Add no-output-on-error, warning-frequency, structured-output, and
      `doctor` agreement tests.

Phase checkpoint:

- Every fallback and hard failure matches the research diagnostic matrix.
- Plain rendering and `doctor --json` use the same condition identifiers and
  capability data; later Project and Interactive phases consume that shared
  diagnostic payload.
- Renderer gating and `doctor` cannot disagree about an installed version.
- Unsupported advanced behavior fails before PDF or intermediate HTML writes.

### Phase 7: Profile Helper And Interactive Durable Authoring

Tasks:

- [ ] Preserve and generate the new page-number fields through direct
      `md pdf-profile codex` candidates, `--base-profile` input, bounded patch
      application, serialization, review, and optional report output.
- [ ] Add Profile-only page-number and page-chrome groups to Interactive
      formal-guide authoring.
- [ ] Collect durable sequence, visibility, format, position, and retained
      style values through the normalized Profile contract.
- [ ] Enforce the invalid scope/origin combination during Interactive
      collection and revision.
- [ ] Show reusable Profile values and effective renderer capability posture in
      candidate review.
- [ ] Carry the same durable Profile behavior through existing Profile, bundle,
      and Codex Profile authoring paths.
- [ ] Keep Template-only authoring free of Profile-owned page-number policy.
- [ ] Preserve accepted Profile candidates during authoring revision without
      repeating unrelated Codex requests.
- [ ] Add Interactive Profile collection, revision, review, persistence, and
      generated-artifact tests.

Phase checkpoint:

- Direct Profile-helper output contains one normalized, reviewable, and
  round-trippable page-number contract.
- Interactive writes one normalized durable Profile contract and introduces no
  second render schema.
- Template ownership remains consistent with existing Markdown PDF artifact
  boundaries.

### Phase 8: Project Profile/Template Coordination And Validation

Tasks:

- [ ] Audit the current direct `md pdf-project codex` pipeline from shared
      signals through Profile phase, normalized final Profile, Template phase,
      Project validation, bundle writes, report/summary output, and follow-up
      render command.
- [ ] Preserve or generate all retained page-number fields through the Project
      Profile phase and serialize them into the final `profile.yml`.
- [ ] Keep `--base-profile` authoritative as the Project Profile phase starting
      input while allowing the normal bounded Profile decision to preserve or
      revise supported page-number values.
- [ ] Load, shape-validate, and normalize `--base-profile` before either Project
      Codex phase; malformed files, unknown Profile keys, invalid arithmetic,
      and invalid scope/origin combinations must fail rather than being silently
      repaired by Codex.
- [ ] Add base-Profile fixtures for omitted new fields, explicit
      `enabled: false`, literal `start: 0`, non-default `increment`, both valid
      origins, and every invalid validation boundary.
- [ ] Preserve explicit valid base values unless the reviewed bounded Profile
      decision deliberately changes them; serialization must not lose false,
      zero, or other valid non-default values.
- [ ] Keep page-number sequence, visibility, label, position, page-chrome style,
      and enablement Profile-owned; do not add a Project-specific page-number
      schema.
- [ ] Pass the normalized final Profile into Template coordination without
      copying page-number policy into Template signals or generated Template
      CSS.
- [ ] Require generated Project Templates to preserve the stable
      `.document-body` hook and the existing Pandoc, title, ToC, code, and cover
      hooks.
- [ ] Add focused Project compatibility validation proving that body-origin
      numbering inspects the actual generated `template.html` for one usable
      `.document-body` boundary plus the required `$body$`, title, ToC, code,
      and cover hooks rather than trusting synthesis metadata alone.
- [ ] Prevent a usable Project bundle and follow-up render command when the
      final Profile requests body origin but the generated HTML cannot prove the
      boundary; an explicitly requested diagnostic report may record the
      public-safe failure but must not claim replayable render inputs.
- [ ] Validate freshly generated Project `style.css` against competing ordinary
      page-number content, counter-sequence rules, and Profile-owned page-chrome
      styling.
- [ ] Permit Template-owned layout and cover presentation, required named cover
      and ToC page clearing/presentation, and the renderer-proven ToC behavior;
      do not mistake those rules for competing ordinary body page-number policy.
- [ ] Keep deliberate user stylesheet edits as the lower-level override path;
      generated-Project validation governs helper output and does not
      retroactively reject later user-authored CSS.

Phase checkpoint:

- Final `profile.yml` remains the authoritative reusable page-number contract.
- Generated `template.html` provides the required structural hooks, and
  generated `style.css` does not become a competing ordinary page-number owner
  or forbid valid Template/user presentation boundaries.
- Project compatibility validation covers base-Profile validity, final-Profile
  preservation, body-hook coherence, and CSS ownership before bundle handoff.

### Phase 9: Project Bundle, Report, And Render Handoff

Tasks:

- [ ] Show the final contained Profile page-number settings separately from
      Template presentation and Project orchestration in direct and Interactive
      Project candidate review.
- [ ] Keep Project summaries and optional reports bounded to phase decisions,
      validation results, and artifact references without persisting a second
      detailed page-number object.
- [ ] Show a compact effective page-number summary in human review while keeping
      the optional report authoritative by reference to the final Profile
      identity and `profile.yml`; include structured page-number diagnostics and
      capability results, not a duplicated mutable configuration object.
- [ ] Keep dry-run, validation-failure, successful-write, and optional-report
      output consistent about Profile identity, artifact availability,
      diagnostics, and whether a follow-up render is usable.
- [ ] Apply existing public-safe path and error redaction to every new Project
      summary, validation result, and report field.
- [ ] Preserve the public-safe follow-up `md to-pdf --bundle <project>` command
      without embedding a transient Interactive enablement override.
- [ ] Verify Project reports remain excluded from bundle Profile discovery and
      the complete bundle resolves exactly one Profile, Template, and
      Stylesheet role.
- [ ] Define Project-helper output completeness as exactly one valid
      `profile.yml`, one `template.html`, and one `style.css`, with optional
      managed assets and recognized report artifacts; keep ordinary
      profile-only and Template/CSS partial bundles valid in the generic bundle
      resolver.
- [ ] Add Project acceptance tests for missing and duplicate Profile, Template,
      or Stylesheet roles, stable ambiguity diagnostics, recognized report
      exclusion, invalid profile-shaped content, and unrelated top-level files.
- [ ] Prove `--bundle <project>` and explicit `--profile --template --css`
      selection of the same canonical three Project files produce the same
      effective page-number configuration and diagnostics; do not claim
      equivalence for a deliberately ambiguous or invalid directory.
- [ ] Add direct Project tests for dry-run, generated and explicit output,
      base-Profile preservation/revision, validation failure, optional report,
      bundle resolution, and render-command output.

Phase checkpoint:

- A Project-helper artifact is complete and unambiguous without changing the
  generic resolver's support for partial bundles.
- Bundle and explicit-role rendering resolve equivalent effective behavior.
- `md pdf-project codex` remains an artifact coordinator; `md to-pdf` remains
  the renderer.

### Phase 10: Interactive Selected-Source Render Workflow

Tasks:

- [ ] Audit the current Interactive `md to-pdf` working process for built-in,
      existing, bundle, Custom, generated, and saved-recipe handoff sources
      before changing prompt placement or lifecycle state.
- [ ] Record where source selection, Markdown input selection, authoritative
      renderer preparation, recipe review, output selection, final review, and
      recovery occur for each source family.
- [ ] Add `Use recipe setting`, `Enable for this PDF`, and `Disable for this
      PDF` as the one-render page-number choices.
- [ ] Compile the choices to the shared optional enablement override
      `undefined`, `true`, and `false` without adding a second detailed
      page-number object.
- [ ] Default to `Use recipe setting`, using the resolved Profile value or the
      normalized default when the source has no Profile.
- [ ] Place the choice after the source and Markdown input are known and before
      authoritative renderer preparation for existing, built-in, and Custom
      paths.
- [ ] Show recipe setting, one-render override, and effective page-number result
      as distinct values in review output.
- [ ] Show effective renderer capability posture and any page-number diagnostic
      once in the Interactive review or result surface.
- [ ] Define Back and Cancel destinations for built-in, existing Profile,
      existing Template/CSS, ordinary selected bundle, and Custom paths.
- [ ] Preserve the one-render choice while revisiting output selection, final
      review, or recovery within the same selected-source context.
- [ ] Reset the choice to `Use recipe setting` when the Markdown input, recipe
      source, selected artifact, or preparation mode changes.
- [ ] Add selected-source tests for collection, effective-state review,
      no-Profile defaulting, backtracking, cancellation, retention, reset,
      recovery, warnings, and no-default-CSS failure.

Phase checkpoint:

- Built-in, existing Profile/Template/CSS, ordinary bundle, and Custom sources
  use one prompt placement and one effective-configuration path.
- Temporary enablement state is neither persisted nor confused with durable
  Profile configuration.
- Review output makes recipe, override, and effective state independently
  understandable.
- Backtracking within the same selected-source context preserves the transient
  choice; a changed source or input resets it.

### Phase 11: Interactive Generated And Saved-Recipe Lifecycle

Tasks:

- [ ] Place the one-render choice after candidate acceptance and lifecycle
      selection but before materialization and authoritative renderer
      preparation for generated paths.
- [ ] Place the choice after Markdown input selection in saved-recipe
      `to-pdf` handoff paths.
- [ ] Resolve accepted generated Profile candidates from their normalized
      Profile, and generated Template-only candidates from the normalized
      default or separately selected Profile, after materialization.
- [ ] Resolve a generated Project recipe setting from the final contained
      Profile only after both Project phases complete and the candidate is
      accepted.
- [ ] Cover temporary Project materialization, saved Project handoff, an
      existing complete Project bundle, and a user-edited saved Project through
      the same bundle-resolution path.
- [ ] Re-resolve and normalize the final contained Profile after temporary
      materialization or durable save instead of relying only on pre-write
      candidate state.
- [ ] Treat a saved or existing Project whose contained Profile identity or
      content changed as a new render context: resolve it once, show the current
      setting, and reset the transient override to `Use recipe setting`.
- [ ] Fail closed on stale, missing, ambiguous, or invalid contained Profile
      state without mutating the saved Project bundle.
- [ ] Define Back and Cancel destinations for generated candidates, temporary
      materialization, save-and-render handoff, and saved-recipe rendering
      without discarding an applicable accepted candidate.
- [ ] Preserve the one-render choice while revisiting outputs, final review,
      recovery, or the same accepted generated candidate.
- [ ] Reset the choice when the Markdown input, recipe source, artifact,
      preparation mode, generated candidate identity, or contained Profile
      identity changes.
- [ ] Ensure changing only the one-render choice may repeat deterministic
      renderer preparation but does not regenerate artifacts, repeat a Codex
      request, or rewrite a successfully saved recipe.
- [ ] Ensure a Project override-only change repeats neither the Project Profile
      Codex phase nor the Project Template Codex phase.
- [ ] Add generated/saved lifecycle tests for generated Profile, generated
      Template, generated Project, temporary render, save-and-render, existing
      complete Project, user-edited saved Project, backtracking, cancellation,
      retention, reset, recovery, and stale-state failure.

Phase checkpoint:

- Generated, saved, and existing Project bundles use their currently contained
  Profile as the durable recipe setting without mutating `profile.yml`.
- Materialized and user-edited saved Projects are reviewed from their current
  contained Profile, not stale candidate memory.
- Override-only changes preserve accepted work and never repeat unrelated
  Profile or Template Codex phases.

### Phase 12: Integrated Renderer And Compatibility Validation

Tasks:

- [ ] Reuse the Phase 1 fixtures to exercise the implemented `md to-pdf` path
      against every applicable candidate version.
- [ ] Run `doctor --json` and actual launches with the same effective renderer
      selected for each candidate.
- [ ] Cover old Profiles, new Profiles, direct enable/disable overrides,
      built-in recipes, generated Templates, Projects, and legacy custom
      Templates.
- [ ] Generate a Project from no base Profile and from an existing base Profile,
      then render each complete bundle through both `--bundle` and explicit-role
      selection.
- [ ] Cover Project validation, summary/report boundaries, generated body hooks,
      and absence of competing generated page-number/page-chrome policy.
- [ ] Cover Interactive inherit, enable, and disable choices across existing,
      built-in, Custom, generated, bundle, and saved-recipe handoff sources.
- [ ] Verify default arithmetic, `start: 0`, increment greater than one, both
      sequence origins, and both visibility scopes.
- [ ] Verify single-page and multi-page covers, title/front matter, variable ToC
      length, blank pages, repagination, and body transitions.
- [ ] Verify all positions and Phase 1-proven typography/separator behavior across
      portrait, landscape, and narrow margins.
- [ ] Verify occupied-slot, `{pages}`, legacy inference, missing-hook, and
      unsupported-capability diagnostics.
- [ ] Record command result, warnings, PDF page count and dimensions, extracted
      page-number text by physical page, and representative page images.
- [ ] Visually inspect visibility, sequence, placement, clipping, overlap, and
      page transitions without using PDF byte equality as acceptance evidence.
- [ ] Confirm viewer page labels and physical `{pages}` semantics remain
      unchanged.
- [ ] Run focused tests, the Markdown PDF regression suite, the full repository
      suite, TypeScript, lint, format check, build, and `git diff --check`.
- [ ] Record only repository-relative, public-safe evidence; keep raw candidate
      environments and resolved temporary paths local.

Phase checkpoint:

- The final CLI path reproduces every capability claimed from Phase 1.
- Extracted text and visual inspection agree for representative fixtures.
- Compatibility fixtures prove omitted new fields preserve shipped behavior.
- Direct and Interactive Project-bundle paths preserve one contained Profile
  contract and equivalent bundle/explicit rendering behavior.
- All required focused, repository-wide, static, build, and formatting checks
  pass before documentation claims the feature as shipped.

### Phase 13: Guidance And Lifecycle Closeout

Tasks:

- [ ] Update [Markdown PDF Usage][markdown-pdf-usage] with the direct toggle,
      Profile fields, defaults, compatibility behavior, and examples.
- [ ] Update [Markdown PDF Codex Profile Helper][profile-helper] with durable
      authoring and ownership guidance.
- [ ] Update [Markdown PDF Codex Project Helper][project-helper] with the
      Profile-owned page-number contract, Profile/Template compatibility,
      generated-bundle review, `--bundle` rendering, explicit-role equivalent,
      and validation behavior.
- [ ] Update [Markdown PDF Codex Template Helper][template-helper] with the
      stable body hook and CSS ownership boundary: permit cover/ToC and layout
      presentation plus deliberate later user CSS, while keeping ordinary
      page-number sequence/content policy Profile-owned.
- [ ] Update Interactive Markdown PDF usage with the one-render choice and
      update formal-guide and Project-bundle descriptions for durable Profile
      authoring and handoff.
- [ ] Update `md pdf-profile init` examples and direct CLI help snapshots.
- [ ] Document `{page}` as logical, `{pages}` as physical, and the warning
      posture for non-default arithmetic and body origin.
- [ ] Document capability-specific renderer requirements without presenting one
      local development environment as the public baseline.
- [ ] Publish the concise placeholder handoff required by the cross-feature
      language research without expanding this plan into namespace or escaping
      work.
- [ ] Verify every guide example against the implemented command and schema.
- [ ] Record final validation and renderer evidence in public-safe wording.
- [ ] Link the completed implementation records from this plan and the related
      research.
- [ ] Change plan and research lifecycle status only after implementation,
      validation, review, documentation, and evidence links are complete.

Phase checkpoint:

- Current guides describe only implemented and validated behavior.
- Profile and Project helper guides agree on ownership, bundle resolution, and
  the `md to-pdf` render boundary.
- Template guidance distinguishes required structural/presentation support from
  Profile-owned ordinary page-number policy and deliberate user overrides.
- Public records contain reproducible versions, results, and conclusions but no
  local activation commands, environment names, or resolved machine paths.
- The research and plan satisfy the repository's evidence requirements before
  either is marked `completed`.

## Related Research

- [Markdown PDF Page-Number Configuration research][page-number-research]
- [Pattern, Placeholder, and Template Language Guide research][pattern-language-research]

## Related Guides

- [Markdown PDF Usage][markdown-pdf-usage]
- [Markdown PDF Codex Profile Helper][profile-helper]
- [Markdown PDF Codex Project Helper][project-helper]
- [Markdown PDF Codex Template Helper][template-helper]

[markdown-pdf-usage]: ../guides/markdown-pdf-usage.md
[page-number-research]: ../researches/research-2026-08-11-markdown-pdf-page-number-configuration.md
[pattern-language-research]: ../researches/research-2026-08-11-pattern-placeholder-and-template-language-guide.md
[profile-helper]: ../guides/markdown-pdf-codex-profile-helper.md
[project-helper]: ../guides/markdown-pdf-codex-project-helper.md
[template-helper]: ../guides/markdown-pdf-codex-template-helper.md
