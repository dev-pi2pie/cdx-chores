---
title: "Interactive Markdown PDF installed-font search implementation"
created-date: 2026-07-27
status: in-progress
agent: codex
plan: ../plan-2026-07-26-interactive-markdown-pdf-installed-font-search.md
---

## Scope

Execute accepted work from Phases 2–5 of the Interactive Markdown PDF
installed-font search plan.

This job owns the additive shared search model, deterministic installed-font
ranking, the two-stage Interactive discovery lifecycle, final validation, and
guidance closeout. Phase 1 timing evidence and its environment limitation remain
owned by the separate font-discovery evidence job.

## Starting Boundary

- Starting commit:
  `88bdb9607a8638751aef7ce911ad83a9f52b30fb`
- The worktree was clean before Phase 2 began.
- The Phase 1 gate is **Proceed with limitation**.
- The related research remains `in-progress`.
- The implementation plan remains `active`.

## Execution Protocol

1. Work Phases 2–5 serially.
2. Record each phase's starting and ending commit boundary.
3. Keep plan checklist items open until matching implementation or review
   evidence exists.
4. Run phase-focused and repository validation before closeout.
5. Review each exact phase commit range and resolve actionable findings before
   beginning the next phase.
6. Record only repository-relative, public-safe evidence.

## Phase 2: Shared Font Search Records

Starting commit:
`88bdb9607a8638751aef7ce911ad83a9f52b30fb`

Status: in progress.

Implemented:

- Added optional face aliases and all-reported-full-name metadata while keeping
  the existing primary family and singular full-name fields unchanged.
- Kept the first non-empty fontconfig family as the primary family and retained
  remaining normalized-deduplicated family labels as aliases.
- Added deterministic searchable-family grouping by normalized primary family.
  Grouped records contain required alias and full-name arrays and never select
  lookup metadata as their family.
- Extended shared diagnostic matching with explicit ranks: exact primary
  family, exact alias or full name, primary-family or alias substring, then
  full-name substring.
- Kept exact primary-family matches authoritative and made alias or full-name
  collisions across primary families inconclusive.
- Preserved legacy `font list`, `font inspect`, and `font check` public output
  identity. Lookup arrays remain available through shared discovery results but
  do not appear in command JSON.
- Kept lookup metadata out of physical face identity and TTC coverage identity.

Verification:

- `bun test test/fonts-*.test.ts`
  - Passed: 92 tests and 468 assertions across 20 files.
- `bunx tsc --noEmit`
  - Passed.
- `bun run lint`
  - Passed.
- `bun run format:check`
  - Passed after formatting the new fixtures.
- `bun run build`
  - Passed.
- `bun test`
  - Passed: 1,775 tests and 9,363 assertions across 225 files.
- `git diff --check`
  - Passed.

Review status:

- Exact Phase 2 commit-range review remains pending.

## Phase 3: Deterministic Installed-Font Ranking

Status: pending Phase 2 closeout.

## Phase 4: Interactive Discovery Lifecycle

Status: pending Phase 3 closeout.

## Phase 5: Validation, Guidance, And Closeout

Status: pending Phase 4 closeout.
