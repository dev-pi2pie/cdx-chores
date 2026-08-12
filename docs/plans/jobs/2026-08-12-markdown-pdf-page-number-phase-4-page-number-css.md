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

- [ ] Confirm the document-origin first-page reset selector and separator span
      semantics with compact temporary renderer micro-smokes.
- [ ] 4A: Implement sequence and selective visibility behavior.
- [ ] 4B: Implement position, bounded style, and cascade behavior.
- [ ] 4C: Run Profile-driven product renderer extraction and visual evidence.
- [ ] Run focused validation, type-check, lint, formatting, and build.
- [ ] Run the full repository test suite.
- [ ] Review the exact Phase 4 implementation and evidence range and resolve
      every actionable finding.

## Evidence Status

Phase 4 is active. No selector, CSS-generation, or product-renderer verdict is
accepted yet.

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
