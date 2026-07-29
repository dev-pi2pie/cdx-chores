---
title: "Markdown PDF Interactive code highlighting Phase 4 validation"
created-date: 2026-07-23
modified-date: 2026-07-23
status: completed
agent: codex
plan: ../plan-2026-07-23-markdown-pdf-interactive-code-highlighting.md
---

## Scope

Document and validate the complete Interactive code-highlighting contract
implemented in Phases 1 through 3. Update both current usage guides, retain
direct CLI compatibility coverage, run focused and repository gates, and
complete representative real-render PDF verification.

This phase does not add a Project preparation branch, Template-owned code
settings, new renderer flags, or a new saved schema.

## Review Boundary

- Phase base: `d109ea9`.
- Final Phase 4 implementation review range: `d109ea9..d2143c5`.
- Whole-plan base: `3de7463`.
- Final whole-plan review range: `3de7463..d2143c5`.

The ranges end at the lifecycle correctness fix accepted during whole-plan
review. The whole-plan range contains unrelated font-fixture cleanup
`d109ea9`; reviewers classified it separately from this plan.

## Documentation Checklist

- [x] Update the Interactive usage guide to the shipped ownership, prompts,
      review, navigation, and lifecycle contract.
- [x] Add a concise Interactive mapping to the direct Markdown PDF usage guide.
- [x] Keep Template code-setting ownership and Project Codex-only preparation
      explicit.
- [x] Keep guide status and modification metadata accurate.

## Validation Checklist

- [x] Run focused Interactive Markdown PDF coverage.
- [x] Run direct CLI omitted, enable, and disable regression coverage.
- [x] Run TypeScript, lint, format, build, full tests, and whitespace checks.
- [x] Complete the representative real-render PDF matrix.
- [x] Record only repository-relative and sanitized evidence.

## Review Checklist

- [x] Review the exact Phase 4 implementation range.
- [x] Resolve actionable findings and review any widened Phase 4 range.
- [x] Review the whole-plan implementation range.
- [x] Resolve actionable findings and review the widened whole-plan range.
- [x] Complete test-coverage and documentation closeout reviews.

## Evidence

Documentation checkpoints:

- `e397789` — Phase 4 validation job start
- `8fa2df0` — current Interactive and direct usage-guide mapping
- `da82e0a` — guide wording and Phase 4 evidence checkpoint
- `d9187fb` — generated save-only boundary and direct-default review fixes
- `eb24d38` — evidence-gated status restored before whole-plan review
- `d2143c5` — durable recovery preserves an already-written recipe

Passed:

```bash
bun test test/cli-interactive-markdown-pdf
bun test test/cli-actions-md-to-pdf-code-highlight.test.ts test/cli-actions-md-to-pdf-actions.test.ts test/cli-actions-md-to-pdf-actions-validation.test.ts test/cli-actions-md-to-pdf-commands.test.ts test/cli-actions-md-to-pdf-profile.test.ts test/cli-actions-md-to-pdf-bundle.test.ts
bunx tsc --noEmit
bun run lint
bun run format:check
bun run build
bun test
git diff --check 3de7463..d2143c5
```

The final Interactive Markdown PDF suite passed with 198 tests and zero
failures. The two durable-recovery regression files passed with 88 tests and
zero failures. The direct Markdown PDF compatibility slice passed with 153
tests and zero failures, including omitted, enable, and disable behavior. The
final full repository suite passed with 1,753 tests and zero failures across
222 files.

Eight one-page A4 render smokes covered Profile `formal-guide` default-on and
disabled artifacts, an existing Profile with inherit/enable/disable choices,
Template-only enablement with the default light theme, a Project bundle using
its contained Profile, and a saved Project bundle with a one-render override.
PDF metadata inspection, HTML hook assertions, page rasterization, and visual
inspection passed. The Project cases used the contained Profile theme and
transformer settings without a Project preparation branch. Automated
lifecycle coverage additionally retained generated temporary, durable, and
saved-recipe handoff behavior without artifact regeneration or rewrite.
Temporary smoke artifacts were removed after inspection.

The first exact-range review found two guide wording issues: the generated
sequence included save-only `pdf-recipes`, and the direct-default statement
was broader than direct Profile initialization. `d9187fb` resolved both.

The first whole-plan review found that renderer-preparation recovery could
write an already-saved durable recipe again after returning to recipe review
and changing only code highlighting. `d2143c5` retains the written
materialization only for the same accepted candidate, input, lifecycle, and
report. Deterministic and Codex Project regressions prove one candidate, bind,
and write across an enable-to-disable recovery.

Correctness, test-coverage, maintainability, and documentation re-reviews found
no remaining actionable issue in `3de7463..d2143c5`. A suggestion to re-plan
an unchanged PDF output after a highlighting change was classified as
non-actionable: the flow intentionally uses the renderer service's binding
helper to preserve the reviewed output without repeating output planning.

## Post-Closeout Recovery Regression

A later `dev`-against-`canary` review found one stage-awareness gap after a
successful durable write. If renderer preparation returned to recipe review,
the next final review's `Change outputs` action cleared the written
materialization and forced the recipe destination through binding and writing
again even when only the PDF destination needed to change.

The correction keeps the matching written materialization, presents `Change PDF
output`, revalidates replacement PDF paths against the durable recipe and
report, and updates only the retained PDF output before final review.
Deterministic and Codex Project regressions prove one preparation, bind, and
write across the recovery path. An additional deterministic regression proves
that a colliding replacement is rejected and re-prompted without rewriting the
recipe.

Passed:

```bash
bun test test/cli-interactive-markdown-pdf/lifecycle.test.ts test/cli-interactive-markdown-pdf/codex-authoring.test.ts
bun test test/cli-interactive-markdown-pdf
./node_modules/.bin/tsc --noEmit
bun run lint
bun run format:check
bun run build
bun test
```

The focused recovery files passed with 91 tests and 410 assertions, the full
Interactive Markdown PDF suite passed with 201 tests and 796 assertions, and
the full repository suite passed with 1,756 tests and 9,290 assertions across
222 files.

## Related Research

- [Markdown PDF Interactive Code Highlighting](../../researches/research-2026-07-23-markdown-pdf-interactive-code-highlighting.md)
