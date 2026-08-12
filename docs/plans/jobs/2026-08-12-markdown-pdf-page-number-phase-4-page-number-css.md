---
title: "Markdown PDF page-number Phase 4 CSS"
created-date: 2026-08-12
status: active
agent: codex
plan: ../plan-2026-08-12-markdown-pdf-page-number-configuration.md
---

## Scope

Generate renderer-backed page-number sequence, visibility, position, and
bounded page-chrome style CSS from the normalized Profile contract. Preserve
Template and user stylesheet precedence, existing page-chrome behavior, and
the Phase 3 selected-Template compatibility boundary.

## Starting Boundary

- Starting commit: `bee97270`.
- Phase 3 is completed; the parent plan remains `active`.
- Related research remains `in-progress` while later phases continue.
- The worktree was clean before Phase 4 began.

## Permanent File Boundary

- Production changes remain in the Markdown PDF Profile page-chrome compiler
  and its existing integration seams.
- Deterministic tests extend the existing Markdown PDF Profile/page-chrome
  coverage.
- Product renderer cases extend the compact typed Phase 1 evidence catalog and
  harness only when needed for Profile-driven proof.
- Generated HTML, CSS, PDF, PNG, candidate environments, local paths, and raw
  renderer reports remain temporary and are not committed.

## Checkpoints

- [x] Confirm the document-origin first-page reset selector and separator span
      semantics with compact temporary renderer micro-smokes.
- [ ] 4A: Implement sequence and selective visibility behavior.
- [ ] 4B: Implement position, bounded style, and cascade behavior.
- [ ] 4C: Run Profile-driven product renderer extraction and visual evidence.
- [ ] Run focused validation, type-check, lint, formatting, and build.
- [ ] Run the full repository test suite.
- [ ] Review the exact Phase 4 implementation and evidence range and resolve
      every actionable finding.

## Evidence Status

Phase 4 is active. The pre-generator selector and separator decisions are
accepted; CSS-generation and product-renderer verdicts remain open.

## Pre-Generator Renderer Evidence

- WeasyPrint 65.1, 68.0, and 69.0 passed the compact document-reset and
  separator-area scenarios, the retained Phase 1 scenarios, selected-version
  doctor checks, and the current actual-launch control.
- `@page:nth(1)` with a reset seed of `start - increment` produced the expected
  document-origin sequence `0, 2, 4` when `start: 0` and `increment: 2`.
- Omitted separators produced no line. Styling an occupied header or footer
  margin box produced a legible bounded line. Identically styled empty sibling
  boxes did not form a meaningful continuous span, so generated separator CSS
  will target occupied boxes only.
- Extracted labels and representative PNGs agreed across accepted candidates;
  no clipping or overlap was observed.
- The successful temporary laboratory was closed after visual review. Earlier
  inconclusive setup attempts were not treated as renderer evidence and their
  owned laboratories were also closed.

## Temporary Evidence Lifecycle

Use an ownership-marked OS temporary laboratory for renderer candidates.
Successful evidence remains available only until extraction and representative
PNG review finish, then guarded cleanup removes the owned laboratory. Failed or
inconclusive runs may be retained locally for diagnosis and must be explicitly
closed when resolved or abandoned. Public records must not include resolved
temporary paths, environment names, activation commands, or local setup
details.

## Related Research

- [Markdown PDF Page-Number Configuration](../../researches/research-2026-08-11-markdown-pdf-page-number-configuration.md)

## Related Plans

- [Markdown PDF page-number configuration implementation](../plan-2026-08-12-markdown-pdf-page-number-configuration.md)
