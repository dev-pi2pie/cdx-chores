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

Implementation ending commit:
`e992d5104ceec483fcade1e2cc5f92ce56d72702`

Status: completed.

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
  - Initial Phase 2 candidate passed: 1,775 tests and 9,363 assertions across
    225 files.
  - Post-review fixes passed: 1,778 tests and 9,367 assertions across 225
    files.
- `git diff --check`
  - Passed.

Review status:

- The initial exact review covered
  `88bdb9607a8638751aef7ce911ad83a9f52b30fb..48c5a9f`.
- Correctness review found that physical-face deduplication could discard
  complementary aliases or full names before matching. The accepted fix merges
  lookup metadata while keeping physical identity unchanged.
- Test review requested exact full-name collision and deterministic same-family
  rank-one selection fixtures. Both were added.
- Final widened test review requested a full-name-substring collision fixture
  across primary families. It was added before final re-review.
- Maintainability review requested named matching ranks and broader
  normalization centralization. Named ranks were accepted. Broader
  centralization was rejected because adapter parsing preserves source order
  while grouped search records intentionally choose deterministic display
  spelling.
- Documentation review requested an explicit implementation end boundary. This
  section records it above.
- The widened implementation range is
  `88bdb9607a8638751aef7ce911ad83a9f52b30fb..e992d5104ceec483fcade1e2cc5f92ce56d72702`.
- Final widened review covered
  `88bdb9607a8638751aef7ce911ad83a9f52b30fb..4dee496` and approved the
  implementation, regression coverage, maintainability, and documentation
  record with no actionable findings.

Phase gate: passed. Fontconfig lookup metadata is retained without changing the
primary selected family, shared diagnostics remain deterministic and
compatible, and Interactive ranking remains outside adapter parsing.

Checkpoint commits:

- `48c5a9f` — additive lookup metadata, searchable-family records, diagnostic
  compatibility, tests, plan checklist evidence, and this job.
- `e992d51` — accepted matching and regression fixes from the initial exact
  review.
- `79d134b` — Phase 2 plan and job closeout.
- `4dee496` — final ambiguous full-name-substring regression coverage.

## Phase 3: Deterministic Installed-Font Ranking

Starting commit:
`4dee496`

Status: implementation complete; exact-range review pending.

Implemented:

- Added a dependency-free scorer over searchable-family records with explicit
  exact, prefix, token-prefix, substring, and ordered-subsequence tiers.
- Kept family, alias, and full-name field priority deterministic while always
  returning the primary family.
- Added bounded compact-query, initialism, and ordered-subsequence behavior for
  missing-space and abbreviated input without enabling arbitrary two-character
  subsequences.
- Merged duplicate primary-family records before ranking and made result order
  independent of discovery input order.
- Kept custom input first, removed only an exact normalized primary-family
  duplicate, and limited installed choices to six independently.
- Integrated retained search records into the existing suggestion-service cache
  without changing the Phase 4 timeout lifecycle.
- Avoided importing the broad font barrel from the Interactive suggestion
  module so isolated harness mocks do not acquire a discovery-module coupling.

Verification:

- `bun test test/fonts-*.test.ts test/cli-interactive-markdown-pdf/font-hints.test.ts`
  - Passed: 125 tests and 552 assertions across 22 files.
- `bun test test/cli-interactive-markdown-pdf/render-sources.test.ts test/cli-interactive-markdown-pdf/lifecycle.test.ts`
  - Passed: 64 tests across 2 files after narrowing the suggestion imports.
- `bunx tsc --noEmit`
  - Passed.
- `bun run lint`
  - Passed.
- `bun run format:check`
  - Passed.
- `bun run build`
  - Passed.
- `git diff --check`
  - Passed.
- `bun test`
  - Passed: 1,789 tests and 9,390 assertions across 226 files.

Review status:

- Exact-range review will begin after the validated implementation checkpoint.

## Phase 4: Interactive Discovery Lifecycle

Status: pending Phase 3 closeout.

## Phase 5: Validation, Guidance, And Closeout

Status: pending Phase 4 closeout.
