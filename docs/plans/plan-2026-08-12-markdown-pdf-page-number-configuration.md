---
title: "Markdown PDF page-number configuration implementation"
created-date: 2026-08-12
modified-date: 2026-08-13
status: active
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

| Field       | Default          |
| ----------- | ---------------- |
| `enabled`   | `false`          |
| `scope`     | `body`           |
| `countFrom` | `document`       |
| `start`     | `1`              |
| `increment` | `1`              |
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

- changing or authoring PDF viewer page-label metadata
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

Temporary and smoke work has three distinct owners:

| Purpose                             | Workspace                                                        | Rule                                                                                                           |
| ----------------------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Phase 9–10 workflow sanity          | ignored `examples/playground/md-pdf/smoke/<phase>/<unique-run>/` | Local-only smoke; never force-add or record the concrete path, environment, raw output, or generated contents. |
| Phase 11 generated temporary render | existing CLI-owned OS-temporary recipe session                   | Product lifecycle, not a test workspace; reuse canonical session cleanup, retention, and recovery.             |
| Phase 12 renderer evidence          | existing Phase 1 ownership-marked OS-temporary laboratory        | Reuse the fixture/evidence harness; add no second smoke or cleanup mechanism.                                  |

For Phase 9–10 smoke, record only sanitized outcomes, limitations, relevant
public tool versions, and cleanup state. For Phase 11, Back or Cancel before
session creation writes nothing; success removes only the exact owned session,
while failure or failed cleanup uses the existing recovery flow. Durable and
pre-existing recipes are never automatically removed. For Phase 12, freeze a
compact covering matrix before execution: deterministic tests own the complete
source and override combinations, while live candidate runs own renderer
selection, extraction, and representative visual evidence. Public evidence
never includes local setup, retention choices, resolved paths, or raw reports.

## Implementation Phases

### Phase 1: Renderer Compatibility Evidence

Tasks:

- [x] Record the exact proposed permanent fixture file list in the Phase 1 job
      before adding it, and review additions that expand that boundary.
- [x] Add a typed fixture catalog under `test/fixtures/markdown-pdf/` that
      materializes the renderer-contract HTML/CSS scenarios into the temporary
      laboratory, plus one shared Markdown/Profile actual-launch pair.
- [x] Keep copied inputs, generated HTML/CSS, PDFs, PNGs, reports, and candidate
      environments in the ownership-marked temporary laboratory; do not
      force-add ignored playground artifacts.
- [x] Guard cleanup with the exact resolved laboratory path and an ownership
      marker, and refuse unmarked, missing-marker, or broader parent paths.
- [x] After extraction, visual inspection, and public-safe evidence recording,
      remove a successful laboratory automatically unless an explicit local
      keep option was selected; retain failed and inconclusive laboratories for
      diagnosis, then remove them after the issue is resolved or the run is
      formally abandoned.
- [x] Add deterministic tests for successful cleanup, failure retention,
      retained-laboratory closeout, explicit retention, and refusal to clean an
      unsafe path.
- [x] Materialize isolated WeasyPrint `65.1`, `68.0`, and `69.0` candidate
      projects under one uniquely named OS temporary laboratory.
- [x] Use the same Python minor version and fixture inputs for every candidate.
- [x] Record effective WeasyPrint, Pydyf, FontTools, Python, and shared native
      Pango versions without recording local environment names or paths.
- [x] Cover default arithmetic, `start: 0`, `increment: 2`, document origin,
      body origin, and the first-body reset boundary.
- [x] Cover single-page and multi-page covers, title/front-matter output,
      single-page and multi-page ToCs, blank pages, and long-content
      repagination.
- [x] Cover both visibility scopes, all six positions, portrait, landscape,
      narrow margins, typography, and separators.
- [x] Keep the upstream page-group repagination case as a separate sentinel and
      promote it to a required fixture only if the selected generator strategy
      depends on equivalent page-group state.
- [x] Extract page-number text by physical page and render representative PNGs
      for visual inspection.
- [x] Add an actual-launch control lane that selects each candidate renderer,
      runs `doctor --json`, and renders a shared input through the currently
      shipped `md to-pdf` path.
- [x] Treat the actual-launch control as proof of candidate selection and
      existing launch compatibility, not as proof of advanced controls that do
      not exist until later phases.
- [x] Classify contract mismatches separately from setup, dependency, native
      library, font-discovery, or executable-launch failures.
- [x] Establish the lowest passing version separately for reset, increment,
      document visibility, body origin, and each proposed style capability.
- [x] Constrain or stop any capability that does not pass on `69.0` before
      implementing its public contract.
- [x] Create or update
      `docs/plans/jobs/YYYY-MM-DD-markdown-pdf-page-number-phase-1-renderer-evidence.md`
      during execution with the public-safe version matrix, fixture outcomes,
      baseline decisions, limitations, and retained or constrained capability
      set.
- [x] Update the research conclusions and lifecycle status only as supported by
      the recorded renderer evidence.
- [x] Run focused checks and the full repository validation suite, and record
      the passing result in the Phase 1 job.
- [x] Review the exact Phase 1 implementation and evidence commit range,
      resolve every actionable finding, and record the final verdict before
      beginning Phase 2.

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

- [x] Convert every renderer-retained style capability from Phase 1 into an
      exact public value domain before changing the schema.
- [x] Define accepted CSS units and numeric ranges for font size, line height,
      separator width, and separator gap, including whether unitless zero is
      valid for each field.
- [x] Define the accepted font-weight domain, color grammar, and separator-style
      enum; reject arbitrary CSS tokens and values outside the documented
      subset.
- [x] Record the finalized domains, defaults, normalization rules, and examples
      in the Phase 1 evidence job and related research so schema and guidance
      consume one decision source.
- [x] Create or update
      `docs/plans/jobs/YYYY-MM-DD-markdown-pdf-page-number-phase-2-profile-contract.md`
      with the accepted domains, compatibility results, validation evidence,
      and checkpoint commits.
- [x] Record the exact-range review verdict in the Phase 2 job before closing
      the phase.
- [x] Extend normalized types with `scope: document | body`,
      `countFrom: document | body`, `start`, and `increment`.
- [x] Add the shared typed `style` shape to `header` and `footer` without adding
      `pageNumbers.style`.
- [x] Preserve the existing `enabled`, `position`, and `format` defaults.
- [x] Default `scope` to `body`, `countFrom` to `document`, `start` to `1`, and
      `increment` to `1`.
- [x] Preserve literal `start: 0` through parsing, normalization, merging, and
      serialization.
- [x] Reject negative or fractional `start` and non-positive or fractional
      `increment`.
- [x] Reject `scope: document` with `countFrom: body` during configuration
      validation.
- [x] Validate bounded font-size, font-weight, line-height, color, separator
      width, separator style, separator color, and separator gap values.
- [x] Update schema allowlists, defaults, normalization, YAML/JSON
      serialization, deterministic initialization, and Codex Profile adapter
      paths.
- [x] Preserve Project/Profile artifact loading and writing through the same
      normalized schema.
- [x] Add old-Profile fixtures proving omitted new fields retain the shipped
      behavior.
- [x] Add round-trip fixtures for every new field and validation boundary.
- [x] Review the exact Phase 2 implementation and evidence commit range,
      resolve every actionable finding, and record the final verdict before
      beginning Phase 3.

Phase checkpoint:

- Every exposed style value has an exact, renderer-proven grammar and boundary;
  no task relies on an undefined meaning of "bounded."
- Existing Profiles normalize without migration and retain current behavior.
- New values round-trip through normalized YAML and JSON without semantic loss
  or coercion; serialization may emit defaulted fields.
- Invalid arithmetic, invalid scope/origin combinations, and invalid style
  values fail before rendering.
- The capability set retained after Phase 1 and the exposed schema still agree.

### Phase 3: HTML Body Hooks And Template Compatibility

#### Phase 3A: Structural Body Contract

- [x] Add the stable `.document-body` hook to the built-in body `<main>`.
- [x] Adopt `.document-body` in generated Template-Codex required-hook
      validation while preserving existing Pandoc, title, and ToC hooks.
- [x] Define a provable boundary as exactly one usable `.document-body` element
      that owns the Pandoc `$body$` insertion point; reject missing, duplicate,
      or structurally unrelated matches for body-origin numbering.
- [x] Inspect actual selected or generated HTML rather than synthesis metadata
      when proving the boundary.
- [x] Treat exactly one class-token match containing the single real `$body$`
      insertion point as proven; reject missing, duplicate, unrelated,
      comment-only, attribute-only, and script-only matches.

#### Phase 3B: Selected-Template Compatibility

- [x] Preserve the warning-based legacy inference only for document-origin body
      visibility; never use it to satisfy a body-origin request.
- [x] Inspect the final explicitly selected or bundle-resolved Template after
      Profile resolution and fail before dependency probes or output writes
      when a body-origin request lacks a proven boundary.
- [x] Preserve existing generic Profile-only, Template-only, CSS-only,
      Template/CSS, and complete-bundle behavior when no body proof is needed.

#### Phase 3C: Template Helper And Base Profile

- [x] Review direct `md pdf-template codex --base-profile` behavior when the
      Profile requests document-origin or body-origin numbering.
- [x] Preserve Profile-only and Template/CSS partial bundle inputs in the direct
      Template helper while requiring generated HTML to be compatible with the
      externally owned Profile contract.
- [x] Keep Template signals and generated Template CSS free of duplicated
      Profile-owned page-number values.
- [x] Keep generated output as a Template/CSS partial bundle and include the
      external base Profile in the follow-up render command without copying it
      into the bundle.
- [x] Add built-in, generated, legacy custom, missing-hook, duplicate-hook,
      direct Template-helper, base-Profile, and partial-bundle tests.
- [x] Create and maintain
      `docs/plans/jobs/2026-08-12-markdown-pdf-page-number-phase-3-template-compatibility.md`
      with checkpoint commits and validation evidence.
- [x] Review the exact Phase 3 implementation and evidence commit range,
      resolve every actionable finding, and record the exact range and final
      verdict in the job before beginning Phase 4.

Phase checkpoint:

- Built-in and generated Templates expose exactly one usable body boundary.
- Body-origin compatibility is proven from actual HTML and fails before a
  usable artifact or render is reported when the proof is absent.
- Direct Template-helper output remains compatible with its base Profile
  without changing generic partial-bundle behavior or copying Profile policy.

### Phase 4: Page-Number And Page-Chrome CSS

#### Phase 4A: Sequence And Visibility

- [x] Confirm the document-origin first-page reset selector and separator span
      behavior with compact temporary renderer micro-smokes before selecting
      the generator strategy.

- [x] Generate document-origin reset and increment rules from normalized
      `start` and `increment`.
- [x] Generate first-body reset and increment rules only through the
      Phase 1-proven selector strategy.
- [x] Keep cover page numbers hidden while allowing sequence participation to
      follow `countFrom`.
- [x] Implement selective `scope: body` and `scope: document` visibility.
- [x] Restore only page-number content on eligible ToC pages without restoring
      unrelated headers or footers.

#### Phase 4B: Position, Style, And Cascade

- [x] Preserve all six existing positions and page-number-wins slot output.
- [x] Emit header/footer typography and separator CSS only for Phase 1-proven,
      renderer-proven style fields.
- [x] Preserve `fonts.pageChrome` ownership of font family.
- [x] Preserve Template and user stylesheet precedence without adding
      `!important` or a parallel stylesheet order.
- [x] Add deterministic CSS tests for all sequence, visibility, position,
      style, cover, title, ToC, body, and legacy Template branches.

#### Phase 4C: Product Renderer Evidence

- [x] Extend the compact Phase 1 harness with Profile-driven product scenarios
      without committing generated HTML, CSS, PDF, PNG, environment, or raw
      report artifacts.
- [x] Run every accepted candidate, extract expected labels by physical page,
      inspect representative PNGs, and close every successful or resolved
      temporary laboratory.
- [x] Create and maintain
      `docs/plans/jobs/2026-08-12-markdown-pdf-page-number-phase-4-page-number-css.md`
      with selector decisions, renderer outcomes, checkpoint commits,
      validation evidence, and cleanup state.
- [x] Review the exact Phase 4 implementation and evidence commit range,
      resolve every actionable finding, and record the exact range and final
      verdict in the job before beginning Phase 5.

Phase checkpoint:

- Generated CSS matches every retained Phase 1 fixture strategy.
- Cover, ToC, header, footer, and page-number rules do not restore or suppress
  unrelated page chrome.
- Existing default CSS output remains compatible when new controls are omitted.

### Phase 5: Direct `md to-pdf` Effective Render Configuration

#### Phase 5A: Tri-State Override And Effective Configuration

- [x] Register `--page-numbers` and `--no-page-numbers` on direct
      `md to-pdf` using the existing optional-boolean convention.
- [x] Preserve the omitted/inherit, explicit-enable, and explicit-disable
      tri-state through command, action, preparation, and render layers.
- [x] Resolve the direct override only into effective
      `pageNumbers.enabled`; never mutate or serialize the loaded Profile.
- [x] Make the resolved Profile setting, direct override, and effective setting
      separately available to review and diagnostic logic.
- [x] Preserve the effective page-number snapshot, Profile/override
      precedence, and no-default-CSS incompatibility reason as internal
      preparation context for Phase 6 without defining a second public
      diagnostic schema.

#### Phase 5B: `--no-default-css` Compatibility Boundary

- [x] Keep `--no-default-css` authoritative: when page numbers are effectively
      enabled, reject the combination before intermediate or PDF output because
      the generated page-chrome contract is disabled.
- [x] Keep deliberate custom-CSS page counters available when Profile page
      numbers are disabled; do not inspect or claim ownership of arbitrary user
      counter CSS.
- [x] Add command help, forwarding, precedence, no-default-CSS, loaded-Profile,
      bundle, and no-Profile compatibility tests.
- [x] Create and maintain
      `docs/plans/jobs/2026-08-12-markdown-pdf-page-number-phase-5-effective-render-configuration.md`
      with the starting boundary, 5A/5B checkpoints, validation evidence,
      public-safe failure behavior, and cleanup status.
- [x] Run focused checks, the Markdown PDF regression slice, and the full
      repository validation suite; record the passing results in the Phase 5
      job before closing the phase.
- [x] Review the exact Phase 5 implementation and evidence range, resolve
      every actionable finding, and record the widened range and final verdict
      in the job before beginning Phase 6.

Phase checkpoint:

- Direct omission is behaviorally identical to the shipped path.
- Explicit enable and disable affect only the current render's effective
  toggle.
- The no-default-CSS boundary is deterministic and never claims to apply
  generated Profile page numbers after their owning stylesheet is disabled.
- Phase 5 preserves the condition context needed by the shared diagnostic
  payload defined in Phase 6; it does not introduce a direct JSON output mode
  or a second diagnostic schema.
- No new direct `md to-pdf --json` surface is introduced.

### Phase 6: Diagnostics, Capability Gates, And Doctor

#### Phase 6A: Shared Diagnostic Contract And Warning Lifecycle

- [x] Detect an occupied selected header/footer slot before page-number
      replacement and emit one successful warning per document.
- [x] Warn once when `{pages}` is combined with non-default arithmetic or body
      origin while preserving its physical-page-count meaning.
- [x] Warn once when document-origin body visibility uses the proposed legacy
      custom-Template inference.
- [x] Route plain warnings to `stderr` without changing a successful exit code.
- [x] Define one structured diagnostic payload reusable by `doctor --json`,
      Project reports, and later Interactive review; use stable condition IDs,
      severity, public-safe message, and optional capability/context details.
- [x] Freeze stable IDs for selected-slot, `{pages}` arithmetic,
      legacy-body-inference, missing-body-boundary, missing renderer,
      unverified renderer version, renderer probe failure, unknown capability,
      and unsupported-capability conditions; keep warning prose separate from
      machine-readable output.
- [x] Define occupied-slot detection as a trimmed, non-empty configured value
      in the selected header/footer area before page-number replacement; test
      empty, whitespace-only, literal, and metadata-resolving-empty values.
- [x] Aggregate each warning condition once per rendered document and reset the
      accumulator for every new render; do not emit once per physical page or
      duplicate the same condition across preparation and render layers.
- [x] Keep the Phase 3 structural body validator as the sole source of truth
      for proving `.document-body` and `$body$`; Phase 6 only maps its result to
      the shared missing-body-boundary diagnostic.

#### Phase 6B: Capability Evaluation And Pre-Render Gates

- [x] Represent effective advanced controls as explicit renderer capabilities
      rather than one blanket advanced-version boolean.
- [x] Gate only controls that are effective after Profile and direct-override
      precedence; default or ineffective controls must not trigger an advanced
      gate.
- [x] Record the effective-control matrix mapping each retained sequence,
      origin, scope, header/footer typography field, and separator field to its
      Phase 1 baseline, evaluator status, and stable failure ID; record the
      body hook separately as a structural prerequisite.
- [x] Define installed-version parse failure, missing renderer, dependency
      probe failure, and unknown capability states; fail closed for an
      effectively requested capability and preserve existing behavior when no
      advanced control is requested.
- [x] Fail before intermediate HTML, PDF, report, or other output writes when
      an effectively requested capability is unsupported by the installed
      renderer.
- [x] Fail before rendering when body origin has no provable body-start hook,
      using the Phase 3 validator result and the shared diagnostic ID.

#### Phase 6C: Doctor Parity And Cross-Surface Tests

- [x] Extend `doctor` to report installed renderer version and page-number
      capability availability using the same baseline data as pre-render
      validation.
- [x] Keep `doctor` request-neutral: report the installed renderer's baseline
      capability snapshot and stable statuses/IDs, while pre-render validation
      filters that same snapshot through the current effective controls.
- [x] Preserve normal nonzero CLI failure handling for render gates, structured
      error representation where a JSON/report surface exists, JSON-only
      `stdout` for `doctor --json`, and existing human doctor conventions.
- [x] Add no-output-on-error, warning-frequency, structured-output, and
      `doctor` agreement tests, including unknown-version and probe-failure
      states.
- [x] Create and maintain
      `docs/plans/jobs/2026-08-12-markdown-pdf-page-number-phase-6-diagnostics-capabilities-doctor.md`
      with checkpoint commits, public-safe diagnostic and capability evidence,
      and validation results.
- [x] Run focused checks, the Markdown PDF regression slice, and the full
      repository validation suite; record static/build/format and
      `git diff --check` results in the Phase 6 job.
- [x] Review the exact Phase 6 implementation and evidence range, resolve
      every actionable finding, and record the widened range and final verdict
      in the job before beginning Phase 7.

Phase checkpoint:

- Every fallback and hard failure matches the research diagnostic matrix.
- Plain rendering and `doctor --json` use the same condition identifiers and
  capability data; later Project and Interactive phases consume that shared
  diagnostic payload.
- Renderer gating and `doctor` cannot disagree about an installed version.
- Unsupported advanced behavior fails before PDF or intermediate HTML writes.
- Phase 6A, 6B, and 6C each have recorded checkpoint evidence, and one exact
  aggregate Phase 6 range review covers every subphase before completion.

### Phase 7: Profile Helper And Interactive Durable Authoring

#### Phase 7A: Direct Profile-Helper Audit And Preservation

- [x] Audit direct `md pdf-profile codex` from `--base-profile` loading through
      candidate construction, bounded patch application, normalization,
      serialization, human review, write, and optional report output before
      changing behavior.
- [x] Prove that omitted new fields, explicit `enabled: false`, literal
      `start: 0`, non-default arithmetic, both valid origins, position, format,
      and retained page-chrome style survive the existing bounded patch and
      candidate lifecycle without truthiness loss or a parallel schema.
- [x] Add only the missing direct-helper seams found by that audit, and keep
      malformed Profiles, unknown keys, invalid value domains, and invalid
      scope/origin combinations on the shared Profile validation path.
- [x] Keep the direct Profile helper's optional report in Phase 7 scope and
      apply the existing public-safe path and error redaction to every new
      page-number and capability-requirement field; add acceptance coverage for
      both redacted success and failure report content.
- [x] Reuse the Phase 6 capability catalog and Phase 1 baselines to describe
      which renderer capabilities a candidate will require. The authoring
      review entry contains only requested capability ID, requesting Profile
      fields, and minimum proven baseline; it contains no installed status,
      renderer probe, condition ID/result, or readiness verdict.
- [x] Keep Profile authoring advisory: it must not probe or gate on the
      currently installed renderer, and an unsupported local renderer must not
      invalidate an otherwise valid reusable Profile. Direct rendering and
      `doctor` retain ownership of installed-version and availability
      evaluation.

#### Phase 7B: Interactive Formal-Guide Profile Model

- [x] Add Profile-only page-number and page-chrome groups to Interactive
      formal-guide authoring.
- [x] Collect enablement, sequence, visibility, format, position, and retained
      header/footer style through one draft that compiles into the normalized
      Profile contract; do not introduce an Interactive-only render or
      serialization schema.
- [x] Preserve exact `false` and zero values during collection and revision,
      and re-prompt or return to revision for invalid value domains and the
      invalid scope/origin combination before a candidate is accepted.
- [x] Keep Template-only formal-guide authoring free of Profile-owned
      page-number sequence, visibility, label, position, and page-chrome style.

#### Phase 7C: Interactive Authoring Integration

- [x] Carry the same durable Profile behavior through existing Profile,
      complete-bundle, formal-guide, and Codex Profile authoring paths.
- [x] Show normalized reusable Profile values plus advisory capability
      requirements in candidate review using the bounded requirement entry
      shape without implying that the installed renderer was checked or that a
      render will succeed.
- [x] Preserve an accepted Profile candidate during revision without repeating
      unrelated Codex requests, then persist and reload the same normalized
      values through the existing authoring lifecycle.
- [x] Add direct-helper and Interactive tests for collection, revision, review,
      persistence, reload, generated candidates, Template ownership, no
      renderer probe, unsupported-local-renderer authoring, and public-safe
      direct Profile report redaction.
- [x] Create and maintain
      `docs/plans/jobs/2026-08-12-markdown-pdf-page-number-phase-7-profile-authoring.md`
      with the `62d223af` starting boundary, 7A/7B/7C checkpoints, public-safe
      evidence, validation results, and cleanup state.
- [x] Run focused direct Profile-helper and Interactive authoring tests, the
      broad Markdown PDF regression slice, and the full repository suite; run
      `bunx tsc --noEmit`, `bun run lint`, `bun run format:check`,
      `bun run build`, and `git diff --check` at final reviewed implementation
      tip `992cfdc5`.
- [x] Commit the Phase 7 job and plan evidence update as documentation-only
      after confirming its scope and passing at least `bun run format:check`
      and `git diff --check`; record that commit as the evidence tip.
- [x] Review the exact aggregate Phase 7 implementation/evidence range
      `62d223af..992cfdc5`, including evidence commit `903c94c6` and the fixes
      that widened the final tip; resolve every actionable finding and record
      the final verdict in the Phase 7 job before beginning Phase 8.

Phase checkpoint:

- Direct Profile-helper output contains one normalized, reviewable, and
  round-trippable page-number contract.
- Interactive writes one normalized durable Profile contract and introduces no
  second render schema.
- Template ownership remains consistent with existing Markdown PDF artifact
  boundaries.
- Capability requirements shown during authoring reuse Phase 6 data but remain
  bounded to requested capability ID, requesting fields, and Phase 1 minimum
  baseline. They include no installed status, probe, condition result, or
  readiness verdict; only render preparation and `doctor` evaluate the
  installed renderer.
- Focused, broad Markdown PDF, full repository, static, format, build, and diff
  checks pass at final reviewed implementation tip `992cfdc5`. Evidence commit
  `903c94c6` is inside the exact reviewed range `62d223af..992cfdc5`, which
  covers 7A, 7B, 7C, and all resolved review findings. The subsequent
  documentation-only closeout commit is outside that reviewed range and must
  preserve its two-document scope and pass format and diff checks.

### Phase 8: Project Profile/Template Coordination And Validation

#### Phase 8A: Authoritative Base Profile And Final Profile

- [x] Audit direct `md pdf-project codex` from shared signals through Profile
      phase, normalized final Profile, Template phase, validation, and the
      existing write/report/handoff boundaries before changing behavior.
- [x] Load, shape-validate, and normalize `--base-profile` before either Project
      Codex phase; malformed files, unknown Profile keys, invalid arithmetic,
      and invalid scope/origin combinations must fail rather than being silently
      repaired by Codex.
- [x] Treat the normalized base Profile as the authoritative patch base, not as
      advisory context. The bounded Profile decision may preserve or explicitly
      revise supported fields, and the resulting normalized final Profile is
      the sole page-number contract passed onward.
- [x] Apply bounded patch semantics explicitly: an omitted patch key preserves
      the normalized base value; a present allowed key replaces it, including
      exact `false` and `0`; `null`, unknown keys, and invalid values are
      rejected rather than treated as omission, deletion, or a request for
      Codex repair.
- [x] Add base/final Profile fixtures for omitted new fields, explicit
      `enabled: false`, literal `start: 0`, non-default `increment`, both valid
      origins, retained page-chrome style, deliberate bounded revision, and
      every invalid validation boundary. Add direct patch tests for omitted,
      present `false`, present `0`, `null`, unknown, and invalid keys.
- [x] Preserve explicit valid base values unless the reviewed bounded decision
      changes them; the final in-memory Profile must not lose false, zero, or
      another valid non-default value.

#### Phase 8B: Template Coordination

- [x] Pass the normalized final Profile into Template coordination without
      copying page-number enablement, sequence, visibility, label, position, or
      page-chrome style into Template signals or generated Template CSS.
- [x] Keep Project-specific orchestration free of a second page-number schema
      and preserve existing Template-owned layout, cover, title, ToC, code, and
      asset decisions.
- [x] Reuse Phase 6 capability requirements and diagnostic payload types for
      the final Profile; Project preparation must not invent a second
      capability matrix or imply that authoring checked the installed renderer.

#### Phase 8C: Generated Structure And CSS Validation

- [x] Inspect the actual generated `template.html`, not synthesis metadata, and
      require one usable `.document-body` containing the live `$body$` insertion
      point plus the existing required Pandoc, title, ToC, code, and cover hooks.
- [x] Reuse the Phase 3 body-boundary validator and the Phase 6 shared
      diagnostic envelope and stable missing-boundary condition instead of
      defining Project-only structural semantics.
- [x] Validate the freshly generated Template stylesheet contribution before it
      is written or combined with Profile-derived renderer CSS. Do not feed
      Profile-generated counter, margin-box, or page-chrome CSS into this
      ownership validator or reject the Profile for owning its renderer rules.
- [x] Allow the Template contribution to own ordinary document layout,
      unnamed `@page` size and margins, named cover and ToC presentation and
      clearing, and the exact renderer-proven named-ToC behavior retained by
      Phase 4.
- [x] Reject only Template-contributed ordinary-page margin-box content that
      uses page counters, page-counter reset or increment rules, and typography,
      font, or separator declarations that compete with Profile-owned ordinary
      page chrome.
- [x] Name and cover the allowed fixtures
      `template-layout-and-unnamed-page-geometry`,
      `template-named-cover-presentation`, and
      `template-named-toc-presentation-and-clearing`; name and cover the
      rejected fixtures `template-ordinary-margin-box-page-counter`,
      `template-page-counter-reset-or-increment`,
      `template-competing-page-chrome-typography`, and
      `template-competing-page-chrome-separator`.
- [x] Do not apply this generated-CSS validator to later user edits, arbitrary
      custom stylesheets, or generic Template/CSS partial bundles; those remain
      the deliberate lower-level override path and render-time responsibility.

#### Phase 8D: No-Output Validation Integration

- [x] Run base/final Profile, generated-structure, CSS-ownership, shared
      diagnostic, and capability-requirement validation before Project bundle,
      report, summary, or follow-up-command writes.
- [x] Permit only process-owned in-memory values. If parser or file-shape
      inspection later requires filesystem inputs, use one ownership-marked
      OS-temporary inspection area with exact-path and ownership-marker cleanup
      guards. Phase 8 remained in memory, so that conditional cleanup and
      unsafe-path refusal branch was not applicable, implemented, or exercised.
- [x] Return typed validation results and public-safe diagnostics to the
      prepared Project flow. Preserve the existing generic Project report
      serialization of each validation result's name, status, and message.
      Phase 9 owns structured diagnostic and capability-requirement fields, any
      report/summary schema extension, artifact references, and render handoff.
- [x] On validation failure, expose no usable Project bundle, replayable input
      claim, or follow-up render command. Create no persistent Project output
      directory, Profile, Template, Stylesheet, report, or partial role unless
      the caller explicitly requested the existing report-only failure path;
      that path retains its existing public-safe report behavior and must not
      create or claim replayable roles. Its generic validation result may
      contain the new result's name, status, and message. Phase 8 adds no
      structured diagnostic fields, capability-requirement fields, or stable
      condition ID to reports or summaries; Phase 9 owns that work.
- [x] Prove success and handled failure leave no temporary inspection artifacts
      and that report-only failure leaves only its existing explicitly
      requested report, with no Project output directory or
      Profile/Template/Stylesheet role. Because validation remained in memory,
      no marked temporary area or cleanup/refusal path was needed.
- [x] Add focused Project tests for base/final Profile preservation and
      revision, Template signal ownership, actual-HTML hook validation,
      the named generated-CSS allowed/rejected fixtures, shared diagnostics,
      typed validation results, in-memory no-temporary-artifact behavior,
      report-only failure, and no-output failure ordering.
- [x] Create and maintain
      `docs/plans/jobs/2026-08-12-markdown-pdf-page-number-phase-8-project-coordination.md`
      with starting boundary `7b7ae9b5`, 8A/8B/8C/8D
      checkpoints, public-safe evidence, validation results, and cleanup state.
- [x] Run focused Project/Profile/Template validation, the broad Markdown PDF
      regression slice, and the full repository suite; run
      `bunx tsc --noEmit`, `bun run lint`, `bun run format:check`,
      `bun run build`, and `git diff --check` at the final implementation tip.
      If a correction changes that tip, rerun affected gates before review;
      evidence-only documentation then requires targeted format and diff
      checks.
- [x] Review the exact aggregate Phase 8 range from the recorded Phase 7 final
      tip through the final Phase 8 correction tip
      (`7b7ae9b5..01879241`), resolve every actionable finding, widen the tip
      when fixes land, and record the final exact range and verdict in the
      Phase 8 job before beginning Phase 9.

Phase checkpoint:

- The normalized base Profile is the authoritative patch base, and the
  normalized final Profile is the sole reusable page-number contract passed to
  Template coordination and later serialization. Omitted bounded patch keys
  preserve base values, present valid keys replace them exactly, and null,
  unknown, or invalid keys fail.
- Generated `template.html` provides the required structural hooks, and
  the validated Template contribution to generated `style.css` does not become
  a competing ordinary page-number owner or forbid valid Template/user
  presentation boundaries. Profile-generated renderer CSS is outside that
  ownership validator.
- Project compatibility validation covers base-Profile validity, final-Profile
  preservation, body-hook coherence, and generated-CSS ownership before any
  bundle handoff.
- Phase 8 returns typed validation results through the shared diagnostic and
  capability contracts and preserves existing generic `validationResults`
  serialization of name, status, and message. Phase 8 adds no structured
  diagnostic fields, capability-requirement fields, stable condition ID, or
  schema extension to reports or summaries; Phase 9 owns those new fields and
  render-command handoff. Correction `0bbd6408` restores this boundary and
  keeps the stable body-boundary validation condition ID in in-memory
  diagnostics only.
- Phase 8 leaves no temporary inspection artifacts and no persistent Project
  roles; validation is in memory, so no temporary cleanup/refusal branch is
  implemented or exercised. An explicitly requested report-only failure may
  leave only its existing public-safe report.
- Focused Project, broad Markdown PDF, full repository, static, format, build,
  and diff checks pass at final tip `01879241`. Exact aggregate range
  `7b7ae9b5..01879241` covers 8A, 8B, 8C, 8D, evidence commit `127b2c16`, and
  all review corrections. Recorded review findings are closed; the
  documentation-only closeout commit remains outside that reviewed range.

### Phase 9: Project Bundle, Report, And Render Handoff

Tasks:

- [x] Create and maintain the
      [Phase 9 job record](jobs/2026-08-13-markdown-pdf-page-number-phase-9-project-bundle-handoff.md)
      from starting boundary `78701f3a`, with focused and aggregate validation,
      one implementation commit, exact-range review, and a documentation-only
      closeout.
- [x] Consume the typed Phase 8 validation results at the existing Project
      output boundary; serialize their public-safe diagnostic and capability
      fields into summaries and optional reports only in this phase.
- [x] Show the final contained Profile page-number settings separately from
      Template presentation and Project orchestration in direct and Interactive
      Project candidate review.
- [x] Keep Project summaries and optional reports bounded to phase decisions,
      validation results, and artifact references without persisting a second
      detailed page-number object.
- [x] Show a compact effective page-number summary in human review while keeping
      the optional report authoritative by reference to the final Profile
      identity and `profile.yml`; include structured page-number diagnostics and
      capability results, not a duplicated mutable configuration object.
- [x] Keep dry-run, validation-failure, successful-write, and optional-report
      output consistent about Profile identity, artifact availability,
      diagnostics, and whether a follow-up render is usable.
- [x] Apply existing public-safe path and error redaction to every new Project
      summary, validation result, and report field.
- [x] Preserve the public-safe follow-up `md to-pdf --bundle <project>` command
      without embedding a transient Interactive enablement override.
- [x] Verify Project reports remain excluded from bundle Profile discovery and
      the complete bundle resolves exactly one Profile, Template, and
      Stylesheet role.
- [x] Define Project-helper output completeness as exactly one valid
      `profile.yml`, one `template.html`, and one `style.css`, with optional
      managed assets and recognized report artifacts; keep ordinary
      profile-only and Template/CSS partial bundles valid in the generic bundle
      resolver.
- [x] Add Project acceptance tests for missing and duplicate Profile, Template,
      or Stylesheet roles, stable ambiguity diagnostics, recognized report
      exclusion, invalid profile-shaped content, and unrelated top-level files.
- [x] Prove `--bundle <project>` and explicit `--profile --template --css`
      selection of the same canonical three Project files produce the same
      effective page-number configuration and diagnostics; do not claim
      equivalence for a deliberately ambiguous or invalid directory.
- [x] Add direct Project tests for dry-run, generated and explicit output,
      base-Profile preservation/revision, validation failure, optional report,
      bundle resolution, and render-command output.
- [x] Run a small Project handoff smoke under
      `examples/playground/md-pdf/smoke/phase9-project-handoff/<unique-run>/`:
      cover a dry-run or report-only path with no Project-role writes, a
      successful complete Project bundle, report exclusion from Profile
      discovery, and bundle versus explicit-role preparation. Attempt an
      installed-renderer handoff; if the task shell cannot resolve the
      renderer, record that limitation and rely on the automated equivalence
      gate rather than expanding environment work.
- [x] Record sanitized smoke results and cleanup state in the Phase 9 job.
      Any installed-renderer execution is a handoff sanity check; Phase 12 owns
      cross-version, extraction, visual, and page-layout evidence.
- [x] Review the exact Phase 9 implementation range with maintainability and
      test-quality reviewers, then review the closeout documentation and record
      the final verdict before beginning Phase 10.

Phase checkpoint:

- A Project-helper artifact is complete and unambiguous without changing the
  generic resolver's support for partial bundles.
- Bundle and explicit-role rendering resolve equivalent effective behavior.
- `md pdf-project codex` remains an artifact coordinator; `md to-pdf` remains
  the renderer.
- The small Project handoff smoke records sanitized results and cleanup state
  without adding a permanent smoke framework or artifact.
- The Phase 9 job records its implementation commit, exact reviewed range,
  validation evidence, and Continue/Constrain/Stop verdict.

### Phase 10: Interactive Selected-Source Render Workflow

Tasks:

- [x] Create and maintain the
      [Phase 10 job record](jobs/2026-08-13-markdown-pdf-page-number-phase-10-selected-source-render-workflow.md)
      from the final Phase 9 closeout commit, with focused, broad, full, and
      static validation, one implementation commit, exact-range review, and a
      documentation-only closeout.
- [x] Audit the current Interactive `md to-pdf` working process for built-in,
      existing, bundle, Custom, generated, and saved-recipe handoff sources
      before changing prompt placement or lifecycle state.
- [x] Record where source selection, Markdown input selection, authoritative
      renderer preparation, recipe review, output selection, final review, and
      recovery occur for each source family.
- [x] Add `Use recipe setting` as a one-render page-number choice.
- [x] Add `Enable for this PDF` and `Disable for this PDF` as the other
      one-render page-number choices.
- [x] Compile the choices to the shared optional enablement override
      `undefined`, `true`, and `false` without adding a second detailed
      page-number object.
- [x] Default to `Use recipe setting`, using the resolved Profile value or the
      normalized default when the source has no Profile.
- [x] Place the choice after the source and Markdown input are known and before
      authoritative renderer preparation for existing, built-in, and Custom
      paths.
- [x] Show recipe setting, one-render override, and effective page-number result
      as distinct values in review output.
- [x] Show effective renderer capability posture and any page-number diagnostic
      once in the Interactive review or result surface.
- [x] Define Back and Cancel destinations for built-in, existing Profile,
      existing Template/CSS, ordinary selected bundle, and Custom paths.
- [x] Preserve the one-render choice while revisiting output selection, final
      review, or recovery within the same selected-source context.
- [x] Reset the choice to `Use recipe setting` when the Markdown input, recipe
      source, selected artifact, or preparation mode changes.
- [x] Add selected-source tests for collection, effective-state review,
      no-Profile defaulting, backtracking, cancellation, retention, reset,
      recovery, warnings, and no-default-CSS failure.
- [x] Run a small selected-source smoke under
      `examples/playground/md-pdf/smoke/phase10-selected-source/<unique-run>/`:
      cover navigation-only Back and Cancel with zero writes and one built-in
      enable path through preparation and review. Keep the broader source,
      reset, and retention matrix automated rather than duplicating it in a
      long manual session.
- [x] Record sanitized smoke results and cleanup state in the Phase 10 job. A
      bounded installed-renderer attempt may be recorded as workflow sanity;
      task-environment unavailability does not block Phase 10. Generated and
      saved-recipe lifecycle remains Phase 11, and renderer acceptance remains
      Phase 12.
- [x] Review the exact Phase 10 implementation and evidence range with
      maintainability and test-quality reviewers, then review the closeout
      documentation and record the final verdict before beginning Phase 11.

Phase checkpoint:

- Built-in, existing Profile/Template/CSS, ordinary bundle, and Custom sources
  use one prompt placement and one effective-configuration path.
- Temporary enablement state is neither persisted nor confused with durable
  Profile configuration.
- Review output makes recipe, override, and effective state independently
  understandable.
- Backtracking within the same selected-source context preserves the transient
  choice; a changed source or input resets it.
- The small selected-source smoke confirms navigation and one prepared review
  path; automated coverage proves the broader source, reset, retention, and
  handoff matrix. Sanitized results and cleanup state are recorded in the Phase
  10 job.
- The Phase 10 job records its implementation commit, exact reviewed range,
  validation evidence, and Continue/Constrain/Stop verdict.

### Phase 11: Interactive Generated And Saved-Recipe Lifecycle

Tasks:

- [x] Create and activate the
      [Phase 11 job record](jobs/2026-08-13-markdown-pdf-page-number-phase-11-generated-saved-lifecycle.md)
      from starting boundary `824ce4e6`. Maintain focused, broad, full, and
      static gates; the intentional manual-smoke omission; cleanup evidence;
      commits; exact review range; and final verdict there as execution
      proceeds.
- [x] Reuse the existing generated and saved-recipe lifecycle, including its
      CLI-owned temporary session and recovery behavior; add no new temporary
      helper or playground smoke framework.
- [x] For generated paths, place the page-number choice after the existing
      one-render code-highlighting choice and before report/output collection,
      materialization, or authoritative renderer preparation.
- [x] For saved-recipe `to-pdf` handoff, place the choice after Markdown input
      and code-highlighting selection but before authoritative preparation.
- [x] Use an accepted candidate's normalized Profile or normalized default only
      to preview the reusable setting before materialization. After temporary
      materialization or durable save, reload the actual artifact: use its
      normalized contained Profile when present, or the normalized default or
      separately selected Profile for Profile-less Template output.
- [x] Resolve a generated Project recipe setting from the final contained
      Profile only after both Project phases complete and the candidate is
      accepted.
- [x] Cover generated Profile, Template, and Project candidates; temporary
      rendering; save-and-render; saved-recipe handoff; existing complete
      Project bundles; and user-edited saved Projects through the established
      resolver and lifecycle paths.
- [x] Treat a saved or existing Project handed off again after its contained
      Profile changed as a new render context: begin at `Use recipe setting`,
      resolve the current persisted Profile, and do not reuse candidate memory.
      Do not add mid-prompt filesystem watching.
- [x] Fail closed on stale, missing, ambiguous, or invalid contained Profile
      state without mutating the saved Project bundle.
- [x] Prove Back or Cancel before session creation produces no materialization,
      report, render, or output write. Once a temporary session exists, retain
      the established retry/review/keep/confirmed-delete recovery behavior.
- [x] Preserve the one-render choice while revisiting outputs, final review,
      recovery, or the same accepted generated candidate.
- [x] Reset the choice when the Markdown input, recipe source, artifact,
      preparation mode, generated candidate identity, or contained Profile
      identity changes.
- [x] Ensure changing only the one-render choice may repeat deterministic
      renderer preparation but does not regenerate artifacts, repeat a Codex
      request, or rewrite a successfully saved recipe.
- [x] Ensure a Project override-only change repeats neither the Project Profile
      Codex phase nor the Project Template Codex phase.
- [x] Add generated/saved lifecycle tests for generated Profile, generated
      Template, generated Project, temporary render, save-and-render, existing
      complete Project, user-edited saved Project, backtracking, cancellation,
      retention, reset, recovery, and stale-state failure.
- [x] Keep Phase 11 verification automated and deterministic; do not require a
      live Codex or renderer smoke when lifecycle seams can prove materialized
      state, exact-session cleanup, durable preservation, and zero-write paths.
- [x] Run focused, broad Markdown PDF, full repository, TypeScript, lint,
      format, build, and diff gates at the final implementation tip. Review the
      exact Phase 11 range with maintainability and test-quality reviewers and
      resolve accepted findings.
- [x] Commit the reviewed Phase 11 documentation closeout before Phase 12 and
      use that documentation-only commit as the Phase 12 starting boundary.

Phase checkpoint:

- Generated, saved, and existing Project bundles use their currently contained
  Profile as the durable recipe setting without mutating `profile.yml`.
- Materialized and user-edited saved Projects are reviewed from their current
  contained Profile, not stale candidate memory.
- Override-only changes preserve accepted work and never repeat unrelated
  Profile or Template Codex phases.
- Temporary recipe behavior reuses the shipped owned-session lifecycle; Phase
  11 adds no second cleanup mechanism or manual smoke workspace.
- The Phase 11 job records its implementation commits, exact reviewed range,
  validation and cleanup evidence, and Continue/Constrain/Stop verdict.

### Phase 12: Integrated Renderer And Compatibility Validation

Tasks:

- [ ] Create and maintain a Phase 12 job from the Phase 11 documentation
      closeout commit. Freeze the permanent-file boundary, candidate versions,
      automated matrix, live covering matrix, cleanup policy, exact review
      range, and final verdict before running evidence.
- [ ] Reuse the Phase 1 fixture catalog, ownership marker, candidate setup,
      extraction, image, report, and cleanup harness. Add no second renderer
      smoke helper or playground workspace.
- [ ] Keep the candidate set fixed to the Phase 1 evidence versions unless a
      documented expansion review accepts a change.
- [ ] Use deterministic tests for the complete orchestration matrix: old and
      new Profiles; direct overrides; built-in, Custom, generated, bundle, and
      saved-recipe sources; Interactive inherit/enable/disable; Project
      validation; report boundaries; body hooks; and Template CSS ownership.
- [ ] For each frozen candidate, run `doctor --json`, the renderer-contract
      scenarios, and at least one actual implemented `md to-pdf` launch with
      the same selected renderer.
- [ ] Materialize deterministic Projects with no base Profile and with an
      existing base Profile, then cover bundle and explicit-role rendering
      without requiring live Codex requests.
- [ ] Use a compact live covering matrix rather than every permutation. Cover
      each sequence origin, visibility scope, arithmetic boundary, position,
      typography/separator endpoint, cover/ToC/body transition, blank-page and
      repagination boundary at least once across the selected scenarios.
- [ ] Verify occupied-slot, `{pages}`, legacy inference, missing-hook, and
      unsupported-capability diagnostics.
- [ ] Record command result, warnings, PDF page count and dimensions, extracted
      page-number text by physical page, and representative page images.
- [ ] Visually inspect visibility, sequence, placement, clipping, overlap, and
      page transitions without using PDF byte equality as acceptance evidence.
- [ ] Inspect PDF page-label metadata and confirm physical `{pages}` semantics
      remain unchanged without depending on a particular GUI viewer.
- [ ] If a frozen candidate environment cannot be established after the
      documented harness attempt, record a `Constrain` verdict and the sanitized
      limitation instead of adding ad hoc environment setup loops.
- [ ] Run focused tests, the Markdown PDF regression suite, the full repository
      suite, TypeScript, lint, format check, build, and `git diff --check`.
- [ ] Record only repository-relative, public-safe evidence. Remove a successful
      ownership-marked laboratory after evidence is recorded; retain a failed
      or inconclusive laboratory only locally while unresolved, then close it
      through the existing guarded `close` command.
- [ ] Review the exact Phase 12 implementation and evidence range with
      maintainability and test-quality reviewers, resolve accepted findings,
      and commit a reviewed documentation closeout before Phase 13.

Phase checkpoint:

- The final CLI path reproduces every capability claimed from Phase 1.
- Extracted text and visual inspection agree for representative fixtures.
- Compatibility fixtures prove omitted new fields preserve shipped behavior.
- Direct and Interactive Project-bundle paths preserve one contained Profile
  contract and equivalent bundle/explicit rendering behavior.
- Automated tests prove the complete orchestration matrix; the bounded live
  matrix proves renderer behavior without a Cartesian source/style/layout run.
- Phase 12 reuses and safely closes the Phase 1 evidence laboratory rather than
  introducing another temporary or smoke framework.
- All required focused, repository-wide, static, build, and formatting checks
  pass before documentation claims the feature as shipped.
- The Phase 12 job records candidate outcomes, representative extraction and
  visual evidence, cleanup state, exact reviewed range, and final verdict.

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
