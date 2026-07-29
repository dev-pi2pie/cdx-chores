---
title: "Markdown PDF Interactive Mode Phase 4 deterministic authoring"
created-date: 2026-07-22
modified-date: 2026-07-22
status: completed
agent: codex
plan: ../plan-2026-07-21-markdown-pdf-interactive-mode.md
---

## Goal

Implement Phase 4 of the Markdown PDF Interactive Mode plan by adding shared,
deterministic Profile and Template preparation for `starter` and
`formal-guide`, durable `pdf-recipes` saves, and the Phase 4 lifecycle choices
needed by `to-pdf` without taking ownership of Phase 6 temporary directories or
recovery behavior.

Phase base: `c456e2c`.

## Implementation Checklist

- [x] Add destination-neutral prepared Profile and Template services.
- [x] Keep direct Profile and Template initialization behavior compatible.
- [x] Add shared `starter` preparation for Profile and Template artifacts.
- [x] Add grouped `formal-guide` collection and revision.
- [x] Enforce the deterministic artifact matrix and keep Project unavailable.
- [x] Save durable `pdf-recipes` artifacts only after final review.
- [x] Require explicit durable output paths from the direct initialization contract.
- [x] Expose temporary-render and save-and-render choices without materializing a
      Phase 6-owned temporary directory.
- [x] Add focused parity, matrix, revision, lifecycle, and no-write coverage.
- [x] Pass focused and repository validation.
- [x] Review the exact Phase 4 commit range and resolve actionable findings.

## Changes

- Added destination-neutral Profile and Template preparation, destination
  binding, and exact prepared-artifact writes while keeping direct command
  summaries and output contracts compatible.
- Added structured `formal-guide` answers for layout, margins, and ToC with
  smallest-group revision and implicit preset-default preservation.
- Added one shared deterministic authoring flow for Profile and Template
  `starter` and `formal-guide` paths.
- Made `pdf-recipes` save reviewed deterministic artifacts through the required
  explicit direct-helper destinations.
- Added generated-recipe lifecycle choices to `to-pdf`; both stop before path
  binding, writing, rendering, or cleanup until Phase 6 owns materialization.

## Verification

Passed:

```bash
bun test test/cli-actions-md-to-pdf-profile-init.test.ts test/cli-actions-md-to-pdf-template-init.test.ts test/cli-interactive-routing.test.ts test/cli-interactive-markdown-pdf
bunx tsc --noEmit
bun run lint
bun run format:check
bun run build
bun test
git diff --check
```

The final focused deterministic and routing slice passed with 63 tests and zero
failures. The full suite passed with 1,575 tests and zero failures. Built CLI
Profile and Template artifacts each produced a valid PDF; visual inspection
confirmed expected orientation, ToC behavior, legible CJK text, code content,
spacing, and margins.

Implementation checkpoints:

- `620f428` — destination-neutral Profile and Template init services
- `2f0b1a8` — grouped formal-guide answer and compilation model
- `287e31a` — shared Interactive deterministic authoring and lifecycle routing
- `5d36f8d` — atomic Template bundle writes, recoverable save errors, explicit
  candidate transitions, and review-driven regression coverage

## Review

Reviewed the exact Phase 4 range `c456e2c..5d36f8d` after the accepted fixes.
The correctness review was clean, and the test review found no material
coverage gaps.

The maintainability review suggested replacing the transaction state with a
single plan object and generalizing the small authoring transitions. These
suggestions were not accepted: the transaction still requires explicit staged,
committed, and backed-up state for rollback, while a generalized wizard layer
would exceed the current two-artifact flow without reducing its branches.

The documentation review reported that the parent plan lacked a
`Related Research` section. Direct policy verification found that the section
and applicable research links already exist, so no documentation correction
was required. No actionable findings remain in the reviewed range.

## Artifact Safety

Deterministic preparation must remain side-effect free. Durable writes may
target only the reviewed explicit output. Temporary session directory creation,
cleanup, failure retention, and recovery remain deferred to Phase 6. Automated
Interactive tests used injected write boundaries, and isolated render-smoke
artifacts were removed after inspection.

## Related Research

- [Markdown PDF Interactive Mode](../../researches/research-2026-07-03-markdown-pdf-interactive-mode.md)
