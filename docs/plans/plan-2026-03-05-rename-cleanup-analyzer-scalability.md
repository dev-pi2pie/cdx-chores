---
title: "Rename cleanup analyzer scalability and bounded preview"
created-date: 2026-03-05
status: draft
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

- [ ] define explicit analyzer limits as named constants with rationale:
  - [ ] sample count cap
  - [ ] grouped pattern cap
  - [ ] examples-per-group cap
  - [ ] grouped preview line/character cap
- [ ] document desired behavior for large scope scans (for example `examples/playground/huge-logs`)

### Phase 2: Streaming analyzer evidence collector

- [ ] implement analyzer-directory traversal that:
  - [ ] counts all eligible candidates
  - [ ] only stores first `sampleLimit` sampled relative names
  - [ ] avoids constructing a full `candidates[]` array for analyzer-only evidence collection
- [ ] keep existing filter semantics (`matchRegex`, `skipRegex`, `ext`, `skipExt`, recursion, maxDepth)
- [ ] preserve deterministic ordering of sampled names

### Phase 3: Grouped review output guardrails

- [ ] add bounded grouped preview rendering:
  - [ ] clamp printed groups to configured max
  - [ ] clamp per-line example text length with ellipsis
  - [ ] print summary line for truncated groups/examples when truncation occurs
- [ ] ensure fallback/no-group messaging remains clear

### Phase 4: Codex prompt payload guardrails

- [ ] verify prompt builder uses bounded evidence only
- [ ] add a max prompt text safety cap for grouped example text expansion
- [ ] keep suggestion quality stable for mixed-family datasets

### Phase 5: Tests

- [ ] add analyzer evidence tests for large input count with bounded sampled output
- [ ] add interactive output tests for grouped preview truncation indicators
- [ ] keep existing analyzer-assisted and cleanup suites green

### Phase 6: Docs and verification

- [ ] update cleanup guide with analyzer scalability notes
- [ ] run verification:
  - [ ] `bunx tsc --noEmit`
  - [ ] `bun test test/cli-actions-rename-cleanup-analyzer.test.ts test/cli-interactive-rename.test.ts`
  - [ ] targeted manual smoke on `examples/playground/huge-logs`

## Success Criteria

- analyzer evidence collection no longer materializes full eligible candidate arrays for analyzer-only collection
- interactive grouped review remains readable and bounded under large directory scopes
- Codex suggestion payload remains bounded and deterministic
- no regression in existing cleanup behavior and tests

## Related Research

- `docs/researches/research-2026-03-04-partial-analyzer-assisted-cleanup-scope.md`
- `docs/researches/research-2026-03-03-codex-analyzer-assisted-rename-cleanup.md`
- `docs/researches/research-2026-02-28-interactive-large-rename-preview-ux-research.md`

## Related Plans

- `docs/plans/plan-2026-03-05-partial-analyzer-assisted-cleanup-scope-implementation.md`
- `docs/plans/plan-2026-02-28-interactive-large-rename-preview-ux-implementation.md`
