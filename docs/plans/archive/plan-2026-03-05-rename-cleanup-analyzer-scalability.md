---
title: "Rename cleanup analyzer scalability and bounded preview"
created-date: 2026-03-05
modified-date: 2026-03-05
status: completed
agent: codex
---

## Goal

Improve interactive `rename cleanup` analyzer performance and output safety for large directories by avoiding full in-memory candidate materialization and by bounding grouped preview verbosity.

## Why This Plan

Current analyzer evidence collection caps sampled output (`sampleLimit`, grouped limits), but still builds a full directory candidate list before slicing. This is acceptable for small/medium trees but creates avoidable memory/latency pressure for very large directories.

The `Grouped analyzer review` output is already bounded by group and examples limits, but line-level and total-section verbosity can still be tightened for predictability in heavy cases.

## Scope

- refactor analyzer evidence collection to stream/aggregate candidates instead of materializing full arrays
- keep current analyzer semantics:
  - grouped patterns are computed from sampled names only
  - `totalCandidateCount` still reflects all eligible candidates
- add bounded grouped preview formatting guardrails for interactive output
- keep Codex suggestion prompt payload within explicit bounded limits
- add tests for large-directory behavior and preview bounds

## Non-Goals

- changing cleanup matching semantics (`date`, `timestamp`, `serial`, `uid`)
- changing deterministic cleanup plan/apply behavior
- changing analyzer-assisted flow ordering or confirmation steps
- adding new CLI include/exclude flags in this pass

## Implementation Touchpoints

- `src/cli/actions/rename/cleanup-analyzer.ts`
- `src/cli/actions/rename/cleanup-planner.ts` (or new analyzer-specific directory walker module)
- `src/cli/interactive/rename-cleanup.ts`
- `src/cli/actions/rename/cleanup-codex.ts`
- `test/cli-actions-rename-cleanup-analyzer.test.ts`
- `test/cli-interactive-rename.test.ts`
- `docs/guides/rename-common-usage.md`

## Phase Checklist

### Phase 1: Contract and limits

- [x] define explicit analyzer limits as named constants with rationale:
  - [x] sample count cap
  - [x] grouped pattern cap
  - [x] examples-per-group cap
  - [x] grouped preview line/character cap
- [x] document desired behavior for large scope scans (for example `examples/playground/huge-logs`)

### Phase 2: Streaming analyzer evidence collector

- [x] implement analyzer-directory traversal that:
  - [x] counts all eligible candidates
  - [x] only stores first `sampleLimit` sampled relative names
  - [x] avoids constructing a full `candidates[]` array for analyzer-only evidence collection
- [x] keep existing filter semantics (`matchRegex`, `skipRegex`, `ext`, `skipExt`, recursion, maxDepth)
- [x] preserve deterministic ordering of sampled names

### Phase 3: Grouped review output guardrails

- [x] add bounded grouped preview rendering:
  - [x] clamp printed groups to configured max
  - [x] clamp per-line example text length with ellipsis
  - [x] print summary line for truncated groups/examples when truncation occurs
- [x] ensure fallback/no-group messaging remains clear

### Phase 4: Codex prompt payload guardrails

- [x] verify prompt builder uses bounded evidence only
- [x] add a max prompt text safety cap for grouped example text expansion
- [x] keep suggestion quality stable for mixed-family datasets

### Phase 5: Tests

- [x] add analyzer evidence tests for large input count with bounded sampled output
- [x] add interactive output tests for grouped preview truncation indicators
- [x] keep existing analyzer-assisted and cleanup suites green

### Phase 6: Docs and verification

- [x] update cleanup guide with analyzer scalability notes
- [x] run verification:
  - [x] `bunx tsc --noEmit`
  - [x] `bun test test/cli-actions-rename-cleanup-analyzer.test.ts test/cli-interactive-rename.test.ts`
  - [x] targeted manual smoke on `examples/playground/huge-logs`

## Success Criteria

- analyzer evidence collection no longer materializes full eligible candidate arrays for analyzer-only collection
- interactive grouped review remains readable and bounded under large directory scopes
- Codex suggestion payload remains bounded and deterministic
- no regression in existing cleanup behavior and tests

## Phase 1 Decisions

- analyzer evidence limits are now codified through one constant contract in `src/cli/actions/rename/cleanup-analyzer.ts`:
  - `sampleLimit`: `40`
  - `groupLimit`: `12`
  - `examplesPerGroup`: `3`
- grouped review interactive rendering now has explicit preview limits in `src/cli/interactive/rename-cleanup.ts`:
  - `maxGroupsToPrint`: `12`
  - `maxExamplesLineChars`: `220`
- desired behavior for large scopes (for example `examples/playground/huge-logs` with ~1000 files):
  - analyzer reports full `totalCandidateCount` for operator awareness
  - analyzer sampling remains bounded to first `40` eligible names for grouping/prompting
  - grouped review remains bounded to `12` groups and truncated example lines for terminal readability

## Phase 2 Decisions

- analyzer evidence collection now uses an analyzer-specific one-pass directory walker in `src/cli/actions/rename/cleanup-analyzer.ts`:
  - counts all eligible files as `totalCandidateCount`
  - stores only the first `sampleLimit` relative names in deterministic traversal order
  - does not materialize full cleanup candidate arrays for analyzer-only evidence
- traversal/filter contract mirrors existing cleanup candidate semantics:
  - honors `recursive`, `maxDepth`, `matchRegex`, `skipRegex`, `ext`, `skipExt`
  - skips generated `rename-plan-*.csv` artifacts
  - uses per-directory lexicographic ordering for deterministic sampled previews

## Phase 3 Decisions

- grouped analyzer review now emits explicit truncation indicators in `src/cli/interactive/rename-cleanup.ts`:
  - `- ... <N> additional grouped pattern(s) not shown` when group output is capped
  - `- ... examples truncated for <N> grouped pattern(s)` when examples lines exceed character cap
- example line truncation uses ellipsis to keep terminal output readable while preserving the start of representative examples
- no-group fallback messaging is unchanged and still explicit:
  - `- no grouped pattern evidence`

## Phase 4 Decisions

- Codex prompt construction in `src/cli/actions/rename/cleanup-codex.ts` now enforces explicit payload guardrails:
  - sample list hard-capped to analyzer sample limit (`40`)
  - grouped-pattern list hard-capped to analyzer group limit (`12`)
  - per-sample-name and grouped-examples line truncation with ellipsis
  - grouped section character budget (`maxGroupedSectionChars`) to prevent prompt bloat
- prompt now emits explicit omission context to preserve interpretability:
  - `additional sample name(s) omitted for prompt safety`
  - `grouped pattern(s) omitted for prompt safety`
- prompt headers now state visible/total counts for sampled names and grouped patterns.

## Phase 5 Verification Notes

- analyzer scalability and preview truncation tests:
  - `bun test test/cli-actions-rename-cleanup-analyzer.test.ts test/cli-interactive-rename.test.ts`
- Codex prompt guardrail tests:
  - `bun test test/cli-actions-rename-cleanup-codex.test.ts`
- typecheck:
  - `bunx tsc --noEmit`

## Phase 6 Verification Notes

- guide update:
  - `docs/guides/rename-common-usage.md` now documents analyzer evidence bounds, grouped-review truncation indicators, and Codex prompt omission guards
- verification rerun:
  - `bunx tsc --noEmit`
  - `bun test test/cli-actions-rename-cleanup-analyzer.test.ts test/cli-interactive-rename.test.ts`
- targeted manual smoke on `examples/playground/huge-logs`:
  - `bun src/bin.ts rename cleanup ./examples/playground/huge-logs --hint serial --dry-run --preview-skips summary`
  - `bun -e 'import { collectRenameCleanupAnalyzerEvidence } from "./src/cli/actions/rename/cleanup-analyzer"; ...'`
- observed heavy-scope behavior:
  - deterministic cleanup dry-run remains readable for 1000-file fixture (`Files to rename: 1`, `Entries skipped: 999`)
  - analyzer evidence remains bounded (`totalCandidateCount: 1000`, `sampledCount: 40`, grouped patterns bounded)

## Related Research

- `docs/researches/research-2026-03-04-partial-analyzer-assisted-cleanup-scope.md`
- `docs/researches/research-2026-03-03-codex-analyzer-assisted-rename-cleanup.md`
- `docs/researches/archive/research-2026-02-28-interactive-large-rename-preview-ux-research.md`

## Related Plans

- `docs/plans/archive/plan-2026-03-05-partial-analyzer-assisted-cleanup-scope-implementation.md`
- `docs/plans/archive/plan-2026-02-28-interactive-large-rename-preview-ux-implementation.md`
