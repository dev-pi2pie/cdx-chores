---
title: "Markdown PDF Interactive code highlighting implementation"
created-date: 2026-07-23
modified-date: 2026-07-23
status: active
agent: codex
---

## Goal

Expose the shipped Markdown PDF code-highlighting contract in Interactive mode
without changing direct CLI defaults, flags, Profile schema, or renderer
precedence.

The implementation has two separate responsibilities:

```text
Profile formal-guide
  -> collect reusable code settings
  -> review and serialize them in the Profile

Interactive to-pdf
  -> collect one-render inherit / enable / disable
  -> compile to codeHighlight: undefined / true / false
  -> prepare and render through the existing renderer
```

The existing authoring matrix remains authoritative:

```text
Profile         -> starter | formal-guide | Codex Assistant
Template bundle -> starter | formal-guide | Codex Assistant
Project bundle  -> Codex Assistant only
```

This plan must not introduce Project `starter`, Project `formal-guide`, a
Project preparation-mode prompt, or Template-owned code settings.

## Why This Plan

The related follow-up research settles:

- reusable `highlight`, `theme`, `lineNumbers`, and `transformerNotation`
  settings remain Profile-owned
- Interactive Profile `formal-guide` defaults highlighting to enabled
- Profile `starter`, direct Profile initialization, and direct render defaults
  remain unchanged and off
- Template bundles provide compatible presentation but do not own or enable
  highlighting
- Project preparation remains Codex Assistant-only, with reusable settings
  carried by the generated Profile
- Interactive `to-pdf` defaults to `Use recipe setting` and reuses the
  renderer's existing optional `codeHighlight` boolean
- render-override changes must not regenerate an accepted artifact or repeat a
  Codex request

The remaining work is to place those decisions into the current prompt,
prepared-result, review, and lifecycle boundaries without creating a parallel
Interactive schema.

## Starting State

Current reusable-setting seams:

- `src/cli/interactive/markdown/formal-guide/` collects layout, margin, and ToC
  groups shared by deterministic Profile and Template authoring.
- `src/cli/interactive/markdown/authoring.ts` knows the selected artifact
  before collecting `formal-guide` answers, so it can keep the new section
  Profile-only.
- `src/cli/interactive/markdown/deterministic-authoring.ts` prepares Profile
  and Template candidates through their existing initialization services.
- `src/cli/markdown-pdf/profile/init-service.ts` currently materializes the
  default code block through `createMarkdownPdfProfileConfig`; omitted
  customization therefore remains `highlight: false`.
- deterministic candidate review shows layout, margins, and ToC but not the
  full reusable code block.
- Codex Profile and Project candidates contain a generated Profile that can be
  normalized for review; Template candidates do not own those settings.

Current render seams:

- `PrepareMarkdownPdfRenderInput` already accepts `codeHighlight?: boolean`.
- `prepareMarkdownPdfRender` already resolves the effective code settings
  through `resolveMarkdownPdfCodeOptions`.
- `collectPreparedMarkdownPdfRenderSource` currently combines source
  collection and authoritative preparation, so the new override cannot yet be
  placed between those steps.
- existing-source recipe review shows only one effective highlighting line.
- `MarkdownPdfGeneratedLifecycleSelection` carries the accepted candidate,
  lifecycle, Markdown input, and Codex report choice, but no one-render
  highlighting state.
- generated rendering prepares the renderer only after materialization, which
  is the correct place to apply the existing optional boolean.
- saved-recipe handoff currently prepares its selected Profile or bundle
  before any render-override prompt exists.

## Product Contract

### Reusable Profile settings

Only Profile `formal-guide` adds a Code highlighting group:

```text
Enable code highlighting in this Profile?
|
+-- Yes (default)
|   +-- Theme
|   +-- Show line numbers in highlighted code blocks?
|   `-- Enable transformer notation in highlighted code blocks?
|
`-- No
    `-- Skip dependent prompts
```

Rules:

- initial enablement defaults to Yes
- Theme uses the existing five-theme light allowlist and defaults to
  `github-light`
- line numbers and transformer notation default to No
- choosing No skips the dependent prompts
- an initially disabled section keeps `github-light` as an inert valid theme
- revising enabled to disabled retains the selected theme and forces line
  numbers and transformer notation off
- enabling again reuses the retained theme and defaults the two dependent
  booleans to No
- only Profile `formal-guide` shows `Revise code highlighting`
- Profile `starter` remains the direct-equivalent starter
- Template deterministic and Codex authoring never claims reusable code
  settings
- Profile Codex Assistant and Project Codex Assistant reviews show the
  generated Profile values without adding a Project preparation branch

### One-render override

Interactive `to-pdf` exposes:

```text
? Code highlighting for this PDF
❯ Use recipe setting
  Enable for this render
  Disable for this render
  Back
  Cancel
```

| Interactive choice | Shared renderer input | Direct equivalent |
| --- | --- | --- |
| `Use recipe setting` | `codeHighlight: undefined` | omit both flags |
| `Enable for this render` | `codeHighlight: true` | `--code-highlight` |
| `Disable for this render` | `codeHighlight: false` | `--no-code-highlight` |

Always show all three choices after source selection, including when an
existing bundle or Custom source has not yet been authoritatively prepared.
Do not suppress, disable, or change the default choice based on preliminary
Profile discovery.

The choice is one-render session state. It is not persisted in a Profile,
Template, Project, saved preference, or new recipe type.

`Use recipe setting` means:

- use the stored Profile code block when a Profile is resolved
- otherwise use the renderer default of highlighting off

`Enable for this render` uses the Profile theme and dependent settings when
present. Without a Profile it uses `github-light` with line numbers and
transformer notation off.

`Disable for this render` forces highlighting, line numbers, and transformer
notation off for that render without mutating the Profile.

### Review contract

Reviews separate durable, transient, and effective state:

```text
Reusable Profile settings:
- Highlighting: enabled
- Code highlighting theme: light-plus
- Line numbers: enabled
- Transformer notation: disabled

Render override:
- Use recipe setting

Effective render:
- Highlighting: enabled
- Code highlighting theme: light-plus
- Line numbers: enabled
- Transformer notation: disabled
```

Template-only, built-in, and Custom sources without a Profile omit the
Reusable Profile settings block. They still show the render override and
effective result.

### Lifecycle placement

```text
Existing / built-in / Custom source
  -> source selected
  -> one-render override
  -> authoritative renderer preparation
  -> recipe review
  -> outputs and final review
  -> render

Generated source
  -> candidate prepared and accepted
  -> temporary-render or save-and-render selected
  -> one-render override
  -> applicable outputs and final review
  -> materialize accepted candidate
  -> authoritative renderer preparation
  -> render

pdf-recipes
  -> prepare, review, and save only
  -> optional to-pdf handoff
  -> choose or reuse Markdown input
  -> one-render override
  -> authoritative renderer preparation
  -> render
```

Back from the override returns:

- existing, built-in, and Custom paths to recipe-source selection
- generated paths to the same accepted candidate review
- saved-recipe handoff to Markdown-input selection

The override belongs to one accepted source or candidate plus its Markdown
input:

- preserve it while revisiting outputs, final review, recovery, or the same
  accepted candidate, including a lifecycle change for that candidate
- reset it to `Use recipe setting` when the Markdown input, recipe source,
  artifact, or preparation mode changes
- reset it when regeneration replaces a Codex candidate
- never carry it from one candidate identity into another

Returning from the override to existing-source selection or handoff
Markdown-input selection ends that render context and resets the choice.
Returning to the same generated candidate review retains it unless the user
then changes or regenerates the candidate.

Changing only the override may repeat deterministic renderer preparation. It
must not regenerate deterministic or Codex artifacts, repeat a Codex request,
rewrite a successfully saved recipe, or discard applicable output and report
choices.

## Scope

### In scope

- Profile-only `formal-guide` collection, conditional prompts, compilation,
  revision, serialization, and review
- resolved Profile code review for Profile Codex Assistant and Project Codex
  Assistant candidates
- one-render override collection for built-in, existing Profile, existing
  bundle, Custom inputs, generated, and saved-recipe handoff paths
- reusable, override, and effective review blocks
- backtracking and change actions that preserve applicable accepted state
- direct CLI compatibility tests
- Interactive guide and direct-usage mapping updates
- focused, repository-wide, and real-renderer validation

### Out of scope

- new direct `md to-pdf` flags
- changes to `md pdf-profile init` defaults or public options
- Profile, Template, Project, report, or serialized Interactive recipe schemas
- dark Shiki themes or changes to the existing theme allowlist
- render-time Theme, line-number, or transformer-notation overrides
- code settings in `md pdf-template init|codex`
- Project `starter`, Project `formal-guide`, or any Project preparation menu
- automatic changes to existing saved Profiles or bundles
- reopening the completed historical Shiki or Interactive plans
- release-note work before the enhancement enters a release scope

## Implementation Approach

### Artifact-aware formal-guide state

Add a code-answer group using the existing Profile code types and theme
allowlist. Keep layout, margin, and ToC collection shared, but request and
compile the code group only when the selected deterministic artifact is
Profile.

Extend prepared Profile initialization through a narrow optional normalized
code input. Omission must continue to materialize the current direct starter
Profile exactly; Template initialization must not accept or serialize this
input.

Do not introduce a general Profile patch layer for this bounded requirement.
The accepted result should remain one prepared Profile candidate that is
reviewed, rebound, and written without regeneration.

### Shared render-override state

Use a small Interactive-only choice type such as:

```text
inherit | enable | disable
```

Compile it at the renderer boundary:

```text
inherit -> undefined
enable  -> true
disable -> false
```

Split source collection from authoritative preparation where required so the
prompt occurs after the source is known and before `prepareMarkdownPdfRender`.
Pass only the compiled optional boolean into the existing renderer service.

The prompt does not need to know whether bundle or Custom preparation will
resolve a Profile. It always offers all three choices. Authoritative
preparation later resolves `inherit` to either the stored Profile value or the
no-Profile renderer default of off, and review shows which result was used.
Do not add an earlier Profile-only discovery or preparation pass for prompt
conditioning.

The source-specific Profile, Template, CSS, bundle, and provenance inputs
remain unchanged.

### Review helpers

Use shared formatting helpers for normalized reusable and effective code
settings so deterministic candidate review, Codex candidate review,
existing-source recipe review, and final render review do not drift.

The helper must distinguish:

- a resolved Profile whose reusable values can be shown
- a Template-only or built-in source with no reusable Profile settings
- the selected one-render override
- the already resolved effective result

For a Project Codex candidate, inspect only its generated contained Profile.
Do not add Project-specific code prompts or a Project settings schema.

### Lifecycle state

Carry the compiled override in render-session state, not artifact identity.
For generated paths, collect it only after the lifecycle is accepted and
before output collection or materialization.

Key that state to the current Markdown input and accepted source or candidate.
Retain it across review, output, recovery, and lifecycle navigation for that
same context. Reinitialize it to `inherit` when a different input, source,
artifact, preparation mode, or regenerated candidate establishes a new
context.

Final review should offer `Change code highlighting` alongside applicable
output and recipe-review navigation. Changing it preserves:

- Markdown input
- source paths or accepted generated candidate
- generated lifecycle
- resolved outputs
- Codex report retention when present

Only effective renderer preparation may repeat after the override changes.

## Implementation Phases

### Phase 1: Reusable Profile Settings And Candidate Reviews

Tasks:

- [x] Create the Phase 1 job record and mark this plan `active` when
      implementation begins.
- [x] Add typed Profile code answers and prompt contracts under
      `src/cli/interactive/markdown/formal-guide/`.
- [x] Use the existing Shiki light-theme allowlist and `github-light` default.
- [x] Collect Theme, line numbers, and transformer notation only when
      highlighting is enabled.
- [x] Preserve a validated theme while forcing dependent booleans off during
      disable and revision flows.
- [x] Make `formal-guide` collection artifact-aware without adding code fields
      to Template candidates.
- [x] Add the narrow prepared Profile-init code input while preserving omitted
      direct initialization output.
- [x] Compile and serialize all four fields for Profile `formal-guide`.
- [x] Add `Revise code highlighting` only to Profile `formal-guide` candidate
      review.
- [x] Show all four resolved Profile values in deterministic Profile, Profile
      Codex Assistant, and Project Codex Assistant candidate reviews.
- [x] Keep Template candidate reviews free of reusable code-setting claims.
- [x] Add focused collection, conditional-prompt, revision, serialization,
      candidate-review, and artifact-matrix tests.
- [x] Prove Project still enters Codex Assistant directly without a
      preparation-mode prompt.
- [x] Prove direct `md pdf-profile init` output remains unchanged when the new
      optional prepared input is omitted.
- [x] Review the exact Phase 1 change range and resolve actionable findings.

Phase gate:

- Profile `formal-guide` defaults highlighting on and serializes a valid code
  block.
- disabling skips dependent prompts and serializes both dependent booleans off
- Profile revision reuses the accepted candidate lifecycle without writing
  early
- Template receives no reusable code prompts or review block
- Project remains Codex Assistant-only
- direct Profile initialization remains compatible

### Phase 2: Existing-Source And Handoff Render Overrides

Tasks:

- [x] Create the Phase 2 job record.
- [x] Add the shared `Code highlighting for this PDF` prompt and choice-to-
      optional-boolean compiler.
- [x] Split existing source selection from authoritative renderer preparation
      without duplicating bundle or explicit-role resolution.
- [x] Collect the override after built-in, existing Profile, existing bundle,
      or Custom source selection and before preparation.
- [x] Show inherit, enable, and disable unconditionally; do not pre-resolve a
      bundle or Custom Profile merely to condition the prompt.
- [x] Apply the same order to a saved Profile or bundle entering through
      `pdf-recipes -> to-pdf` handoff.
- [x] Pass only the compiled `codeHighlight` value to
      `prepareMarkdownPdfRender`.
- [x] Render separate reusable Profile, render override, and effective code
      blocks in recipe and final render reviews.
- [x] Omit the reusable block when no Profile is resolved.
- [x] Add `Change code highlighting` navigation while retaining Markdown input,
      source selection, and resolved output state.
- [x] Implement Back and Cancel without an implicit write or render.
- [x] Return existing, built-in, and Custom Back actions to recipe-source
      selection, and handoff Back actions to Markdown-input selection.
- [x] Reset the override to inherit when those Back actions establish a new
      source or Markdown-input context.
- [x] Add focused tests for inherit, enable, and disable across built-in,
      existing Profile, existing bundle, Custom, Template-only, and handoff
      paths.
- [x] Cover no-Profile `Use recipe setting` and Template-only
      `Enable for this render` explicitly.
- [x] Prove existing-bundle and Custom prompts expose all three choices before
      authoritative Profile resolution.
- [x] Review the exact Phase 2 change range and resolve actionable findings.

Phase gate:

- every non-generated render source is prepared with exactly one of
  `undefined`, `true`, or `false`
- recipe and final reviews agree on reusable, override, and effective state
- `Use recipe setting` without a Profile remains off
- Template-only enablement activates Shiki without creating Template-owned
  settings
- prompt availability does not depend on preliminary Profile discovery
- override changes do not reselect or mutate the render source

### Phase 3: Generated Lifecycle And Backtracking

Tasks:

- [x] Create the Phase 3 job record.
- [x] Add one-render override state to the generated render lifecycle without
      adding it to artifact identity or saved-recipe data.
- [x] Collect the override after temporary-render or save-and-render acceptance
      and before artifact/PDF output collection.
- [x] Preserve accepted deterministic or Codex candidates, lifecycle, output
      choices, and applicable Codex report retention while changing the
      override.
- [x] Pass the compiled optional boolean into renderer preparation after
      temporary or durable materialization.
- [x] Keep materialization, output-collision, cleanup, failure-retention, and
      recovery behavior unchanged.
- [x] Ensure Back from the override returns to the same candidate review.
- [x] Preserve the override when returning to the same accepted candidate,
      including when only its generated lifecycle changes.
- [x] Reset the override when Change artifact, Change preparation mode, or
      Regenerate replaces the accepted candidate context.
- [x] Ensure final-review `Change code highlighting` returns to the same
      override prompt without another artifact preparation or Codex request.
- [x] Ensure a successfully saved recipe is not rewritten when only the
      override changes.
- [x] Add deterministic temporary-render and save-and-render tests for all
      three override values.
- [x] Add injected-runner Codex Profile, Template, and Project tests that count
      requests and materializations across override changes and backtracking.
- [x] Add candidate-identity tests proving override retention for the same
      candidate and reset for changed or regenerated candidates.
- [x] Add saved Project handoff coverage without introducing a Project
      preparation branch.
- [x] Review the exact Phase 3 change range and resolve actionable findings.

Phase gate:

- generated paths collect the override at the settled lifecycle point
- artifact and Codex preparation occur once per accepted candidate
- override state cannot leak across candidate identities
- override changes may repeat renderer preparation only
- output, report, cleanup, and recovery state remain applicable and stable
- Project is still created only through Codex Assistant

Status:

- Phase 3 implementation, validation, and review evidence are complete for
  `59a7c9f..b82a127`.

### Phase 4: Guides, Regression Gates, And Renderer Validation

Tasks:

- [x] Create the Phase 4 job record.
- [ ] Update
      `docs/guides/markdown-pdf-interactive-usage.md` with Profile-owned
      reusable settings, the one-render override, conditional prompts, review
      wording, and lifecycle placement.
- [ ] Update the Code Highlighting section in
      `docs/guides/markdown-pdf-usage.md` with a concise Interactive mapping.
- [ ] State explicitly that Template does not own code settings and Project
      preparation remains Codex Assistant-only.
- [ ] Retain and run direct CLI coverage for omitted,
      `--code-highlight`, and `--no-code-highlight` behavior.
- [ ] Run focused Interactive and Markdown PDF renderer tests.
- [ ] Run lint, format, build, full test, and diff checks.
- [ ] Use `examples/playground/` for isolated real-render smoke artifacts.
- [ ] Smoke Profile `formal-guide` default-on and disabled output.
- [ ] Smoke existing Profile inherit, enable, and disable behavior.
- [ ] Smoke Template-only enablement with the default light theme.
- [ ] Smoke a Project bundle using its contained Profile without adding a
      Project preparation path.
- [ ] Record only public-safe validation evidence; omit machine-specific
      environment setup and paths.
- [ ] Review the exact Phase 4 and complete-plan change ranges and resolve
      actionable findings.
- [ ] Link completed job evidence, then reassess this plan and the related
      research statuses.

Phase gate:

- focused and repository gates pass or carry an explicit external dependency
  limitation
- real rendering confirms the effective highlighting decisions
- direct CLI defaults and flags remain compatible
- both guides match the shipped Interactive prompts and ownership model
- public records contain no machine-specific setup details
- no actionable implementation or documentation findings remain

## Validation Plan

### Focused automated coverage

Primary Interactive suites:

- `test/cli-interactive-markdown-pdf/formal-guide.test.ts`
- `test/cli-interactive-markdown-pdf/deterministic-authoring.test.ts`
- `test/cli-interactive-markdown-pdf/codex-authoring.test.ts`
- `test/cli-interactive-markdown-pdf/render-sources.test.ts`
- `test/cli-interactive-markdown-pdf/lifecycle-unit.test.ts`
- `test/cli-interactive-markdown-pdf/lifecycle.test.ts`
- `test/cli-interactive-markdown-pdf/handoff.test.ts`
- `test/cli-interactive-markdown-pdf/materialization.test.ts`

Retain direct regression coverage for:

- `test/cli-actions-md-to-pdf-code-highlight.test.ts`
- `test/cli-actions-md-to-pdf-actions.test.ts`
- `test/cli-actions-md-to-pdf-actions-validation.test.ts`
- `test/cli-actions-md-to-pdf-commands.test.ts`
- `test/cli-actions-md-to-pdf-profile.test.ts`
- `test/cli-actions-md-to-pdf-bundle.test.ts`

### Repository gates

```bash
bun run lint
bun run format:check
bun run build
bun test
git diff --check
```

### Manual smoke

When renderer dependencies are available, validate:

1. Profile `formal-guide` default-on with fenced code
2. Profile `formal-guide` disabled with dependent features off
3. existing Profile with a non-default theme and reusable dependent settings
4. inherit, enable, and disable render choices against that Profile
5. Template-only enablement using `github-light`
6. existing Project bundle rendering through its contained Profile
7. generated temporary and durable rendering without artifact regeneration
8. saved-recipe handoff using the same one-render override contract

Keep smoke artifacts under `examples/playground/` and keep local environment
setup out of public documentation and job evidence.

## Risks And Mitigations

- Risk: extending Profile initialization changes direct starter output.
  Mitigation: make code customization optional, keep omission on the existing
  materialization path, and add exact direct-output regression coverage.

- Risk: shared `formal-guide` collection leaks Profile settings into Template
  artifacts.
  Mitigation: make the selected artifact an explicit collection input and test
  the Profile/Template matrix.

- Risk: generic artifact wording creates a Project deterministic branch.
  Mitigation: preserve the current Project direct-to-Codex routing and assert
  the prompt sequence in every phase that touches authoring.

- Risk: existing sources are prepared before the override is known.
  Mitigation: split collection from preparation and keep
  `prepareMarkdownPdfRender` as the sole authoritative compiler.

- Risk: changing the override repeats Codex generation or artifact writes.
  Mitigation: store the override in render-session state and count injected
  preparation, Codex, bind, write, and renderer calls.

- Risk: review output claims reusable settings for Template-only or built-in
  sources.
  Mitigation: derive reusable review visibility from actual resolved Profile
  provenance rather than effective defaults.

- Risk: live renderer validation records private machine setup.
  Mitigation: record only command-independent outcomes and repository-relative
  smoke artifacts.

## Expected Job Records

Create each phase record when execution of that phase begins, replacing
`YYYY-MM-DD` with its UTC creation date:

- `docs/plans/jobs/YYYY-MM-DD-markdown-pdf-interactive-code-highlighting-phase-1-profile-settings.md`
- `docs/plans/jobs/YYYY-MM-DD-markdown-pdf-interactive-code-highlighting-phase-2-render-overrides.md`
- `docs/plans/jobs/YYYY-MM-DD-markdown-pdf-interactive-code-highlighting-phase-3-lifecycle.md`
- `docs/plans/jobs/YYYY-MM-DD-markdown-pdf-interactive-code-highlighting-phase-4-validation.md`

## Completion Criteria

This plan is complete only when:

- Profile `formal-guide` exposes and serializes the settled reusable settings
- Template owns no reusable code settings
- Project preparation remains Codex Assistant-only
- every Interactive render source supports inherit, enable, and disable
- reviews separate reusable, one-render, and effective state
- backtracking preserves applicable accepted state without regeneration
- direct CLI behavior and defaults remain compatible
- focused, repository-wide, and real-render validation evidence is recorded
- the two current usage guides document the shipped contract
- the plan, research, and job statuses match the recorded evidence

## Related Research

- [Markdown PDF Interactive Code Highlighting](../researches/research-2026-07-23-markdown-pdf-interactive-code-highlighting.md)
- [Markdown PDF Shiki Code Highlighting](../researches/research-2026-05-16-markdown-pdf-shiki-code-highlighting.md) — historical direct and Profile contract
- [Markdown PDF Interactive Mode](../researches/research-2026-07-03-markdown-pdf-interactive-mode.md) — historical Interactive lifecycle contract
- [Markdown PDF Project Codex Helper](../researches/research-2026-07-03-markdown-pdf-project-codex-helper.md) — historical Project Codex-only contract

## Related Plans

- [Markdown PDF Interactive Mode implementation](plan-2026-07-21-markdown-pdf-interactive-mode.md) — historical completed plan
- [Markdown PDF Shiki code highlighting implementation](plan-2026-05-17-markdown-pdf-shiki-code-highlighting-implementation.md) — historical completed plan
