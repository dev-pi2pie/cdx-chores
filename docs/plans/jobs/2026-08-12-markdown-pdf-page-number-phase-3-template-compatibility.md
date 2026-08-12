---
title: "Markdown PDF page-number Phase 3 Template compatibility"
created-date: 2026-08-12
status: completed
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
- [x] Review the exact Phase 3 implementation and evidence range and resolve
      every actionable finding.

## Evidence Status

All three implementation checkpoints, repository validation, and exact-range
review are complete.

## Checkpoint Commits

- `854a0b18` — Phase 3 activation and explicit subphase boundaries.
- `1326438e` — parsed structural body contract and built-in hook.
- `04919c5f` — selected-Template compatibility and legacy fallback policy.
- `05e445b2` — Template helper/base-Profile compatibility and external replay.
- `0b672785` — Phase 3 implementation and validation evidence checkpoint.
- `fbc0fedb` — exact-range compatibility corrections and expanded regressions.
- `bf99a902` — Codex identity-comment managed-Template regression.

## Validation

- Phase-focused compatibility suite before review fixes: 248 passed, 0 failed.
- Review-fix structural and compatibility suite: 35 passed, 0 failed.
- Full repository suite at `bf99a902`: 1,928 passed, 0 failed.
- TypeScript type-check: passed.
- Lint and formatting checks: passed.
- Production build: passed.
- `git diff --check`: passed.

## Exact-Range Review

- Reviewed range: `d7287e27..bf99a902`.
- Maintainability review found an inert-text insertion false positive; the
  inspector now excludes raw, escapable-raw, and inert text containers.
- Test review added malformed legacy, bundle fallback, warning ordering,
  managed-marker, and actual Codex identity-comment coverage.
- Security review found no material issues in the widened range.
- Documentation review corrected the research inventory and narrowed the
  recorded legacy fallback boundary.
- All accepted findings were fixed and the widened range was re-reviewed with
  no remaining material findings.

## Final Verdict

**Continue to Phase 4.** Built-in and generated Templates expose one proven body
boundary; body-origin requests fail before renderer probes or writes when proof
is absent; an unmanaged legacy Template with no body hook warns once for
document-origin body visibility, while malformed or managed Templates fail;
and the Template helper keeps its base Profile external to the partial bundle.

## Related Research

- [Markdown PDF Page-Number Configuration](../../researches/research-2026-08-11-markdown-pdf-page-number-configuration.md)

## Related Plans

- [Markdown PDF page-number configuration implementation](../plan-2026-08-12-markdown-pdf-page-number-configuration.md)
