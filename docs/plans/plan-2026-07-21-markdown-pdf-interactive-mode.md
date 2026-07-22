---
title: "Markdown PDF Interactive Mode implementation"
created-date: 2026-07-21
modified-date: 2026-07-22
status: active
agent: codex
---

## Goal

Implement the two settled Interactive Markdown PDF branches over the shipped
direct helpers and deterministic renderer:

```text
md -> to-pdf      -> select or prepare a recipe -> render a PDF
md -> pdf-recipes -> prepare and save a recipe  -> optional handoff to to-pdf
```

`to-pdf` remains the only render owner. `pdf-recipes` owns durable Profile,
Template bundle, and Project bundle authoring without introducing a serialized
Interactive recipe type or a second renderer.

## Why This Plan

The related research now settles:

- the two entry goals, their shared helper-aligned preparation matrix, and their
  different lifecycle ownership
- built-in, existing, custom, `starter`, `formal-guide`, and Codex-assisted
  paths
- prepare-once review before writing or rendering
- role-by-role bundle and explicit-input precedence
- Codex intent, font-hint, base-profile, cover-image, and consent behavior
- a Phase 6.5 baseline repeatable font-hint editor followed by a separately
  researched Phase 6.6 builder and installed-family suggestion layer
- durable and CLI-owned temporary artifact lifecycles
- conditional Codex report retention
- output defaults, cleanup, failure recovery, and `pdf-recipes -> to-pdf`
  handoff ownership

The remaining work is implementation sequencing. The current direct actions
still combine preparation with writes or rendering, so the first phase must
establish reusable prepared-result boundaries before Interactive prompts are
wired.

## Starting State

Shipped direct capabilities:

- `md to-pdf` renders built-in, explicit, Profile, Template/CSS, and bundle
  inputs.
- `md pdf-profile init|codex` writes reusable Profile artifacts.
- `md pdf-template init|codex` writes Template/CSS/asset bundles.
- `md pdf-project codex` writes coordinated Project bundles.
- `md to-pdf --bundle` resolves partial or complete bundles while explicit
  role inputs remain authoritative.

Current implementation seams:

- `src/cli/interactive/menu.ts` has no Markdown PDF routes.
- `src/cli/interactive/markdown.ts` is a small linear handler for `to-docx` and
  `frontmatter-to-json`; the Markdown PDF feature should not be added as one
  large branch in that file.
- `src/cli/actions/markdown/to-pdf.ts` resolves, validates, probes renderer
  dependencies, and renders in one action.
- Profile Codex preparation and writing remain coupled in
  `src/cli/markdown-pdf/profile-codex/run.ts`.
- Template and Project Codex actions already have internal preflight results,
  but those results are private to actions that subsequently write artifacts.
- data stack demonstrates the accepted
  `prepare* -> Prepared* -> writePrepared*` boundary and checkpoint-oriented
  Interactive organization.

No implementation plan currently owns Interactive Markdown PDF mode.

## Product Contract

### Entry matrix

| Entry path                  | Profile                                      | Template bundle                              | Project bundle    |
| --------------------------- | -------------------------------------------- | -------------------------------------------- | ----------------- |
| `to-pdf -> Create a recipe` | `starter`, `formal-guide`, `Codex Assistant` | `starter`, `formal-guide`, `Codex Assistant` | `Codex Assistant` |
| `pdf-recipes`               | `starter`, `formal-guide`, `Codex Assistant` | `starter`, `formal-guide`, `Codex Assistant` | `Codex Assistant` |

Both entries map authoring choices to the same direct helper families. Project
selection skips a one-option preparation-mode menu. Interactive mode must not
synthesize Project `starter` or `formal-guide` from separate Profile and
Template initialization.

### Render and authoring ownership

- `to-pdf` renders built-in or existing recipes directly.
- generated `to-pdf` recipes offer temporary render or save-and-render.
- `to-pdf` does not offer save-only authoring.
- `pdf-recipes` saves reusable artifacts and may hand the accepted artifact to
  `to-pdf` after the save completes.
- Profile handoff enters `to-pdf` as `Existing profile`; Template and Project
  handoff enter as `Existing bundle`.
- an optional Markdown sample collected by `pdf-recipes` is a Codex preparation
  signal, not an implicit render input. The handoff must ask whether to use that
  sample or select another Markdown input.

### Prepare-once contract

Every branch follows:

```text
collect
  -> prepare and validate once
  -> review the exact prepared result
  -> revise without writing
  -> commit or render the accepted result without regeneration
```

Interactive mode must not call a Codex helper once with `dryRun: true` and
again with `dryRun: false` after acceptance.

### Output and report contract

- default output paths remain quiet until they are applicable
- an explicit output remains local state and is never sent to Codex
- the concrete resolved output appears in the final save or render review
- omitted saved Project output follows the direct helper's collision-safe
  generated directory convention under the current working directory
- Codex report retention appears only for Codex-prepared artifacts
- temporary render may keep a report only at a separate durable path
- durable Profile reports are adjacent sidecars; Template and Project reports
  may stay inside their saved bundles

## Implementation Architecture

### Prepared render boundary

Extract a renderer preparation service from
`src/cli/actions/markdown/to-pdf.ts` that can:

- normalize input, bundle, Profile, Template, CSS, metadata, and code options
- resolve role provenance and bundle warnings
- parse Markdown and construct the effective recipe
- validate input and output-independent collisions
- return a reviewable prepared render result without probing external renderer
  commands or writing PDF/HTML output

A separate commit/render service should accept that exact result plus resolved
output choices, validate output collisions, probe Pandoc and WeasyPrint, and
render once. The direct `md to-pdf` action should compose these services so its
public behavior remains compatible.

### Prepared artifact boundaries

Expose prepared Profile, Template, and Project results that contain all data
required for later validation, review, report retention, and materialization.

Rules:

- direct CLI actions continue to own their public options and summaries
- Interactive mode calls shared services, not direct actions as subprocess-like
  steps
- prepared results must not write primary artifacts
- report payloads may be retained in memory until the user commits
- temporary and durable writes consume the same prepared artifact
- prepared artifact identity, bundle-relative layout, content, and report data
  remain separate from the later physical output destination
- binding or changing an explicit or default destination must preserve the
  prepared identity and content
- output-path changes after preparation must not trigger another Codex request

Prefer extracting the existing Template and Project preflight structures over
creating parallel Interactive-only generation logic. Split the larger Profile
Codex action enough to expose the same prepare/write shape.

### Interactive module boundary

Move Markdown Interactive orchestration into a folder before the full flow
lands:

```text
src/cli/interactive/markdown/
  index.ts
  types.ts
  to-pdf.ts
  pdf-recipes.ts
  review.ts
  lifecycle.ts
```

Add smaller adjacent prompt modules only when a file gains a distinct
responsibility. Do not introduce a generic wizard engine or arbitrary
prompt-history stack.

Session state should track:

- entry path and Markdown input
- recipe source, artifact type, and preparation mode
- Custom-input composition and per-role provenance
- Codex signals and consent state
- the accepted prepared candidate
- explicit artifact/PDF/report outputs
- temporary versus durable lifecycle
- materialized temporary-bundle ownership and failure state

Backtracking returns to named checkpoints and preserves the prepared candidate
unless the user changes an input that affects preparation.

## Scope

### In scope

- Interactive menu registration for `to-pdf` and `pdf-recipes`
- built-in, existing Profile, existing bundle, and two-layer Custom inputs
- deterministic Profile and Template `starter` and `formal-guide`
- `pdf-recipes` Codex Profile, Template, and Project preparation
- `to-pdf` Codex Profile, Template, and Project preparation
- prepared-result review, revision, consent, provenance, and validation
- conditional artifact, PDF, overwrite, and Codex-report outputs
- temporary render and save-and-render lifecycles
- cleanup, failure retention, retry, revision, and explicit deletion
- saved-artifact handoff from `pdf-recipes` to `to-pdf`
- focused, integration, full-suite, and manual render validation
- current guide and lifecycle-document updates after behavior is verified

### Out of scope

- a direct `md pdf-recipes` command
- a serialized Interactive recipe schema
- Project `starter` or `formal-guide`
- raw YAML, HTML, or CSS terminal editing
- automatic deletion of existing or explicitly saved artifacts
- changes to Pandoc, WeasyPrint, Profile, Template, Project, or report schemas
- a generic Interactive wizard/history framework
- an invented release or milestone label

## Implementation Phases

### Phase 1: Prepared Service Boundaries

Tasks:

- [x] Extract prepare and render/commit services from `actionMdToPdf`.
- [x] Preserve bundle discovery, explicit-role precedence, warnings, Profile
      normalization, title signals, code options, and renderer behavior.
- [x] Expose prepared Profile, Template, and Project generation results.
- [x] Separate prepared report payloads from report writes.
- [x] Separate stable prepared artifact identity and bundle-relative paths from
      destination binding at materialization time.
- [x] Add write functions for the exact accepted prepared artifacts.
- [x] Keep direct command output, errors, defaults, and overwrite behavior
      compatible.
- [x] Add focused regression tests proving direct commands still prepare and
      commit once.
- [x] Review the Phase 1 change range before proceeding.

Phase gate:

- direct actions compose shared prepare/write or prepare/render services
- prepared results can be inspected without primary artifact or PDF writes
- a prepared Codex result can be written without a second Codex request
- changing the destination preserves prepared identity, relative layout, and
  content while rebinding only physical output paths
- existing direct-command tests pass

Expected job record:

- [Phase 1 prepared services](jobs/2026-07-21-markdown-pdf-interactive-phase-1-prepared-services.md)

### Phase 2: Routing, Module Structure, And Session State

Tasks:

- [x] Add `md:to-pdf` and `md:pdf-recipes` action keys and menu descriptions.
- [x] Move the existing Markdown handler into
      `src/cli/interactive/markdown/index.ts` without changing existing routes.
- [x] Add narrow state types for entry, source, preparation, review, lifecycle,
      and materialization checkpoints.
- [x] Add reusable select-description and checkpoint helpers only where current
      shared helpers are insufficient.
- [x] Extend the Interactive harness and route tests.
- [x] Keep incomplete branches fail-closed until their first usable path lands.
- [x] Review the Phase 2 change range before proceeding.

Phase gate:

- existing `to-docx` and `frontmatter-to-json` behavior remains unchanged
- both Markdown PDF routes reach typed handlers in tests
- Escape, Back, and Cancel behavior is defined at each new top-level checkpoint
- no large all-purpose Markdown Interactive file is introduced

Expected job record:

- [Phase 2 routing and state](jobs/2026-07-22-markdown-pdf-interactive-phase-2-routing-state.md)

### Phase 3: Built-In, Existing, And Custom Render Paths

Tasks:

- [x] Collect the Markdown input and recipe source for `to-pdf`.
- [x] Implement built-in and existing Profile/bundle resolution.
- [x] Implement Custom inputs as composition mode followed by explicit-role
      selection.
- [x] Reuse direct bundle admission, ambiguity, warning, and precedence rules.
- [x] Render a grouped recipe review with role provenance and no writes.
- [x] Collect the PDF output only after recipe review.
- [x] Render the accepted prepared result with one final confirmation.
- [x] Add source-routing, provenance, conflict, backtracking, and render tests.
- [x] Review the Phase 3 change range before proceeding.

Phase gate:

- built-in, existing, and Custom paths never invoke Codex
- review shows the effective recipe before output selection
- existing external artifacts are never cleanup targets
- successful Interactive render behavior matches the equivalent direct command

Expected job record:

- [Phase 3 render sources](jobs/2026-07-22-markdown-pdf-interactive-phase-3-render-sources.md)

### Phase 4: Deterministic Recipe Authoring

Tasks:

- [x] Add Profile and Template `starter` preparation.
- [x] Add Profile and Template `formal-guide` prompt collection over the
      normalized deterministic recipe surface.
- [x] Reuse the same prepared results in `to-pdf` and `pdf-recipes`.
- [x] Support revision at the smallest relevant prompt group.
- [x] Keep Project deterministic modes unavailable.
- [x] Save durable `pdf-recipes` artifacts only after final review.
- [x] Require the direct initialization output contract for durable Profile and
      Template saves; do not invent a deterministic output fallback.
- [x] Add temporary-render and save-and-render lifecycle choices for `to-pdf`
      without adding a save-only outcome; defer owned temporary-directory and
      recovery execution to Phase 6.
- [x] Add artifact-matrix, answer-revision, validation, and direct-parity tests.
- [x] Review the Phase 4 change range before proceeding.

Phase gate:

- deterministic authoring never invokes Codex
- Profile and Template preparation matches the direct initialization contract
- durable deterministic saves require the direct Profile path or Template
  directory, while temporary rendering uses a Phase 6-owned session path
- the same prepared artifact supports durable and render lifecycles
- no Project mode is synthesized from separate deterministic helpers

Expected job record:

- [Phase 4 deterministic authoring](jobs/2026-07-22-markdown-pdf-interactive-phase-4-deterministic-authoring.md)

### Phase 5: Codex-Assisted Recipe Authoring

Tasks:

- [x] Add `pdf-recipes` Codex preparation for Profile, Template, and Project.
- [x] Add Project-only Codex preparation under `to-pdf`.
- [x] Reuse the selected `to-pdf` Markdown input and request an optional sample
      only under `pdf-recipes`.
- [x] Always prompt for optional intent and support repeatable font-hint
      add/remove editing.
- [x] Collect artifact-specific base Profile and cover-image signals.
- [x] Show bounded signal consent before every Codex request.
- [x] Hold candidate and report data in memory through review and revision.
- [x] Regenerate only through the explicit regeneration action.
- [x] Add report-retention choices filtered by lifecycle and retain the choice
      in session state for Phase 6 materialization.
- [x] Add injected-runner tests proving review, output changes, and acceptance do
      not repeat Codex requests.
- [x] Review the Phase 5 change range before proceeding.

Phase gate:

- the entry-specific helper matrix is enforced
- local outputs are excluded from Codex consent and request payloads
- accepted candidates can be committed without regeneration
- reports are written only after the user commits

Expected job record:

- [Phase 5 Codex authoring](jobs/2026-07-22-markdown-pdf-interactive-phase-5-codex-authoring.md)

The checked Phase 5 items record the originally implemented entry matrix.
Phase 6.5 owns the subsequently accepted UX and matrix refinement without
rewriting that completed checkpoint.

### Phase 6: Materialization, Recovery, And Handoff

Tasks:

- [x] Materialize temporary artifacts into a unique CLI-owned session
      directory using the existing OS-temporary-directory posture.
- [x] Remove only the exact owned session directory after successful render.
- [x] Retain and print the session directory after materialization,
      renderer-preparation, render, or cleanup failure.
- [x] Implement retry without regeneration, revise while retaining diagnostic
      artifacts, keep-and-exit, and confirmed delete-and-exit.
- [x] Retry durable materialization from the same bound candidate and retry
      renderer preparation without rewriting a successful durable artifact.
- [x] Keep durable artifacts and external inputs outside automatic cleanup.
- [x] Commit completed PDFs through the shared symlink-aware safe-write
      boundary.
- [x] Implement `pdf-recipes -> to-pdf` handoff with the saved artifact
      preselected.
- [x] If preparation retained a Markdown sample, require an explicit handoff
      choice between `Use <sample>` and `Choose another Markdown file`; if no
      sample exists, require Markdown selection in `to-pdf`.
- [x] Carry only the explicitly selected Markdown path into `to-pdf` as its
      render input; never promote the preparation sample implicitly.
- [x] Add cleanup ownership, failure recovery, handoff, collision, and symlink
      boundary tests.
- [x] Review the Phase 6 change range before proceeding.

Phase gate:

- temporary and durable paths consume the same accepted prepared result
- cleanup is ownership- and outcome-based
- failure recovery never repeats Codex or silently deletes diagnostics
- durable retries preserve the same bound candidate and do not rewrite a
  successfully materialized recipe
- `pdf-recipes` leads to rendering only through `to-pdf`, with the saved
  artifact preselected and an explicitly selected Markdown render input

Expected job record:

- [Phase 6 lifecycle and handoff](jobs/2026-07-22-markdown-pdf-interactive-phase-6-lifecycle-handoff.md)

### Phase 6.5: Codex Assistant UX Refinement

Tasks:

- [ ] Expose `Codex Assistant` for Profile and Template bundle under `to-pdf`,
      reusing the selected Markdown input and the same prepared-result services
      already used by `pdf-recipes`.
- [ ] Preserve Project's direct transition to Codex Assistant without adding a
      one-option preparation-mode menu or deterministic Project modes.
- [ ] Replace `Describe the PDF direction` with optional `PDF intent` wording
      and the data-query-style single-line or multiline editor choice.
- [ ] Present Codex setup in artifact-specific order: PDF intent, base Profile,
      cover image when supported, font hints, then `Continue`.
- [ ] Keep setup actions single-select, retain the baseline repeatable
      add/remove font-hint editor with arbitrary `Font preference` text, and
      show short input guidance below the intent prompt.
- [ ] Remove output-directory editing from pre-Codex setup. Resolve explicit or
      generated-fallback artifact outputs only after recipe review and lifecycle
      selection, without sending them to Codex or regenerating the candidate.
- [ ] Keep consent ordered with the setup summary and include only the Markdown
      sample and artifact-supported signals that will be sent.
- [ ] Adapt the existing lower-level Codex progress presenter so Interactive
      mode shows exactly one concise artifact-specific waiting status rather
      than nested or duplicated animation.
- [ ] For Project preparation, change that one status across the real Profile
      and Template request stages; clear all waiting output before review,
      recovery, or error prompts and preserve direct-command progress behavior.
- [ ] Add focused tests for the expanded matrix, prompt/editor ordering, empty
      intent, consent payload, delayed output selection, prepared-candidate
      reuse, regeneration, and TTY/non-TTY waiting-status behavior.
- [ ] Record a manual Interactive transcript covering Profile or Template Codex
      preparation plus the two-stage Project waiting status.
- [ ] Review the Phase 6.5 change range before proceeding to Phase 6.6.

Phase gate:

- `to-pdf` and `pdf-recipes` expose the settled helper-aligned authoring matrix
- Codex setup uses the settled wording and signal order without early output
  collection
- each Codex request has one visible, correctly cleared Interactive waiting
  status and no duplicate lower-level spinner
- direct helper behavior remains compatible and accepted candidates are still
  committed or rendered without implicit regeneration
- repeatable free-text font hints remain usable without discovery or structured
  intended-use selection
- focused tests and manual transcript evidence cover the revised flow

Expected job record:

- `docs/plans/jobs/YYYY-MM-DD-markdown-pdf-interactive-phase-6-5-codex-assistant-ux.md`

### Phase 6.6: Font Hint Input Suggestions

This phase implements the settled direction in
[Markdown PDF Interactive Font Hint Suggestions](../researches/research-2026-07-22-markdown-pdf-interactive-font-hint-suggestions.md).
It enhances the Phase 6.5 editor without changing direct helper options or the
prepared `fontHints: string[]` contract.

Tasks:

- [ ] Add a narrow, non-persisted Interactive font-hint draft model for built
      preference/intended-use pairs and complete custom text, compiling each
      accepted draft to one ordered direct `--font-hint` equivalent.
- [ ] Expand `Add font hint` into `Build a font hint` and `Write a complete
      custom hint`, keeping arbitrary custom text available in every supported
      environment.
- [ ] Add an editable preference field whose raw custom typed value remains the
      first selectable choice, with its explanation in the choice description,
      while at most six matching installed family names appear as suggestions.
- [ ] Collapse a case-insensitive exact installed-family match, and preserve
      Enter, arrow, Tab, paste, input-method-editor, and narrow-terminal
      usability with the pinned `@inquirer/search` behavior.
- [ ] Reuse `discoverSystemFonts({ discovery: "fontconfig" })` through an
      injected Interactive suggestion source. When `fc-list` is unavailable,
      continue without suggestions and do not invoke a native platform
      fallback.
- [ ] Add optional `AbortSignal` and timeout controls to the shared discovery
      and command-runner contracts while preserving existing direct-command
      defaults.
- [ ] Start discovery lazily, run it at most once per Interactive session, cache
      usable or unavailable results, deduplicate and deterministically sort
      family names, and filter only the cached inventory while typing.
- [ ] Give Interactive discovery a `1,000 ms` hard deadline, show one concise
      waiting status only after approximately `150 ms`, and clear it before the
      preference prompt, fallback notice, or navigation.
- [ ] Add artifact-aware intended uses for general body text, headings, code
      text, code symbols, and Profile/Project page headers and footers.
- [ ] Add `Language-specific body text` with one user-entered language name or
      tag per built hint, without a prescribed language list, content inference,
      or automatic hint insertion.
- [ ] Exclude writing-system and arbitrary document-area choices from the
      structured builder; retain unusual directions through the complete-custom
      hint path without implying a guaranteed role assignment.
- [ ] Add adaptive font-hint preview, option/value direct-equivalent rendering,
      preference and intended-use revision, removal, stable ordering, and visible
      exact-duplicate handling.
- [ ] Allow multiple non-identical hints with the same intended use so primary
      and fallback directions are not misclassified as collection conflicts.
- [ ] Show accepted role/key/font mappings or unmatched font directions in the
      post-Codex recipe review, separately from the pre-Codex intended use.
- [ ] When discovery is unavailable, failed, empty, or timed out, show one
      concise notice and continue the builder with an ordinary preference
      input; keep the complete custom path available.
- [ ] Use a session-owned abort signal to stop discovery and its child process
      on Back, Cancel, or Interactive exit without a fallback warning; use the
      search callback's signal only to discard obsolete filtering work.
- [ ] Keep discovery read-only: do not install tools, mutate the environment,
      expose local font paths, or claim glyph coverage or PDF compatibility.
- [ ] Ensure consent, reports, and Codex requests include only accepted compiled
      hint strings, never the discovered inventory, adapter diagnostics, paths,
      discarded search terms, or suggestions.
- [ ] Invalidate a prepared candidate only when accepted font-hint inputs
      change; require consent before explicit regeneration and keep output-path
      changes regeneration-free.
- [ ] Add deterministic injected-inventory tests for custom-first search and
      completion, exact-match collapsing, bounded filtering, ordering,
      deduplication, intended-use compilation, editing, post-Codex mapping,
      caching, retry, and every fontconfig discovery fallback outcome.
- [ ] Add shared cancellation tests proving session abort reaches the command
      runner and child process while per-term cancellation remains local to
      obsolete search filtering.
- [ ] Add privacy assertions and direct-helper regression tests proving the
      public repeatable free-text contract remains compatible.
- [ ] Record public-safe manual evidence for one suggestion-capable path and one
      forced custom-input fallback without listing the host inventory or local
      development setup.
- [ ] Review the Phase 6.6 change range before proceeding to Phase 7.

Phase gate:

- custom font hints remain first-class and do not depend on local discovery
- optional fontconfig family suggestions are local, read-only, cached, limited
  to six installed matches, and filtered without per-keystroke commands
- missing `fc-list` takes the ordinary custom-input path without a native
  platform fallback
- shared cancellation stops active discovery, while direct `font` commands
  preserve their existing discovery and timeout defaults
- preference and optional intended use remain separate user decisions, with no
  language or coverage inference and no pre-Codex assignment claim
- every accepted draft becomes one reviewable ordered string in the existing
  Codex request contract
- recipe review distinguishes accepted role/key assignments from unmatched
  advisory directions
- discovery failures degrade to ordinary input without blocking the builder
- focused tests, privacy assertions, manual evidence, and the Phase 6.6 range
  review have no unresolved actionable findings

Expected job record:

- `docs/plans/jobs/YYYY-MM-DD-markdown-pdf-interactive-phase-6-6-font-hint-suggestions.md`

### Phase 7: Validation, Guides, And Closeout

Tasks:

- [ ] Run the focused Interactive Markdown PDF matrix.
- [ ] Run direct Profile, Template, Project, bundle, and renderer regression
      suites.
- [ ] Run repository lint, format, build, and full tests.
- [ ] Perform manual Profile, Template, Project, temporary, durable, handoff,
      and failure-recovery smoke checks under `examples/playground/`.
- [ ] Record unavailable Pandoc, WeasyPrint, Codex, or filesystem capabilities
      as environment limitations rather than product failures.
- [ ] Update current guides only for verified shipped behavior.
- [ ] Link all phase job records and verification evidence.
- [ ] Review the Phase 7 range and the complete implementation range.
- [ ] Move the plan to `completed` only after all completion criteria pass.
- [ ] Reassess the related research status using linked implementation evidence.

Phase gate:

- focused and repository gates pass or carry an explicit environment limitation
- manual smoke evidence covers the accepted lifecycle boundaries
- guide wording matches the shipped prompts and behavior
- no review range has unresolved actionable findings

Expected job record:

- `docs/plans/jobs/YYYY-MM-DD-markdown-pdf-interactive-phase-7-validation-closeout.md`

## Validation Plan

### Focused automated coverage

Add focused tests under a bounded Markdown PDF Interactive test folder rather
than expanding one large routing file. Cover:

- menu routing and entry-specific preparation matrices
- built-in, existing, bundle, and Custom-input precedence
- Profile and Template `starter` and `formal-guide`
- Profile, Template, and Project Codex preparation under `pdf-recipes`
- Profile, Template, and Project Codex preparation under `to-pdf`
- single-line, multiline, empty, and provided intent; ordered optional signals;
  consent; waiting status; and reports
- built and complete-custom font hints, custom-first fontconfig suggestions,
  artifact-aware intended uses, language-specific body hints, accepted or
  unmatched assignment review, editing, caching, shared cancellation, and
  no-native-fallback custom input
- checkpoint backtracking and prepared-candidate reuse
- destination rebinding without prepared identity or content changes
- output defaults, overwrite, collision, and final reviews
- temporary cleanup, failure retention, retry, and explicit deletion
- saved-artifact handoff and Markdown-input confirmation

Retain direct regression coverage for:

- `test/cli-actions-md-to-pdf-*`
- `test/cli-actions-md-to-pdf-template-codex/`
- `test/cli-actions-md-to-pdf-project-codex/`
- Profile Codex action and command tests
- `test/cli-interactive-routing.test.ts`

### Repository gates

```bash
bun run lint
bun run format:check
bun run build
bun test
git diff --check
```

### Manual smoke

Use `examples/playground/` for isolated local artifacts.

When dependencies are available, verify:

1. built-in and existing Profile rendering
2. existing partial and complete bundle rendering
3. Custom-input precedence with bundle provenance
4. deterministic Profile and Template preparation
5. Codex Profile, Template, and Project preparation from both entry paths,
   including waiting-status transitions and report retention
6. font-hint suggestions with an injected or available fontconfig inventory,
   plus forced missing-`fc-list`, timeout, cancellation, and custom-input paths
7. Project temporary render cleanup after success
8. retained session bundle and retry after a forced render failure
9. durable save-and-render with the generated default directory
10. `pdf-recipes -> to-pdf` handoff with and without a preparation sample

## Risks And Mitigations

- Risk: prompt wiring lands before reusable prepared results and causes a second
  Codex request after acceptance.
  Mitigation: Phase 1 is a hard prerequisite; tests count injected runner calls.

- Risk: the small Markdown handler becomes a monolithic workflow.
  Mitigation: move to a feature folder in Phase 2 and split only stable
  responsibilities.

- Risk: `pdf-recipes` becomes a second render implementation.
  Mitigation: all render handoffs enter `to-pdf` with an existing artifact.

- Risk: temporary cleanup can target user-owned data.
  Mitigation: retain the exact created directory in session state and delete
  only that owned path after explicit outcome checks.

- Risk: output and report prompts become noisy on irrelevant paths.
  Mitigation: derive them from preparation mode and lifecycle; keep defaults
  quiet until final review.

- Risk: direct CLI behavior drifts during service extraction.
  Mitigation: direct actions remain public owners and receive focused parity
  tests before Interactive routing expands.

- Risk: Interactive and direct-helper progress presenters render overlapping
  animations or leave a stale line before the next prompt.
  Mitigation: inject or suppress the lower-level presenter for Interactive use,
  assert one active status, and clear it in success, fallback, and error paths.

- Risk: font discovery delays or blocks hint entry, leaks local inventory, or
  makes host fonts part of automated-test expectations.
  Mitigation: use fontconfig only, enforce the one-second cancellable budget,
  load once through an injected source, keep custom input available, expose
  family names only after local filtering, and use controlled inventories in
  tests.

## Expected Job Records

Create one phase record when each implementation phase begins, replacing
`YYYY-MM-DD` with its UTC creation date:

- `docs/plans/jobs/YYYY-MM-DD-markdown-pdf-interactive-phase-1-prepared-services.md`
- `docs/plans/jobs/YYYY-MM-DD-markdown-pdf-interactive-phase-2-routing-state.md`
- `docs/plans/jobs/YYYY-MM-DD-markdown-pdf-interactive-phase-3-render-sources.md`
- `docs/plans/jobs/YYYY-MM-DD-markdown-pdf-interactive-phase-4-deterministic-authoring.md`
- `docs/plans/jobs/YYYY-MM-DD-markdown-pdf-interactive-phase-5-codex-authoring.md`
- `docs/plans/jobs/YYYY-MM-DD-markdown-pdf-interactive-phase-6-lifecycle-handoff.md`
- `docs/plans/jobs/YYYY-MM-DD-markdown-pdf-interactive-phase-6-5-codex-assistant-ux.md`
- `docs/plans/jobs/YYYY-MM-DD-markdown-pdf-interactive-phase-6-6-font-hint-suggestions.md`
- `docs/plans/jobs/YYYY-MM-DD-markdown-pdf-interactive-phase-7-validation-closeout.md`

## Completion Criteria

This plan is complete only when:

- both Interactive Markdown PDF routes are implemented and documented
- the entry-specific preparation matrix is enforced
- Codex setup, intent entry, and waiting feedback match the Phase 6.5 contract
- font-hint building, suggestions, intended-use and assignment review, privacy,
  and fallback match the linked Phase 6.6 research contract
- direct CLI behavior remains compatible after service extraction
- every generated candidate is prepared once and committed without implicit
  regeneration
- built-in, existing, Custom, deterministic, and Codex paths pass focused tests
- temporary cleanup and failure recovery satisfy the ownership contract
- reports and outputs appear only where applicable
- `pdf-recipes` hands rendering to `to-pdf` without a second renderer
- repository gates pass
- manual smoke evidence or explicit environment limitations are recorded
- every phase job record and review disposition is linked
- the Phase 7 and complete-plan reviews have no unresolved actionable findings

## Related Research

- [Markdown PDF Interactive Mode](../researches/research-2026-07-03-markdown-pdf-interactive-mode.md)
- [Markdown PDF Interactive Font Hint Suggestions](../researches/research-2026-07-22-markdown-pdf-interactive-font-hint-suggestions.md)
- [Markdown PDF Project Codex Helper](../researches/research-2026-07-03-markdown-pdf-project-codex-helper.md)
- [Markdown PDF Render Bundle Directory](../researches/research-2026-07-10-markdown-pdf-render-bundle-directory.md)
- [Markdown PDF Template Codex Helper](../researches/research-2026-06-18-markdown-pdf-template-codex-helper.md)

## Related Plans

- [Markdown PDF project Codex helper implementation](plan-2026-07-04-markdown-pdf-project-codex-helper.md)
- [Markdown PDF render bundle directory implementation](plan-2026-07-10-markdown-pdf-render-bundle-directory.md)
- [Markdown PDF template Codex helper implementation](plan-2026-06-23-markdown-pdf-template-codex-helper.md)
