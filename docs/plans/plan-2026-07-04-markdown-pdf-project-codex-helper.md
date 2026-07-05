---
title: "Markdown PDF project Codex helper implementation"
created-date: 2026-07-04
modified-date: 2026-07-05
status: active
agent: codex
---

## Goal

Implement the `md pdf-project codex` helper as the `v0.1.5-canary.4`
orchestration layer for Markdown PDF artifacts.

The command should produce a reviewable project folder containing the accepted
render inputs for the deterministic renderer:

```text
md-pdf-project-YYYYMMDDTHHMMSSZ-xxxxxxxx/
  profile.yml
  template.html
  style.css
  assets/
    cover.png
  project.codex-report.json
```

The product boundary stays:

```text
pdf-profile owns reusable render policy.
pdf-template owns reviewable HTML/CSS and managed assets.
pdf-project owns coordination between those artifacts.
md to-pdf remains the deterministic renderer.
```

## Milestone Goal

`v0.1.5-canary.4` should not be tagged until this helper is implemented,
verified, and documented, or until a separate release decision records why the
project helper moved out of the canary.

This plan intentionally does not implement Interactive Markdown PDF mode.
Interactive mode belongs to the next feature track after the direct profile,
direct template, and project-helper artifact contracts are accepted.

## Why This Plan

The related research settles that the direct helpers are correct but too split
for users who want one coherent PDF direction:

- `md pdf-profile codex` drafts reusable profile policy.
- `md pdf-template codex` drafts reviewable HTML/CSS/assets.
- `md to-pdf` renders accepted artifacts deterministically.

The project helper should coordinate those existing owners without becoming a
third render owner and without invoking the direct command actions as internal
subprocess-like steps.

## Starting State

Current Markdown PDF support includes:

- `md to-pdf` with `--profile`, `--template`, `--css`, and layered default CSS.
- `md pdf-profile init` for deterministic starter profiles.
- `md pdf-profile codex` for direct Codex-assisted profiles.
- `md pdf-template init` for deterministic template/CSS snapshots.
- `md pdf-template codex` for direct Codex-assisted template bundles and managed
  cover images.
- reusable template-Codex service modules under
  `src/cli/markdown-pdf/template-codex/`.

Missing pieces:

- reusable profile-Codex service modules parallel to `template-codex`.
- `md pdf-project codex` command registration and action.
- project-level identity, output planning, collision checks, and fixed bundle
  filenames.
- project-level signal classification and phase decision composition.
- profile-first orchestration followed by template synthesis against the final
  profile contract.
- project validation that checks render-command compatibility across
  `--profile`, `--template`, and `--css`.
- optional project diagnostic report and concise CLI summary.
- guide updates after implementation is verified.

## Scope

### Command Surface

Add:

```bash
cdx-chores md pdf-project codex ./report.md \
  --intent "client report with cover image, ToC, readable code, and dense tables" \
  --font-hint "prefer Noto Serif CJK TC for Traditional Chinese body text" \
  --base-profile ./base-profile.yml \
  --cover-image ./cover.png \
  --output ./report-pdf-project \
  --keep-codex-report
```

Options:

- `[input]`: optional Markdown sample for shared document signals.
- `-i, --input <path>`: optional explicit Markdown sample path; equivalent to
  positional input.
- `--intent <text>`: general render, layout, and design direction.
- `--font-hint <text>`: optional, repeatable font preference hint.
- `--base-profile <path>`: existing Markdown PDF profile to refine or use as a
  compatibility target.
- `--cover-image <path>`: local PNG, JPEG, or WebP cover image routed to the
  template phase.
- `-o, --output <directory>`: project bundle output directory.
- `--dry-run`: run signal collection, phase selection, synthesis, and validation
  without writing project artifacts.
- `--keep-codex-report`: write the project diagnostic report.
- `--codex-report-output <path>`: explicit diagnostic JSON path; implies
  `--keep-codex-report`.
- `--overwrite`: replace selected project-generated outputs when safe.

Do not add recipe flags to this public command surface. `--preset`,
`--page-size`, `--orientation`, `--margin*`, `--toc`, `--toc-depth`, and
`--toc-page-break` remain direct profile/init/render controls.

### Out Of Scope

This plan does not implement:

- automatic `md to-pdf` invocation or final PDF rendering
- Interactive Markdown PDF mode
- a mandatory `project.json` manifest
- recipe flags on the Codex project command surface
- guide updates that describe the project helper before it is implemented and
  verified

### Project Bundle Contract

The command should always resolve:

- `projectBundleId`
- `profile.id`
- `templateBundleId`
- `outputDirectory`

Generated default output directories use:

```text
md-pdf-project-YYYYMMDDTHHMMSSZ-xxxxxxxx/
```

Rules:

- explicit `--output <directory>` stays exactly user-selected.
- default output directory names are not derived from the Markdown input stem.
- generated default output is planned only after signal classification allows
  the command to proceed.
- collision retries use a bounded UID loop.
- successful normal execution writes fixed project filenames:
  `profile.yml`, `template.html`, and `style.css`.
- `assets/` is created only when managed assets exist.
- `project.codex-report.json` is written only when a report is requested.
- generated files, copied assets, and in-bundle reports stay inside
  `outputDirectory`.
- persisted artifacts avoid raw absolute source paths and raw remote URLs.

### Orchestration Contract

The phase order is profile first, then template.

Profile-first orchestration settles reusable render policy before template
synthesis. It does not mean the profile visually wins at render time. `md to-pdf
--template` replaces the generated internal template, and `--css` applies after
profile-derived default CSS, so the template/CSS layer is the stronger visual
layer. Running it second gives it the final profile contract to preserve, style,
or explicitly report as overridden.

Recommended flow:

```text
normalize project command state
  -> collect shared signals
  -> classify project signal mode
  -> plan project output
  -> run profile phase
  -> run template phase against final profile
  -> validate project compatibility
  -> write artifacts or dry-run summary
```

The project helper must compose services, not the direct CLI actions. Direct
actions print summaries and write their own artifacts, which would weaken
project-level no-partial-write behavior.

### Signal And Decision Modes

Project-level `signalMode` values:

- `too-low-signal`
- `deterministic`
- `codex-assisted`

Phase summaries should preserve the direct helper vocabularies:

- profile phase examples: `document-informed`, `hint-only`,
  `mixed-with-base`, `base-only-deterministic`, `basic-default`
- template phase examples: `base-profile-only`, `cover-image-only`,
  `deterministic`, `codex-assisted`

Project-level decision modes:

| Mode | Meaning | Exit |
| --- | --- | --- |
| `deterministic` | no Codex was needed for either phase | `0` |
| `adapted` | at least one phase used a valid Codex decision | `0` |
| `conservative-fallback` | at least one phase reduced scope but still produced valid artifacts | `0` |
| `no-usable-project` | profile or template phase failed validation or no usable path remains | non-zero |

No-signal project invocations fail as too low-signal and should recommend direct
init commands. This differs from direct `md pdf-profile codex`, where no-signal
fallback can still write a basic profile.

Final project decision mode should compose phase decisions conservatively:

```text
if either phase is no-usable-* -> no-usable-project
else if either phase is conservative-fallback -> conservative-fallback
else if either phase is adapted -> adapted
else -> deterministic
```

Signal ladder rows to preserve:

| Inputs | Project behavior |
| --- | --- |
| no input, no intent, no base profile, and no cover image | fail as `too-low-signal` |
| `--base-profile` only | deterministic project snapshot from the base profile and renderer defaults |
| `--cover-image` only | deterministic default profile plus `cover-media-layered` template with copied asset |
| `--base-profile` plus `--cover-image`, with no input or intent | deterministic project snapshot from the base profile plus `cover-media-layered` template |
| `--base-profile` plus Markdown input and/or `--intent` | profile Codex may adapt from the base profile; template Codex only when template-owned directions are present |
| `--cover-image` plus Markdown input and/or `--intent` | profile Codex may adapt render policy; template phase uses media-capable layered output and escalates only for template-owned directions |
| Markdown input and/or `--intent` without base profile or cover image | profile Codex decision; template Codex only when template-owned directions are present |
| `--base-profile` plus `--cover-image` plus Markdown input and/or `--intent` | profile Codex may adapt from the base profile; template Codex only for template-owned or unmatched profile directions |

## Implementation Phases

### Phase 1: Profile-Codex Service Extraction

- [x] Create `src/cli/markdown-pdf/profile-codex/` for reusable profile helper
      internals.
- [x] Move profile command-state normalization, signal collection, candidate
      construction, Codex decision handling, report shaping, output planning,
      and write behavior behind service functions.
- [x] Extract profile signal-mode classification into a reusable module instead
      of leaving it action-local.
- [x] Extract synthesis-without-write support so project orchestration can
      validate an in-memory profile result before any project artifact is
      written.
- [x] Keep existing `md pdf-profile codex` behavior unchanged by routing the
      action through the extracted service.
- [x] Preserve profile signal modes, deterministic fallback behavior, report
      format, source/sink collision checks, and progress feedback.
- [x] Add or adjust focused tests proving the extraction is behavior-preserving.

Recommended module targets:

- `src/cli/markdown-pdf/profile-codex/options.ts`
- `src/cli/markdown-pdf/profile-codex/signals.ts`
- `src/cli/markdown-pdf/profile-codex/signal-mode.ts`
- `src/cli/markdown-pdf/profile-codex/synthesis.ts`
- `src/cli/markdown-pdf/profile-codex/output-plan.ts`
- `src/cli/markdown-pdf/profile-codex/report.ts`
- `src/cli/markdown-pdf/profile-codex/write-profile.ts`
- `src/cli/markdown-pdf/profile-codex/index.ts`

Job record:

- [Markdown PDF project Codex phase 1 profile service extraction](jobs/2026-07-04-markdown-pdf-project-codex-phase-1-profile-service-extraction.md)

### Phase 2: Project Command Surface And Shared Types

- [x] Register `md pdf-project codex` under the Markdown command tree.
- [x] Add project CLI option types and normalized command-state types.
- [x] Support positional `[input]` and `-i, --input <path>` aliasing.
- [x] Add `--intent`, repeatable `--font-hint`, `--base-profile`,
      `--cover-image`, `--output`, `--dry-run`, `--keep-codex-report`,
      `--codex-report-output`, and `--overwrite`.
- [x] Reject conflicting positional and `--input` paths before signal
      collection.
- [x] Reject public recipe flags as unknown options.
- [x] Add project signal-mode, decision-mode, identity, phase-summary, and
      report types.
- [x] Keep `src/cli/actions/markdown/pdf-project-codex.ts` thin by importing
      project-Codex orchestration helpers from `project-codex/index.ts`.
- [x] Add CLI help and command-wiring tests.

Recommended module targets:

- `src/cli/actions/markdown/pdf-project-codex.ts`
- `src/cli/markdown-pdf/project-codex/types.ts`
- `src/cli/markdown-pdf/project-codex/options.ts`
- `src/cli/markdown-pdf/project-codex/index.ts`

Job record:

- [Markdown PDF project Codex phase 2 command surface](jobs/2026-07-04-markdown-pdf-project-codex-phase-2-command-surface.md)

### Phase 3: Project Output Planning And Collision Checks

- [x] Generate shared timestamp/UID identity values for `projectBundleId`,
      `profile.id`, and `templateBundleId`.
- [x] Resolve explicit `--output <directory>` exactly as provided.
- [x] Derive default project directories from `projectBundleId` only after
      signal classification succeeds.
- [x] Plan fixed project outputs for `profile.yml`, `template.html`,
      `style.css`, optional `assets/`, and optional
      `project.codex-report.json`.
- [x] Enforce non-empty output directory failure unless `--overwrite` is
      supplied.
- [x] Make `--overwrite` apply to the project-owned output set, not to
      user-supplied inputs.
- [x] Reject source/sink collisions across input Markdown, base profile, cover
      image, project output directory, generated files, managed asset targets,
      and explicit report output.
- [x] Add tests for generated output naming, explicit output, bounded retries,
      overwrite behavior, unrelated-file preservation, and collision failures.

Recommended module targets:

- `src/cli/markdown-pdf/project-codex/identity.ts`
- `src/cli/markdown-pdf/project-codex/output-plan.ts`
- `src/cli/markdown-pdf/project-codex/path-collisions.ts`

Job record:

- [Markdown PDF project Codex phase 3 output planning and collision checks](jobs/2026-07-04-markdown-pdf-project-codex-phase-3-output-planning.md)

### Phase 4: Project Signal Collection And Classification

- [x] Collect shared document, intent, font-hint, base-profile, and cover-image
      signals once.
- [x] Reuse profile-Codex document and font signal collectors.
- [x] Reuse template-Codex base-profile, recipe, and cover-image signal logic
      where possible.
- [x] Classify no-signal input as `too-low-signal`.
- [x] Classify base-profile-only, cover-image-only, and
      base-profile-plus-cover-image paths as deterministic project requests.
- [x] Classify Markdown input, intent, font hints, or unmatched
      template-backed profile directions as Codex-assisted when they require
      Codex in either phase.
- [x] Preserve phase-native signal modes in project summaries and reports.
- [x] Add tests for each signal-ladder row from the research.

Recommended module targets:

- `src/cli/markdown-pdf/project-codex/signals.ts`
- `src/cli/markdown-pdf/project-codex/signal-mode.ts`

Job record:

- [Markdown PDF project Codex phase 4 signal classification](jobs/2026-07-04-markdown-pdf-project-codex-phase-4-signal-classification.md)

### Phase 5: Profile Phase Orchestration

- [x] Run the extracted profile service first.
- [x] Force project output to `profile.yml` while preserving the generated
      `profile.id`.
- [x] Support deterministic profile output for base-profile-only and
      cover-image-only project requests.
- [x] For cover-image-only requests, materialize the same deterministic default
      profile path used by profile-Codex `basic-default`; the cover image
      remains a template-phase signal.
- [x] Support Codex-assisted profile adaptation for Markdown input, intent,
      font hints, and base-profile-plus-target-signal requests.
- [x] Preserve unmatched template directions for the template phase.
- [x] Use phase-aware progress text when invoking profile Codex from the project
      command.
- [x] Validate the final profile before passing it to template synthesis.
- [x] Avoid writing `profile.yml` until the template phase and project
      validation have also succeeded.
- [x] Add tests for deterministic and Codex-assisted profile phase results,
      unmatched-direction forwarding, and no partial profile writes.

Recommended module targets:

- `src/cli/markdown-pdf/project-codex/profile-phase.ts`

Job record:

- [Markdown PDF project Codex phase 5 profile orchestration](jobs/2026-07-04-markdown-pdf-project-codex-phase-5-profile-orchestration.md)

### Phase 6: Template Phase Orchestration

- [x] Run the template phase second with the final profile as the compatibility
      target.
- [x] Use the project output plan for `templateBundleId`, `template.html`,
      `style.css`, managed assets, and report behavior.
- [x] Select `document-layered` when no managed cover image is present.
- [x] Select `cover-media-layered` when `--cover-image` is present.
- [x] Skip template Codex when deterministic project inputs are sufficient.
- [x] Call template Codex only for template-owned directions, forwarded
      unmatched profile directions, or document/intent signals that specifically
      affect template-owned layout such as tables, cover composition, brand
      styling, or custom HTML/CSS.
- [x] Do not escalate the template phase merely because shared Markdown input
      made the profile phase `document-informed`.
- [x] Use phase-aware progress text when invoking template Codex from the
      project command.
- [x] Keep local cover image copying inside the project `assets/` directory.
- [x] Avoid writing template files or copying assets until project validation
      passes.
- [x] Add tests for base-profile-only, cover-image-only, combined deterministic,
      profile-assisted plus deterministic-template, and template-assisted paths.

Recommended module targets:

- `src/cli/markdown-pdf/project-codex/template-phase.ts`

Job record:

- [Markdown PDF project Codex phase 6 template orchestration](jobs/2026-07-04-markdown-pdf-project-codex-phase-6-template-orchestration.md)

### Phase 7: Project Validation And Render Compatibility

- [x] Validate `profile.yml` with existing Markdown PDF profile validation.
- [x] Validate generated template placeholders and later-render hooks.
- [x] Validate CSS for unsafe URLs, absolute local source paths, and
      profile-hook breakage.
- [x] Validate copied assets and report paths stay within allowed boundaries.
- [x] Validate the follow-up `md to-pdf --profile --template --css` command is
      well formed.
- [x] Assert that template/CSS decisions do not silently defeat profile-owned
      ToC, page number, font, title, cover, or Shiki hooks.
- [x] Treat unrecoverable phase or compatibility failures as
      `no-usable-project`.
- [x] Add tests for hard validation failures, fallback-compatible reductions,
      no-usable-project reports, and render-command compatibility.
- [x] Run live direct `md pdf-profile codex` smoke with
      `examples/playground/md-pdf/cjk-font-smoke.md` to verify multilingual
      font signals through real Codex.
- [x] Run live direct `md pdf-template codex` smoke with
      `examples/playground/md-pdf/tool-cover-smoke.md` and
      `examples/playground/md-pdf/assets/tool-cover-sample.jpg` to verify cover
      image behavior through real Codex.
- [x] Run live `md pdf-project codex --dry-run` smoke for the multilingual/font
      and cover-image paths so project orchestration is checked against real
      Codex helper behavior before write smoke.
- [x] Record live-smoke evidence separately from injected-runner smoke and keep
      manual outputs under `examples/playground/md-pdf/smoke/`.
- [x] Re-run the Phase 7 live-smoke matrix with the current Markdown PDF Codex
      timeout defaults as the baseline for timeout review.
- [x] Temporarily rebuild with only the Markdown PDF profile/template Codex
      timeout constants set back to 30s, rerun the same Phase 7 live-smoke
      matrix, then keep the committed timeout value aligned with the smoke
      result before any commit.
- [x] Update the Phase 7 record to state whether the corrected direct
      read-only runner still passes at 30s, or whether 120s is required by
      controlled smoke evidence.

Recommended module targets:

- `src/cli/markdown-pdf/project-codex/validate-project.ts`
- `src/cli/markdown-pdf/project-codex/render-command.ts`

Job record:

- [Markdown PDF project Codex phase 7 validation and render compatibility](jobs/2026-07-04-markdown-pdf-project-codex-phase-7-validation-render-compatibility.md)

### Phase 8: Report, Summary, Writes, And Dry Run

- [x] Define the `markdown-pdf-codex-project-report` JSON artifact.
- [x] Mark project reports as `advisoryOnly: true`, matching the direct profile
      and template report posture.
- [x] Record project, profile, and template identities.
- [x] Record project-relative artifact paths.
- [x] Record input summaries, intent, font hints, cover-image metadata, phase
      signal modes, phase decision modes, final project decision mode,
      unsupported directions, fallback reasons, validation results, and
      follow-up render command arguments.
- [x] Use `<input.md>` and `<output.pdf>` placeholders when no Markdown input is
      available.
- [x] Keep persisted reports privacy-safe by default.
- [x] Validate requested report writes before normal bundle artifact writes so
      report failures do not leave partial project bundles.
- [x] Write requested reports only after successful normal bundle writes so
      stale reports cannot describe a bundle that failed while writing.
- [x] Print a concise CLI summary with project signal mode, final decision mode,
      output directory, artifacts, report path when written, and follow-up
      render command.
- [x] Implement normal writes only after both phases and project validation
      succeed.
- [x] Implement dry-run behavior with report-only writes when explicitly
      requested.
- [x] Add report schema, redaction, summary, dry-run, and no-partial-write
      tests.
- [x] Add review follow-up tests for persisted replay display, direct profile
      no-usable reports, direct template default runner behavior, symlinked
      managed assets, and stale-report prevention after bundle write failures.
- [x] Run live `md pdf-project codex` write smoke for multilingual/font project
      output.
- [x] Run live `md pdf-project codex` write smoke for cover-image project
      output.
- [x] Run live combined `md pdf-project codex` write smoke with multilingual
      content, cover image, and page-number intent.
- [x] Run at least one manual `md to-pdf` render from the combined project
      bundle for visual inspection without adding it to the regular test suite.
- [x] Record sanitized live-smoke evidence and cleanup expectations for
      `examples/playground/md-pdf/smoke/`.
- [x] Re-run the Phase 8 project write-smoke matrix with the committed 30s
      Markdown PDF Codex timeout defaults.
- [x] If any Phase 8 write smoke fails from a real timeout, temporarily compare
      the same write-smoke matrix against 120s before changing the default.
- [x] Update the Phase 8 record with sanitized timeout-review evidence, including
      whether the earlier timeout hypothesis was confirmed or rejected.

Recommended module targets:

- `src/cli/markdown-pdf/project-codex/report.ts`
- `src/cli/markdown-pdf/project-codex/summary.ts`
- `src/cli/markdown-pdf/project-codex/write-project.ts`

Job record:

- [Markdown PDF project Codex phase 8 report, summary, writes, and dry run](jobs/2026-07-04-markdown-pdf-project-codex-phase-8-report-summary-writes-dry-run.md)

### Phase 9: Integration Coverage And Render Compatibility

- [ ] Add action-level tests for deterministic project paths.
- [ ] Add action-level tests for Codex-assisted project paths with stubbed
      runners.
- [ ] Add command tests for help output and unsupported recipe flags.
- [ ] Add render-compatibility tests proving generated project outputs can feed
      `md to-pdf --profile --template --css`.
- [ ] Add failure-path tests for invalid base profiles, invalid cover images,
      output/report collisions, and no-usable-project results.
- [ ] Run focused tests first, then repo gates.

Focused validation target:

```bash
bun test test/cli-actions-md-to-pdf-project-codex/*.test.ts test/cli-actions-md-to-pdf-commands.test.ts
```

Repo gates:

```bash
bun run lint
bun run format:check
bun run build
bun test
git diff --check
```

### Phase 10: Docs Validation And Closeout

This phase is the final documentation guardrail. It should run only after the
project helper behavior is implemented and Phase 9 verification evidence exists.

- [ ] Add `docs/guides/markdown-pdf-codex-project-helper.md` for the shipped
      project helper contract.
- [ ] Update `docs/guides/markdown-pdf-usage.md` to document shipped project
      helper behavior and link the dedicated guide.
- [ ] Update `README.md` guide links and release-boundary wording for
      `v0.1.5-canary.4`.
- [ ] Link all focused implementation job records from this plan.
- [ ] Update related research status only after implementation evidence and job
      records are linked.
- [ ] Confirm public docs do not contain raw local paths, private URLs, stale
      planned-behavior wording, or unsupported command examples.
- [ ] Run a docs-review pass over the plan, research, and guide updates.
- [ ] Record final verification commands and any environment limits in the
      closeout job record.
- [ ] Move this plan to `completed` only after the docs-review and final gates
      are recorded.

## Job Records

Create focused job records under `docs/plans/jobs/` as implementation phases
land. Expected records:

- Phase 1 profile service extraction.
- Phase 2 command surface.
- Phase 3 output planning and collision checks.
- Phase 4 signal classification.
- Phase 5 profile phase orchestration.
- [Markdown PDF project Codex phase 6 template orchestration](jobs/2026-07-04-markdown-pdf-project-codex-phase-6-template-orchestration.md)
- [Markdown PDF project Codex phase 7 validation and render compatibility](jobs/2026-07-04-markdown-pdf-project-codex-phase-7-validation-render-compatibility.md)
- [Markdown PDF project Codex phase 8 report, summary, writes, and dry run](jobs/2026-07-04-markdown-pdf-project-codex-phase-8-report-summary-writes-dry-run.md)
- Phase 9 integration coverage and render compatibility.
- Phase 10 docs validation and plan completion.

Keep this top-level plan in `draft` until Phase 1 starts. Move it to `active`
when implementation begins, and to `completed` only after Phase 10 evidence and
job records are linked.

## Related Research

- [Markdown PDF Project Codex Helper](../researches/research-2026-07-03-markdown-pdf-project-codex-helper.md)
- [Markdown PDF Codex Helper Roadmap](../researches/research-2026-06-10-markdown-pdf-codex-profile-and-interactive-flow.md)
- [Markdown PDF Template Codex Helper](../researches/research-2026-06-18-markdown-pdf-template-codex-helper.md)

## Related Plans

- [Markdown PDF Codex profile helper implementation](plan-2026-06-15-markdown-pdf-codex-profile-helper.md)
- [Markdown PDF template Codex helper implementation](plan-2026-06-23-markdown-pdf-template-codex-helper.md)
