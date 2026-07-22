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

- [x] Collect Markdown input and recipe source.
- [x] Implement built-in and existing Profile/bundle preparation.
- [x] Implement Custom inputs as composition mode followed by explicit roles.
- [x] Reuse direct bundle admission, ambiguity, warning, and precedence rules.
- [x] Review the effective prepared recipe and role provenance without writes.
- [x] Collect PDF output only after recipe acceptance.
- [x] Render the accepted prepared result after one final confirmation.
- [x] Preserve Back, Cancel, and destination-revision behavior.
- [x] Add focused routing, provenance, conflict, and render-parity coverage.
- [x] Pass focused and repository validation.
- [ ] Review the exact Phase 3 commit range and resolve actionable findings.

## Changes

- Added built-in, existing Profile, existing bundle, and Custom render-source
  collection to the Interactive `to-pdf` route.
- Added the two-layer Custom composition and explicit-role flow while retaining
  the direct renderer as the authoritative bundle resolver.
- Added prepared-result review with normalized options, role provenance, and
  ignored-file warnings before output selection.
- Added final output planning and one-confirmation execution without preparing
  the recipe again or assigning cleanup ownership to external inputs.

## Verification

Passed:

```bash
bun test test/cli-interactive-routing.test.ts test/cli-interactive-markdown-pdf/render-sources.test.ts
bunx tsc --noEmit
bun run lint
bun run format:check
bun run build
bun test
git diff --check
```

The focused routing slice passed with 22 tests and zero failures. The full
suite passed with 1,540 tests and zero failures. A built CLI renderer smoke
produced a non-empty PDF, and visual inspection of the rendered page confirmed
legible CJK text, code content, spacing, and margins.

Implementation checkpoint:

- `6546b01` — prepared source collection, review, output planning, and render

## Review

Pending a validated Phase 3 commit range.

## Artifact Safety

Automated tests used injected preparation and renderer boundaries. Existing
Profile, Template, stylesheet, and bundle inputs are external sources and must
never become cleanup targets. The isolated renderer-smoke artifacts were
removed after inspection.

## Related Research

- [Markdown PDF Interactive Mode](../../researches/research-2026-07-03-markdown-pdf-interactive-mode.md)
