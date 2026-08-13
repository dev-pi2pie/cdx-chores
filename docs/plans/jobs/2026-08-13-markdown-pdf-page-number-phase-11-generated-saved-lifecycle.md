---
title: "Markdown PDF page-number Phase 11 generated and saved-recipe lifecycle"
created-date: 2026-08-13
status: in-progress
agent: codex
plan: ../plan-2026-08-12-markdown-pdf-page-number-configuration.md
---

## Goal

Extend the shared one-render page-number choice through generated Profile,
Template, and Project candidates and through saved-recipe `to-pdf` handoff.
Reuse the existing generated lifecycle, CLI-owned temporary session, durable
save, cleanup, and recovery behavior without adding another temporary helper or
manual smoke workspace.

Phase 11 owns lifecycle orchestration and deterministic verification. Phase 12
retains cross-version renderer execution, PDF extraction, visual inspection,
and layout acceptance.

## Starting Boundary

- Starting commit: `824ce4e6`, the Phase 11 and Phase 12 verification-wording
  refinement after the Phase 10 documentation closeout.
- The working tree was clean when Phase 11 was activated.
- The exact Phase 11 review base is `824ce4e6`. The final implementation tip
  will be the last implementation, test, or accepted-review correction commit;
  the documentation-only closeout will follow that reviewed range.
- The lifecycle audit confirmed the production and test boundary below.
  Overlapping generated lifecycle ownership stays sequential.

## Lifecycle Contract

- Collect the page-number choice after the existing one-render
  code-highlighting choice and before report/output collection,
  materialization, or authoritative renderer preparation.
- For saved-recipe handoff, collect the choice after Markdown input and
  code-highlighting selection and before authoritative preparation.
- An accepted candidate's normalized Profile or normalized default may preview
  the reusable setting before materialization. After temporary materialization
  or durable save, reload the actual artifact and use its normalized contained
  Profile when present.
- Profile-less Template output uses the normalized default or its separately
  selected Profile; it does not acquire invented durable Profile state.
- A generated Project resolves page-number state from the final contained
  Profile only after both Project phases finish and the candidate is accepted.
- A saved or existing Project with changed contained Profile identity or
  content is a new render context. Resolve it once, show the current setting,
  and reset the transient choice to `Use recipe setting`.
- Stale, missing, ambiguous, or invalid contained Profile state fails closed
  without mutating the saved Project.
- Preserve the one-render choice while revisiting outputs, final review,
  recovery, or the same accepted generated candidate. Reset it when Markdown
  input, recipe source, artifact, preparation mode, generated candidate
  identity, or contained Profile identity changes.
- Changing only the page-number choice may repeat deterministic renderer
  preparation. It must not regenerate accepted artifacts, repeat a Codex
  request, repeat either Project Codex phase, rematerialize an unchanged
  recipe, or rewrite a successfully saved recipe.

## Temporary And Durable Ownership

- Back or Cancel before session creation produces no materialization, report,
  render, or output write.
- Temporary rendering reuses the existing CLI-owned OS-temporary recipe
  session. Successful rendering removes that exact owned session.
- Materialization, preparation, rendering, or cleanup failure uses the existing
  retry, review, keep, and confirmed-delete recovery behavior. Cleanup failure
  retains the session and reports it through the established path.
- Durable or pre-existing recipes are never automatically removed.
- Phase 11 adds no second cleanup mechanism, playground smoke, or live Codex or
  renderer requirement. Deterministic seams must prove exact-session cleanup,
  retained-failure behavior, durable preservation, and zero-write paths.

## File Boundary

Production paths:

- `src/cli/interactive/markdown/authoring.ts`
- `src/cli/interactive/markdown/codex-authoring.ts`
- `src/cli/interactive/markdown/codex-types.ts`
- `src/cli/interactive/markdown/generated-lifecycle.ts`
- `src/cli/interactive/markdown/generated-lifecycle/prompts.ts`
- `src/cli/interactive/markdown/generated-lifecycle/recovery.ts`
- `src/cli/interactive/markdown/to-pdf.ts`
- `src/cli/interactive/markdown/page-number-review.ts`
- `src/cli/interactive/markdown/render-page-numbers.ts`
- `src/cli/markdown-pdf/project-codex/project-bundle-completeness.ts` only if
  the known saved-Project preflight needs a narrow shared assertion export.

Focused test paths:

- `test/cli-interactive-markdown-pdf/lifecycle.test.ts`
- `test/cli-interactive-markdown-pdf/lifecycle-unit.test.ts`
- `test/cli-interactive-markdown-pdf/handoff.test.ts`
- `test/cli-interactive-markdown-pdf/materialization.test.ts`
- `test/cli-interactive-markdown-pdf/codex-authoring.test.ts`
- `test/cli-interactive-markdown-pdf/deterministic-authoring.test.ts`
- `test/cli-interactive-markdown-pdf/render-sources.test.ts`
- `test/cli-interactive-markdown-pdf/render-page-number-preparation.test.ts`
- `test/cli-interactive-markdown-pdf/page-number-review.test.ts`
- `test/cli-interactive-routing.helpers.ts`

## Implementation Checklist

- [x] Confirm the generated, saved-recipe, Project, materialization, and
      recovery seams before assigning file ownership.
- [ ] Add page-number choice and review state to deterministic and Codex
      generated Profile, Template, and Project lifecycles.
- [ ] Place the generated prompt after code highlighting and before report or
      output collection, materialization, and authoritative preparation.
- [ ] Reload temporary and durably saved artifacts before authoritative
      preparation, and resolve the actual normalized contained Profile.
- [ ] Add the saved-recipe handoff choice after Markdown input and code
      highlighting while preserving the preselected saved artifact.
- [ ] Treat changed contained Project Profile identity or content as a new
      render context and fail closed on invalid contained Profile state.
- [ ] Preserve same-context state through Back, output changes, final review,
      recovery, and unchanged-choice reuse; reset every contract-defined
      changed context.
- [ ] Prove page-number-only changes reprepare only the renderer and do not
      repeat Codex, Project phases, materialization, or durable writes.
- [ ] Reuse exact-session cleanup and existing recovery behavior for temporary
      materialization while preserving every durable or pre-existing recipe.
- [ ] Add focused deterministic coverage for every generated/saved lifecycle,
      navigation, reset, recovery, cleanup, and stale-state boundary in the
      parent Phase 11 checklist.

## Verification

Run the narrow affected tests during implementation. At the final committed
implementation tip, run and record the following gates.

Focused generated and saved-recipe lifecycle:

```bash
bun test test/cli-interactive-markdown-pdf/lifecycle.test.ts --timeout 30000
bun test test/cli-interactive-markdown-pdf/lifecycle-unit.test.ts --timeout 30000
bun test test/cli-interactive-markdown-pdf/handoff.test.ts --timeout 30000
bun test test/cli-interactive-markdown-pdf/materialization.test.ts --timeout 30000
bun test test/cli-interactive-markdown-pdf/render-sources.test.ts --timeout 30000
bun test test/cli-interactive-markdown-pdf/render-page-number-preparation.test.ts --timeout 30000
bun test test/cli-interactive-markdown-pdf/page-number-review.test.ts --timeout 30000
```

Broad Interactive and Markdown PDF regression gates:

```bash
bun test test/cli-interactive-markdown-pdf --timeout 30000
rg --files test | rg 'md-to-pdf|markdown-pdf|doctor-markdown' | xargs bun test --timeout 30000
```

Full repository and static gates:

```bash
bun test --timeout 30000
bunx tsc --noEmit
bun run lint
bun run format:check
bun run build
git diff --check
```

Record test and assertion counts where the runner reports them. Cleanup
evidence must state whether the exact owned session was removed, retained after
failure, or deleted only after confirmation, without recording resolved
machine-specific temporary paths.

## Manual Smoke Decision

No manual smoke is required for Phase 11. The phase changes orchestration at
existing deterministic seams, and its acceptance claims are limited to state,
write ordering, materialization reuse, exact-session cleanup, durable
preservation, and recovery behavior. Live Codex and renderer behavior add no
Phase 11 acceptance evidence; Phase 12 owns renderer execution and PDF
inspection.

## Commit, Review, And Checklist Discipline

- [x] Record `824ce4e6` as the clean Phase 11 starting boundary.
- [ ] Commit this activation job and parent link without checking implementation
      work; record that commit before implementation begins.
- [ ] Ask `@auto_commit_notification` at each coherent, validated
      implementation boundary and automatically commit meaningful progress.
- [ ] Record every implementation, test, or accepted-review correction commit
      in this job.
- [ ] Run focused gates while implementing and the focused, broad, full, and
      static gates at the final committed implementation tip.
- [ ] Review the exact `824ce4e6..<final-implementation-tip>` range with the
      maintainability and test-quality reviewers.
- [ ] Record every finding and disposition. Land accepted corrections in a
      separate commit, widen the exact range, rerun affected gates, and repeat
      both reviews.
- [ ] Update implementation checklist items only after their committed evidence
      exists; update aggregate validation and review items only at the final
      reviewed implementation tip.
- [ ] Record the manual-smoke omission rationale, cleanup evidence, commits,
      exact review range, validation counts, findings, and a
      Continue/Constrain/Stop verdict.
- [ ] Have the completed job and parent Phase 11 checklist reviewed by the
      documentation reviewer.
- [ ] Ask `@auto_commit_notification` at the reviewed documentation boundary
      and commit a documentation-only Phase 11 closeout before Phase 12.

No Codex Security scan or security plugin is part of Phase 11 verification.

## Evidence

- Activation boundary: `824ce4e6` with a clean working tree.
- Activation documentation commit: pending.
- Implementation commits: pending.
- Final implementation tip: pending.
- Exact reviewed range: pending.
- Focused, broad, full, and static validation: pending.
- Cleanup and zero-write evidence: pending.
- Maintainability and test-quality findings: pending.
- Documentation review: pending.
- Final verdict: pending.

## Related Research

- [Markdown PDF Page-Number Configuration](../../researches/research-2026-08-11-markdown-pdf-page-number-configuration.md)

## Related Plans

- [Markdown PDF page-number configuration implementation](../plan-2026-08-12-markdown-pdf-page-number-configuration.md)
