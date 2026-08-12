---
title: "Markdown PDF page-number Phase 3 Template compatibility"
created-date: 2026-08-12
status: active
agent: codex
plan: ../plan-2026-08-12-markdown-pdf-page-number-configuration.md
---

## Scope

Establish one structural `.document-body` contract across built-in, selected,
and generated Markdown PDF Templates. Enforce body-origin compatibility from
actual HTML while preserving legacy document-origin fallback and generic
partial-bundle behavior. This phase does not generate page-number CSS.

## Starting Boundary

- Starting commit: `d7287e27`.
- Phase 2 is completed; the parent plan remains `active`.
- Related research remains `in-progress` while later phases continue.
- The worktree was clean before Phase 3 began.

## Structural Contract

A body boundary is proven only when parsed HTML contains exactly one element
with the `document-body` class token and the single real `$body$` insertion
point is its descendant. Missing, duplicate, unrelated, comment-only,
attribute-only, and script-only matches are unproven. Source-specific warning
or failure policy consumes this structural result; it is not embedded in the
inspector.

## Checkpoints

- [x] 3A: Add the shared structural inspector and built-in hook.
- [x] 3B: Validate actual selected Templates and preserve legacy/partial-bundle
      behavior.
- [x] 3C: Validate Template-helper output and external base-Profile handoff.
- [x] Run focused validation, type-check, lint, formatting, and build.
- [x] Run the full repository test suite.
- [ ] Review the exact Phase 3 implementation and evidence range and resolve
      every actionable finding.

## Evidence Status

All three implementation checkpoints and repository validation are complete.
Phase 3 remains active until the exact-range review closes.

## Checkpoint Commits

- `854a0b18` — Phase 3 activation and explicit subphase boundaries.
- `1326438e` — parsed structural body contract and built-in hook.
- `04919c5f` — selected-Template compatibility and legacy fallback policy.
- `05e445b2` — Template helper/base-Profile compatibility and external replay.

## Validation

- Phase-focused compatibility suite: 248 passed, 0 failed.
- Full repository suite: 1,912 passed, 0 failed.
- TypeScript type-check: passed.
- Lint and formatting checks: passed.
- Production build: passed.
- `git diff --check`: passed.

## Provisional Verdict

**Continue after exact-range review.** Built-in and generated Templates expose
one proven body boundary; body-origin requests fail before renderer probes or
writes when proof is absent; legacy document-origin fallback warns once; and
the Template helper keeps its base Profile external to the partial bundle.

## Related Research

- [Markdown PDF Page-Number Configuration](../../researches/research-2026-08-11-markdown-pdf-page-number-configuration.md)

## Related Plans

- [Markdown PDF page-number configuration implementation](../plan-2026-08-12-markdown-pdf-page-number-configuration.md)
