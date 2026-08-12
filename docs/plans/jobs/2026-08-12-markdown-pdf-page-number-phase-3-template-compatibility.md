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

- [ ] 3A: Add the shared structural inspector and built-in hook.
- [ ] 3B: Validate actual selected Templates and preserve legacy/partial-bundle
      behavior.
- [ ] 3C: Validate Template-helper output and external base-Profile handoff.
- [ ] Run focused and repository validation.
- [ ] Review the exact Phase 3 implementation and evidence range and resolve
      every actionable finding.

## Evidence Status

Phase 3 is active. No structural compatibility verdict is accepted yet.

## Related Research

- [Markdown PDF Page-Number Configuration](../../researches/research-2026-08-11-markdown-pdf-page-number-configuration.md)

## Related Plans

- [Markdown PDF page-number configuration implementation](../plan-2026-08-12-markdown-pdf-page-number-configuration.md)
