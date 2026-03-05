---
title: "Rename cleanup analyzer scalability implementation"
created-date: 2026-03-05
modified-date: 2026-03-05
status: completed
agent: codex
---

## Goal

Implement `docs/plans/plan-2026-03-05-rename-cleanup-analyzer-scalability.md` through Phase 1 to Phase 6.

## Scope Covered

- Phase 1: contract and limits
- Phase 2: streaming analyzer evidence collector
- Phase 3: grouped review output guardrails
- Phase 4: Codex prompt payload guardrails
- Phase 5: tests
- Phase 6: docs and verification

## What Changed

- codified analyzer evidence limits in `src/cli/actions/rename/cleanup-analyzer.ts`:
  - sample limit (`40`)
  - grouped pattern limit (`12`)
  - examples per group (`3`)
- switched analyzer directory evidence collection to analyzer-specific one-pass sampling:
  - count all eligible candidates
  - keep only first bounded sampled names
  - avoid full analyzer candidate array materialization
- kept existing filter/scan behavior compatibility:
  - recursive/max-depth
  - match/skip regex
  - ext/skip-ext
  - generated `rename-plan-*.csv` exclusion
- added grouped analyzer preview guardrails in `src/cli/interactive/rename-cleanup.ts`:
  - bounded groups
  - bounded example line length with ellipsis
  - explicit truncation indicators for hidden groups and truncated examples
- added Codex prompt payload guardrails in `src/cli/actions/rename/cleanup-codex.ts`:
  - bounded sample/group lines
  - per-line truncation
  - grouped section character budget
  - explicit omitted-evidence markers for prompt safety
- exported shared analyzer-evidence limits through action barrels:
  - `src/cli/actions/rename/index.ts`
  - `src/cli/actions/index.ts`
- updated harness support for new analyzer limits export:
  - `test/helpers/interactive-harness.ts`
- added/updated tests:
  - `test/cli-actions-rename-cleanup-analyzer.test.ts`
  - `test/cli-actions-rename-cleanup-codex.test.ts`
  - `test/cli-interactive-rename.test.ts`
- documented analyzer scalability behavior in:
  - `docs/guides/rename-common-usage.md`

## Verification

- `bunx tsc --noEmit`
- `bun test test/cli-actions-rename-cleanup-analyzer.test.ts test/cli-interactive-rename.test.ts`
- `bun test test/cli-actions-rename-cleanup-codex.test.ts`
- `bun src/bin.ts rename cleanup ./examples/playground/huge-logs --hint serial --dry-run --preview-skips summary`
- `bun -e 'import { collectRenameCleanupAnalyzerEvidence } from "./src/cli/actions/rename/cleanup-analyzer"; ...'`

## Outcomes

- heavy analyzer scopes now keep deterministic bounded evidence (`sampledCount`) while preserving full candidate awareness (`totalCandidateCount`)
- interactive grouped analyzer preview is bounded and explicitly communicates truncation
- Codex cleanup suggestion prompt payload is bounded and resilient under large sampled evidence

## Related Plans

- `docs/plans/plan-2026-03-05-rename-cleanup-analyzer-scalability.md`

## Related Research

- `docs/researches/research-2026-03-04-partial-analyzer-assisted-cleanup-scope.md`
- `docs/researches/research-2026-03-03-codex-analyzer-assisted-rename-cleanup.md`
- `docs/researches/research-2026-02-28-interactive-large-rename-preview-ux-research.md`
