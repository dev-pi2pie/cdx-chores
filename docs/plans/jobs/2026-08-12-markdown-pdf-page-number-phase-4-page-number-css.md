---
title: "Markdown PDF page-number Phase 4 CSS"
created-date: 2026-08-12
status: completed
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
- [x] 4A: Implement sequence and selective visibility behavior.
- [x] 4B: Implement position, bounded style, and cascade behavior.
- [x] 4C: Run Profile-driven product renderer extraction and visual evidence.
- [x] Run focused validation, type-check, lint, formatting, and build.
- [x] Run the full repository test suite.
- [x] Review the exact Phase 4 implementation and evidence range and resolve
      every actionable finding.

## Evidence Status

Phase 4 implementation, renderer evidence, validation, and exact-range review
are complete.

## Checkpoint Commits

- `5adfc2ec` — Phase 4 activation and evidence lifecycle.
- `5639a9e7` — pre-generator reset and separator renderer evidence.
- `12a12fa6` — sequence and selective visibility CSS.
- `572ce007` — bounded page-chrome style and cascade CSS.
- `9842cbb9` — Profile-driven product renderer evidence harness.
- `92caa2ce` — implementation and renderer evidence record.
- `c3a661a6` — exact-range regression and traceability corrections.

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

## Product Renderer Evidence

- WeasyPrint 65.1, 68.0, and 69.0 passed seven direct renderer-contract cases,
  selected-version doctor checks, the current-command launch control, and three
  Profile-driven product scenarios with zero automated failures.
- Product scenarios cover built-in document-origin numbering with cover and
  ToC pages, explicit proven-body numbering with bounded page-chrome style, and
  later custom-stylesheet precedence over Profile presentation.
- Automated checks prove exact physical-page order and labels, forbidden
  displaced-slot text, A5 dimensions and orientation, selected margin-box
  regions, complete decodable PNG output, selected CLI entrypoint, and selected
  renderer candidate.
- The harness correctly reported `evidenceStatus: visual-review-required` for
  font, typography, color, separator, and stylesheet-cascade assertions. Manual
  review completed those assertions: representative images were legible,
  unclipped, non-overlapping, correctly positioned, and showed the expected
  separator and later-stylesheet presentation changes.
- On 2026-08-12 UTC, Codex reviewed product scenario A, B, and C representative
  pages from WeasyPrint 69.0. The checklist covered visibility, sequence,
  selected margin-box placement, clipping, overlap, typography, color,
  separator direction/gap, and later-stylesheet presentation. The earlier
  separator contact sheet compared all three accepted candidates; automated
  extraction, placement, and PNG checks covered every scenario on every
  accepted candidate.
- Every successful or resolved owned temporary laboratory was closed after
  extraction and visual review. No generated renderer artifact was committed.

## Validation

- Phase 4B focused suite: 57 passed, 0 failed, using
  `bun test test/adapters-codex-markdown-pdf-profile.test.ts test/cli-actions-md-to-pdf-page-chrome.test.ts test/cli-actions-md-to-pdf-recipe.test.ts test/cli-actions-md-to-pdf-actions-profile-rendering.test.ts --timeout 30000`.
- Broad Markdown PDF regression slice: 901 passed, 0 failed, using
  `rg --files test | rg 'md-to-pdf|markdown-pdf' | xargs bun test --timeout 30000`.
- Renderer-evidence harness: 26 passed, 0 failed, using
  `bun test test/markdown-pdf-page-number-renderer-evidence.test.ts`.
- Full repository suite at `c3a661a6`: 1,950 passed, 0 failed, using
  `bun test --timeout 30000`.
- Static and build validation used `bunx tsc --noEmit`, `bun run lint`,
  `bun run format:check`, `bun run build`, and `git diff --check`.
- Recorded toolchain: Bun 1.3.14, TypeScript 7.0.2, Oxlint 1.77.0, Oxfmt
  0.62.0, and Tsdown 0.22.14. The live matrix used the checked-in harness and
  its pinned WeasyPrint 65.1, 68.0, and 69.0 candidate contract; local
  executable paths and environment details remain intentionally unrecorded.
- The live matrix command was
  `bun scripts/spikes/markdown-pdf-page-number-renderer-evidence.ts run --live --keep --python <explicit-python-executable>`;
  the guarded `close --lab <retained-lab>` operation closed each retained owned
  laboratory after review. Placeholders intentionally omit local paths.

## Exact-Range Review

- Reviewed range: `bee97270..c3a661a6`.
- Maintainability review found no material concerns after focused validation.
- Test review added complete visual-boundary mapping and explicit body-origin
  ToC suppression assertions; the widened range has no remaining material test
  gaps.
- Security review found no material CSS-input, subprocess, temporary-lab,
  redaction, or parser risks in scope.
- Documentation review added reproducible commands, toolchain versions, manual
  scenario/candidate coverage, UTC lifecycle metadata, and final-tip full-suite
  evidence.
- Every accepted finding was resolved and the widened range was re-reviewed.

## Final Verdict

**Continue to Phase 5.** The CSS generator and renderer evidence agree on
accepted sequence, visibility, position, style, separator, and
stylesheet-precedence behavior across the retained renderer matrix.

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
