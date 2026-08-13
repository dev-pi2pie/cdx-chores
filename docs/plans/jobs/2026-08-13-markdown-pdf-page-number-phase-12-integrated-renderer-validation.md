---
title: "Markdown PDF page-number Phase 12 integrated renderer validation"
created-date: 2026-08-13
status: in-progress
agent: codex
plan: ../plan-2026-08-12-markdown-pdf-page-number-configuration.md
---

## Goal

Validate the integrated page-number contract with complete deterministic
orchestration coverage and a compact live WeasyPrint matrix. Phase 12 owns
renderer selection, PDF extraction, page-label inspection, representative
visual review, public-safe evidence, and temporary-laboratory cleanup. Guidance
and initiative lifecycle closeout remain Phase 13 work.

## Starting Boundary

- Starting commit and exact review base: `f2b0d81c`, the reviewed Phase 11
  documentation-only closeout.
- The worktree was clean before these activation docs began.
- The final implementation tip will be the last harness, fixture, test,
  evidence, or accepted-review correction commit. The documentation-only
  closeout follows the reviewed range.
- The activation job and parent link are the only uncommitted changes. No
  implementation or renderer evidence begins before their activation commit.

## Frozen Execution Contract

### Permanent boundary and ownership

Reuse the existing Phase 1 evidence seam:

- `test/fixtures/markdown-pdf/page-number-renderer-contract.ts`
- `test/fixtures/markdown-pdf/page-number-launch.md`
- `test/fixtures/markdown-pdf/page-number-launch-profile.yml`
- `scripts/spikes/markdown-pdf-page-number-renderer-evidence.ts`
- `test/markdown-pdf-page-number-renderer-evidence.test.ts`

The existing script remains the only live harness and guarded cleanup owner.
Extend only that catalog, harness, focused test, and existing product tests
needed by the matrix. Add no second spike, smoke or cleanup helper,
repository-root temporary directory, or `examples/playground/` workspace.
Production changes require a documented boundary-expansion review and their own
checkpoint.

Generated Projects, HTML, CSS, candidate environments, PDFs, PNGs, and raw
reports remain in the existing ownership-marked OS-temporary laboratory. Only
repository files above, focused existing tests, this job, and the parent plan
may become permanent Phase 12 changes.

### Candidates

Keep the Phase 1 contract fixed to WeasyPrint `65.1`, `68.0`, and `69.0`, each
with Pydyf `0.12.1` and FontTools `4.63.0`. Changing the candidate set requires
a documented expansion review.

### Automated matrix

Deterministic tests own the complete permutation space:

- old and new Profiles, omitted-field compatibility, and direct overrides
- built-in, Custom, generated, bundle, explicit-role, and saved-recipe sources
- Interactive inherit, enable, disable, retention, and reset behavior
- deterministic Projects with no base Profile and with an existing base
  Profile; one contained `profile.yml`; bundle/explicit equivalence
- Project validation, report boundaries, generated and legacy body hooks,
  missing hooks, unsupported capabilities, occupied slots, `{pages}`, and
  legacy inference
- Profile page chrome, Template CSS, user CSS, and body-hook ownership

This matrix uses existing fixtures and mocks, makes no live Codex request, and
does not require a GUI viewer or PDF byte equality.

### Compact live matrix

Use the existing renderer-contract and product scenarios rather than a
Cartesian run. Across the selected scenarios, cover each sequence origin,
visibility scope, arithmetic boundary, all six positions, typography and
separator endpoints, cover/ToC/body transition, portrait and landscape,
narrow margins, blank pages, repagination, occupied slots, `{pages}`, legacy
inference, body-hook cases, missing hooks, and unsupported diagnostics at least
once. Include the two deterministic Project variants and bundle/explicit
render equivalence without live Codex.

For every frozen candidate, select that renderer for `doctor --json`, run the
renderer-contract scenarios, and run at least one actual implemented
`md to-pdf` launch with the same renderer.

### PDF evidence

Extend the existing `pdfjs-dist` inspector to call
`PDFDocumentProxy.getPageLabels()` for each inspected PDF. The feature does not
author page-label metadata, so accepted fixtures must return `null`, meaning
the default physical labels `1..N`; any non-null result is a compatibility
mismatch until a documented review explains it. Add deterministic
inspector/report tests and record only a public-safe normalized
`default-physical`/`unexpected-custom` state per scenario.

Continue using `PDFDocumentProxy.numPages` as the physical page total. For
fixtures containing `{pages}`, assert that each extracted denominator equals
that total even when the logical `{page}` value uses body origin, zero start,
or a non-default increment. Inspect representative PNGs only inside the
temporary laboratory; durable records contain page count and dimensions,
extracted labels by physical page, and sanitized visual conclusions, not the
PNGs themselves. Extraction and visual review must agree on visibility,
sequence, placement, clipping, overlap, styling, and page transitions.

### Live attempt, evidence, and cleanup

After the activation commit and deterministic gates, make one documented
harness attempt:

```bash
bun scripts/spikes/markdown-pdf-page-number-renderer-evidence.ts run --live --keep --python <explicit-python-executable>
```

If any frozen candidate environment cannot be established in that attempt,
record the sanitized limitation and a **Constrain** verdict. Do not add setup
loops, another harness, or a playground workaround.

Record only repository-relative commands, public versions, sanitized outcome
classifications and warnings, candidate/scenario results, PDF facts, visual
conclusions, and cleanup state. Do not record local paths, executable paths,
environment names, activation commands, host fonts, raw reports, or
unsanitized errors.

After successful or resolved inspection, close the retained laboratory only
through its ownership-marker guard:

```bash
bun scripts/spikes/markdown-pdf-page-number-renderer-evidence.ts close --lab <retained-lab>
```

Retain failed or inconclusive evidence only locally while unresolved, then use
the same guarded command when it is resolved or abandoned.

## Checklist

- [ ] Commit this activation job and parent link before implementation or live
      evidence.
- [ ] Audit and, only where needed, extend the existing harness and focused
      tests for the frozen automated and live matrices.
- [ ] Prove the automated matrix, deterministic Project variants, and
      bundle/explicit equivalence.
- [ ] Make the single live attempt across `65.1`, `68.0`, and `69.0`.
- [ ] Record public-safe candidate, extraction, page-label, visual, and cleanup
      evidence plus a Continue or Constrain verdict.
- [ ] Close every successful or resolved owned laboratory with the guarded
      `close` command.

## Validation

```bash
bun test test/markdown-pdf-page-number-renderer-evidence.test.ts --timeout 30000
rg --files test | rg 'page-number|page-chrome|template-compatibility|project-codex|cli-interactive-markdown-pdf' | xargs bun test --timeout 30000
rg --files test | rg 'md-to-pdf|markdown-pdf|doctor-markdown' | xargs bun test --timeout 30000
bun test --timeout 30000
bunx tsc --noEmit
bun run lint
bun run format:check
bun run build
git diff --check
git diff --check f2b0d81c..<final-implementation-tip>
```

Record file, test, and assertion counts where available. Run narrow affected
tests during changes and all gates at the final committed implementation tip.

## Commit, Review, And Closeout

- [x] Record `f2b0d81c` as the clean starting boundary.
- [ ] Ask `@auto_commit_notification` before the activation commit and at each
      coherent, validated implementation, evidence, review-fix, and docs
      closeout checkpoint; automatically commit meaningful progress.
- [ ] Record each commit and its evidence boundary here.
- [ ] Review the exact `f2b0d81c..<final-implementation-tip>` range with
      maintainability and test-quality reviewers after all gates complete.
- [ ] Record and resolve accepted findings in separate commits, widen the
      range, rerun affected gates, and repeat both reviews.
- [ ] Review the completed job and parent checklist, then commit a reviewed
      documentation-only Phase 12 closeout before Phase 13.

No Codex Security scan or security plugin is part of Phase 12 verification.

## Evidence

- Activation documentation commit: pending.
- Implementation/evidence commits and final tip: pending.
- Exact reviewed range and validation: pending.
- Automated and live matrix results: pending.
- Extraction, page-label, visual, and cleanup evidence: pending.
- Review findings, documentation closeout, and final verdict: pending.

## Related Research

- [Markdown PDF Page-Number Configuration](../../researches/research-2026-08-11-markdown-pdf-page-number-configuration.md)

## Related Plans

- [Markdown PDF page-number configuration implementation](../plan-2026-08-12-markdown-pdf-page-number-configuration.md)
