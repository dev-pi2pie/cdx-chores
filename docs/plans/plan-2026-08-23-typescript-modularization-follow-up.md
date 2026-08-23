---
title: "TypeScript Modularization Follow-Up Implementation"
created-date: 2026-08-23
status: active
agent: codex
---

## Goal

Apply the accepted recommendations from the TypeScript modularization
follow-up research through small, behavior-preserving source and test splits.
The work should reduce mixed responsibility while preserving CLI behavior,
public imports, diagnostics, prompts, artifacts, and Node.js runtime
compatibility.

## Planning Boundary

This plan is `active`. Phase 1 began from a clean focused-test baseline; later
phases remain gated on reviewed completion of the preceding phase.

The strict research inventory found 59 source files and 75 test files above 300
lines. Those counts identify review candidates, not defects or completion
targets. This plan includes only the boundaries accepted by the related
research and retains its explicit deferrals.

## Related Research

- `docs/researches/research-2026-08-23-typescript-modularization-follow-up.md`

## Related Plans

- `docs/plans/plan-2026-05-09-typescript-size-refactor-implementation.md`
- `docs/plans/plan-2026-08-12-markdown-pdf-page-number-configuration.md`

## Scope

In scope:

- split seven large tests by behavioral ownership
- split Template asset policy and local rewriting behind the current facade
- extract rename Codex option and timeout ownership from command registration
- split Doctor workflow projection by domain behind the current public function
- reassess Interactive Markdown `to-pdf` after the safer work and split it only
  if the research boundary remains valid
- complete cumulative validation, inventory, import, test-layout, and
  documentation review

Out of scope:

- behavior, prompt, diagnostic, output, or artifact-schema changes
- dependency or runtime-support changes
- broad barrels, cross-feature helper layers, or a general test-helper dumping
  ground
- splitting every file above 300 lines
- reopening the cohesive boundaries deferred by the research and August Phase
  13 review

## Implementation Rules

- Move one feature boundary per phase.
- Preserve existing public function names and caller import paths through small
  facades.
- Keep extracted internals private to their owning feature; do not introduce
  accidental deep imports.
- Preserve test names and assertions where practical. Test-only phases must not
  change production behavior.
- Extract shared test setup only when it expresses stable feature ownership.
- Record a defect discovered during movement as separate work unless it blocks
  safe completion of the phase.
- Run the phase's focused tests and review its exact diff before starting the
  next production slice.
- Capture one committed implementation `base..tip` range per phase. If a review
  fix lands, widen the tip and review the complete range again.
- Update the unified job section and plan checklist only after focused
  validation and exact-range review pass.
- Keep production modules compatible with Node.js; do not introduce Bun-only
  runtime APIs.

## Execution Record Strategy

Use one plan-level execution record for the complete rollout:

```text
docs/plans/jobs/YYYY-MM-DD-typescript-modularization-follow-up.md
```

Create it when Phase 1 begins, using that execution date, and keep it
`in-progress` through the rollout. Give every executed phase a concise section
that states the moved or assessed boundary, observable contracts, focused
validation results, exact review range, accepted constraints, and the decision
to continue, constrain, or stop.

Each phase section should include a compact before/after table covering file
topology, responsibility, focused-test evidence, and public imports or
production-diff scope where applicable. Line count is evidence, not a success
criterion.

The Phase 11 section is required even when its decision gate defers the
Interactive `to-pdf` split. Complete the unified record only after Phase 12
records cumulative validation and lifecycle closeout. Create a separate job
record only if discovered work materially leaves this plan's scope.

## Phase Checklist

### Phase 1: Split The Profile Codex Action Test

Tasks:

- [x] Split `test/cli-actions-md-to-pdf-profile-codex-action.test.ts` into
      feature-local suites for request/progress, output and dry-run, signals and
      bases, reports and failures, and path/alias safety.
- [x] Preserve test names, assertions, setup ordering, and mocked request
      behavior.
- [x] Keep shared fixtures local to the Profile Codex action boundary.
- [x] Confirm no automation or documentation depends on the removed test path.

Observable contracts:

- request sequencing and progress reporting are unchanged
- dry-run and written output behavior remain equivalent
- signal, base, failure, path, and alias safety coverage is retained

Focused validation:

```bash
bun test test/cli-actions-md-to-pdf-profile-codex-action test/cli-actions-md-to-pdf-profile-codex-command-wiring.test.ts test/cli-actions-md-to-pdf-profile-codex-helpers.test.ts test/cli-actions-md-to-pdf-profile-codex-prepared.test.ts
```

### Phase 2: Split Template Asset Handling

Tasks:

- [ ] Keep `src/cli/markdown-pdf/template-assets.ts` as the public facade.
- [ ] Extract shared reference, URL, path, and `srcset` classification into
      `src/cli/markdown-pdf/template-assets/reference.ts`.
- [ ] Extract remote detection and rejection into
      `src/cli/markdown-pdf/template-assets/remote-policy.ts`.
- [ ] Extract local resolution and file-URL rewriting into
      `src/cli/markdown-pdf/template-assets/local-rewrite.ts`.
- [ ] Preserve `rejectRemoteMarkdownPdfAssetsWhenDisabled` and
      `rewriteMarkdownPdfTemplateLocalAssets` at the current import path.
- [ ] Review the exact Phase 2 implementation range for Template reference
      classification, remote rejection, and local rewriting security risks;
      do not expand it into a whole-repository scan.

Observable contracts:

- CSS, HTML, inline-style, `srcset`, and recursive `@import` scanning retain
  their current acceptance and rejection behavior
- local Template asset paths resolve and rewrite identically
- `render.ts` continues to import only the facade

Focused validation:

```bash
bun test test/cli-actions-md-to-pdf-actions-assets.test.ts test/cli-actions-md-to-pdf-actions.test.ts test/cli-actions-md-to-pdf-bundle.test.ts test/cli-actions-md-to-pdf-options.test.ts test/cli-actions-md-to-pdf-prepared-render.test.ts
bunx tsc --noEmit
```

### Phase 3: Split The Project Action-Write Test

Tasks:

- [ ] Split
      `test/cli-actions-md-to-pdf-project-codex/action-write.test.ts` into
      review and dry-run, privacy and redaction, successful writes, asset
      safety, and write-prevention suites.
- [ ] Preserve failure timing, filesystem assertions, redaction checks, and
      partial-write prevention coverage.
- [ ] Keep fixtures inside the Project Codex action-write boundary unless an
      existing feature fixture already owns them.

Observable contracts:

- review, dry-run, privacy, redaction, write, and asset-safety assertions remain
  equivalent
- unusable or partial results still cannot produce unsafe writes

Focused validation:

```bash
bun test test/cli-actions-md-to-pdf-project-codex/action-write test/cli-actions-md-to-pdf-project-codex/command-state.test.ts test/cli-actions-md-to-pdf-project-codex/output-plan.test.ts test/cli-actions-md-to-pdf-project-codex/prepared.test.ts test/cli-actions-md-to-pdf-project-codex/validation.test.ts
```

### Phase 4: Extract Rename Codex Option Ownership

Tasks:

- [ ] Extract Codex option registration, scoped timeout resolution, and legacy
      migration notices from `src/cli/commands/rename.ts` into focused modules
      under `src/cli/commands/rename/`.
- [ ] Keep command registration and action wiring in `rename.ts`.
- [ ] Preserve `registerRenameCommands` and all current caller imports.
- [ ] Do not split every rename subcommand or change the settled timeout
      contract.

Observable contracts:

- rename file, batch, and compatibility-alias options remain in parity
- timeout precedence, validation, migration notices, retry ownership, help
  text, and exit behavior remain unchanged

Focused validation:

```bash
bun test test/cli-command-rename-timeout.test.ts test/cli-actions-rename-file.test.ts test/cli-actions-rename-batch-codex-auto.test.ts test/cli-actions-rename-batch-codex-docs.test.ts test/cli-actions-rename-batch-codex-images.test.ts
bunx tsc --noEmit
```

### Phase 5: Split Doctor Workflow Projection

Tasks:

- [ ] Keep the public types, constants, and `projectDoctorWorkflows` available
      from `src/cli/doctor/workflow.ts`.
- [ ] Extract the shared projection model and kernel from Markdown, video,
      data, extension, and font domain projectors under
      `src/cli/doctor/workflow/`.
- [ ] Preserve projection ordering and avoid parsing rendered output.
- [ ] Do not change probes, public messages, JSON, or exit behavior.

Observable contracts:

- workflow, condition, and action IDs and order remain stable
- state derivation, issue counting, action deduplication, and sanitization
  remain equivalent
- compact, detailed, and JSON surfaces retain their current behavior

Focused validation:

```bash
bun test test/cli-doctor-workflow.test.ts test/cli-action-doctor.test.ts test/cli-actions-doctor-markdown-video-deferred.test.ts test/cli-command-doctor.test.ts
bunx tsc --noEmit
```

### Phase 6: Split The Interactive Codex Authoring Test

Tasks:

- [ ] Split
      `test/cli-interactive-markdown-pdf/codex-authoring.test.ts` into entry and
      setup, font-hint editing, regeneration, Project handoff, and output and
      recovery lifecycle suites.
- [ ] Preserve prompt order, mock lifecycle, cancellation, backtracking, and
      durable-versus-temporary artifact assertions.
- [ ] Keep Interactive fixtures within the existing Markdown PDF harness.

Observable contracts:

- authoring entry, regeneration, handoff, output, and recovery coverage remains
  equivalent
- no prompt or production behavior changes occur in this test-only phase

Focused validation:

```bash
bun test test/cli-interactive-markdown-pdf/codex-authoring test/cli-interactive-markdown-pdf/handoff.test.ts test/cli-interactive-markdown-pdf/lifecycle.test.ts test/cli-interactive-markdown-pdf/materialization.test.ts
```

### Phase 7: Split The Template Synthesis Test

Tasks:

- [ ] Split
      `test/cli-actions-md-to-pdf-template-codex/template-synthesis.test.ts`
      into document and title structure, font ownership, cover layout, and ToC
      and CSS branch suites.
- [ ] Preserve synthesis fixtures, decision inputs, generated structure, and
      CSS assertions.
- [ ] Avoid moving feature fixtures into a repository-wide helper.

Observable contracts:

- document, title, font, cover, ToC, and CSS synthesis coverage remains
  equivalent
- the phase changes test ownership only

Focused validation:

```bash
bun test test/cli-actions-md-to-pdf-template-codex/template-synthesis test/cli-actions-md-to-pdf-template-codex/action-integration.test.ts test/cli-actions-md-to-pdf-template-codex/families.test.ts test/cli-actions-md-to-pdf-template-codex/font-ownership.test.ts
```

### Phase 8: Split The Profile Adapter Test

Tasks:

- [ ] Split `test/adapters-codex-markdown-pdf-profile.test.ts` into prompt and
      schema, runner behavior, patch application, and fallback and failure
      classification suites.
- [ ] Preserve request payload, parsing, timeout, abort, patch, and failure
      assertions.
- [ ] Keep adapter-specific fixtures with the Profile adapter suites.

Observable contracts:

- adapter prompts, schemas, runner behavior, patches, fallback, and failure
  classification remain fully covered
- no adapter or action behavior changes occur

Focused validation:

```bash
bun test test/adapters-codex-markdown-pdf-profile test/cli-actions-md-to-pdf-profile-codex-action test/cli-actions-md-to-pdf-profile-codex-helpers.test.ts
```

### Phase 9: Split The Template Adapter Test

Tasks:

- [ ] Split `test/adapters-codex-markdown-pdf-template.test.ts` into prompt and
      schema, decision parsing, repair and timeout, CSS safety, and failure
      classification suites.
- [ ] Preserve repair limits, timeout/abort behavior, malformed response
      handling, and CSS safety assertions.
- [ ] Keep adapter-specific fixtures with the Template adapter suites.

Observable contracts:

- prompt, schema, decision, repair, timeout, CSS safety, and failure contracts
  retain equivalent coverage
- no adapter or action behavior changes occur

Focused validation:

```bash
bun test test/adapters-codex-markdown-pdf-template test/cli-actions-md-to-pdf-template-codex/action.test.ts test/cli-actions-md-to-pdf-template-codex/action-integration.test.ts
```

### Phase 10: Split The Markdown PDF Command-Surface Test

Tasks:

- [ ] Split `test/cli-actions-md-to-pdf-commands.test.ts` into direct render,
      Profile, Template, and Project command-surface suites.
- [ ] Preserve help, option routing, validation, action selection, and exit
      assertions.
- [ ] Keep cross-surface smoke coverage only where it verifies shared command
      registration.

Observable contracts:

- every current direct-render, Profile, Template, and Project command assertion
  remains owned by one focused suite
- command registration and public CLI behavior remain unchanged

Focused validation:

```bash
bun test test/cli-actions-md-to-pdf-commands test/cli-actions-md-to-pdf-command-wiring.test.ts test/cli-actions-md-to-pdf-options.test.ts
```

### Phase 11: Reassess Interactive Markdown `to-pdf`

Decision gate:

- [ ] Reinspect `src/cli/interactive/markdown/to-pdf.ts` after Phases 1 through
      10 using the research criteria and the now-focused Interactive tests.
- [ ] Record whether source preparation, prepared-render handling, and output
      review remain independently owned responsibilities.
- [ ] Execute and record one accepted outcome: defer the split with no
      production edit when the boundary is no longer clear, or extract those
      responsibilities under `src/cli/interactive/markdown/to-pdf/` while
      retaining cancellation and backtracking orchestration plus both current
      exports in `to-pdf.ts`.

Observable contracts if the split proceeds:

- prompt order, cancellation, backtracking, regeneration, handoff, source
  preparation, render choice, and artifact lifecycle remain equivalent
- `handleMarkdownPdfToPdfInteractiveAction` and
  `runMarkdownPdfToPdfInteractiveFlow` remain available at the current path

Acceptance evidence if the split is deferred:

- the focused Interactive suite passes against the unchanged production code
- current exports and caller imports remain unchanged
- the phase contains no production diff
- the job record states the evidence and rationale for the deferral

Focused validation:

```bash
bun test test/cli-interactive-markdown-pdf
bunx tsc --noEmit
```

### Phase 12: Cumulative Validation And Documentation Closeout

Tasks:

- [ ] Run every focused suite associated with moved source and test boundaries.
- [ ] Run the complete Bun test suite.
- [ ] Run TypeScript checking, lint, formatting, build, and diff checks.
- [ ] Repeat the strict over-300-line inventory and record every remaining
      intentional deferral without treating the threshold as a defect rule.
- [ ] Review public imports and repository callers for accidental deep imports.
- [ ] Review the resulting test layout for duplicated fixtures, scattered
      ownership, and obsolete compatibility loaders.
- [ ] Update this checklist and every phase section in the unified job record
      from actual evidence.
- [ ] Update the research status only if its own policy-defined evidence bar is
      satisfied.
- [ ] Review guides, research, plans, and the job record for stale paths,
      responsibility claims, and missing traceability.
- [ ] Review the complete refactor range before marking this plan completed.

Closeout validation:

```bash
bun test
bunx tsc --noEmit
bun run lint
bun run format:check
bun run build
git diff --check
```

## Completion Criteria

This plan may be marked `completed` only when:

- the unified job record contains a completed evidence receipt for every
  executed phase, including a gate that defers implementation
- every moved public boundary retains its names and caller import paths
- focused and cumulative validation pass
- the final inventory and remaining deferrals are recorded explicitly
- the import, test-layout, documentation, and whole-range reviews are complete

The final inventory may still contain files over 300 lines. Completion depends
on responsibility and validation evidence, not a zero-count target.
