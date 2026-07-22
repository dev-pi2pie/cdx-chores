---
title: "Markdown PDF Interactive Mode Phase 3 render sources"
created-date: 2026-07-22
status: in-progress
agent: codex
plan: ../plan-2026-07-21-markdown-pdf-interactive-mode.md
---

## Goal

Implement Phase 3 of the Markdown PDF Interactive Mode plan by making the
`to-pdf` route usable for built-in, existing Profile, existing bundle, and
two-layer Custom input sources while preserving prepare-once review and direct
renderer behavior.

Phase base: `f0e762d576f61efd23027274d1b23b759be8d599`.

## Implementation Checklist

- [ ] Collect Markdown input and recipe source.
- [ ] Implement built-in and existing Profile/bundle preparation.
- [ ] Implement Custom inputs as composition mode followed by explicit roles.
- [ ] Reuse direct bundle admission, ambiguity, warning, and precedence rules.
- [ ] Review the effective prepared recipe and role provenance without writes.
- [ ] Collect PDF output only after recipe acceptance.
- [ ] Render the accepted prepared result after one final confirmation.
- [ ] Preserve Back, Cancel, and destination-revision behavior.
- [ ] Add focused routing, provenance, conflict, and render-parity coverage.
- [ ] Pass focused and repository validation.
- [ ] Review the exact Phase 3 commit range and resolve actionable findings.

## Verification

Pending implementation.

## Review

Pending a validated Phase 3 commit range.

## Artifact Safety

Automated tests must use injected preparation and renderer boundaries. Existing
Profile, Template, stylesheet, and bundle inputs are external sources and must
never become cleanup targets.

## Related Research

- [Markdown PDF Interactive Mode](../../researches/research-2026-07-03-markdown-pdf-interactive-mode.md)
