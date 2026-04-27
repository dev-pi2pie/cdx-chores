---
title: "Data stack TypeScript refactor implementation"
created-date: 2026-04-27
modified-date: 2026-04-27
status: in-progress
agent: codex
---

## Goal

Refactor the current `data stack` TypeScript surface into smaller, focused modules without changing command behavior, artifact contracts, interactive prompts, or test coverage.

This plan turns the data-stack refactor research into an implementation sequence. Source-module phases pair the source split with the related test split so review stays bounded and regressions stay local. Two standalone test-structure phases isolate command-layer and interactive coverage before the highest-risk interactive source split begins.

## Related Research

- `docs/researches/research-2026-04-27-data-stack-typescript-refactor-scan.md`
- `docs/researches/research-2026-03-19-typescript-refactor-scan.md`
- `docs/researches/research-2026-04-23-data-stack-multi-file-assembly.md`
- `docs/researches/research-2026-04-24-data-stack-replay-and-codex-schema-assist.md`
- `docs/researches/research-2026-04-26-data-stack-artifact-and-codex-contract-cleanup.md`

## Related Plans

- `docs/plans/plan-2026-03-19-typescript-structural-refactor-sequencing.md`
- `docs/plans/plan-2026-04-23-data-stack-mixed-source-input-router-implementation.md`
- `docs/plans/plan-2026-04-23-data-stack-interactive-mixed-source-followup.md`
- `docs/plans/plan-2026-04-25-data-stack-replay-and-codex-assist-implementation.md`

## Implementation Records

- `docs/plans/jobs/2026-04-27-data-stack-typescript-refactor-phase-1-2.md`
- `docs/plans/jobs/2026-04-27-data-stack-typescript-refactor-phase-3-4.md`
- `docs/plans/jobs/2026-04-27-data-stack-typescript-refactor-phase-5-6.md`

## Why This Plan

The `data stack` feature family now has several large files that are still readable but increasingly risky to change:

- `src/cli/interactive/data/stack.ts`
- `src/cli/data-stack/plan.ts`
- `src/cli/data-stack/codex-report.ts`
- `src/cli/actions/data-stack.ts`
- stack-specific test coverage inside large shared test files

The research chose a conservative route:

- refactor stack-owned modules first
- keep behavior and public import style stable through `index.ts` facades
- pair each source split with the tests that prove it
- finish with a dedicated test-structure review
- defer non-stack TypeScript hotspots to a separate future plan

## Scope

In scope:

- folder-module splits for stack plan, Codex report, direct action, and interactive stack modules
- test splits paired with each source phase
- a small shared `test/helpers/data-stack-test-utils.ts` helper when it removes repeated fixture setup
- stack-specific interactive test movement out of `test/cli-interactive-routing.test.ts` into `test/cli-interactive-data-stack/`
- stack action mock extraction from the shared interactive harness data-action mock helper
- final test-structure review after the mechanical splits land

Out of scope:

- user-visible command behavior changes
- stack-plan JSON schema changes
- Codex report schema changes
- prompt copy changes unless required to preserve existing behavior after a move
- non-stack refactors such as rename, data query, DuckDB query, prompt, or data extract modularization
- broad package layout changes such as moving stack code into a new top-level feature tree

## Implementation Rules

- Use folder modules with `index.ts` facades for moved source surfaces.
- Preserve existing import style where callers currently import from paths such as `../../data-stack/plan` or `../../data-stack/codex-report`.
- Keep `src/cli/data-stack/*` as the leaf domain layer.
- Keep `src/cli/actions/*` as direct CLI action orchestration.
- Keep `src/cli/interactive/*` as prompt and TUI orchestration.
- Avoid import cycles between data-stack, action, and interactive layers.
- Keep each phase behavior-preserving.
- Run focused stack tests after each phase before moving to the next phase.
- Use the final phase to review the resulting test layout for duplicate, missing, or poorly grouped coverage.
- Treat Phases 4 and 5 as intentional test-structure phases that prepare the suite before the interactive source split.

## Contract Preservation

Every phase must preserve:

- `data stack` direct CLI behavior
- `data stack replay <record>` behavior
- stack-plan artifact validation and stable JSON field ordering
- Codex report artifact validation and recommendation lineage
- direct CLI strict-schema default and explicit output contract
- direct CLI `--dry-run`, `--plan-output`, `--codex-assist`, and `--codex-report-output` semantics
- interactive stack plan and Codex report retention prompts
- failed-write artifact retention behavior
- existing stdout/stderr separation

## Phase Checklist

### Phase 1: Split stack-plan artifact module and tests

- [x] move `src/cli/data-stack/plan.ts` to `src/cli/data-stack/plan/index.ts`
- [x] extract artifact constants, literal unions, and interfaces into `src/cli/data-stack/plan/types.ts`
- [x] extract timestamp, identity, payload id, and filename helpers into `src/cli/data-stack/plan/identity.ts`
- [x] extract artifact parsing and validation into `src/cli/data-stack/plan/parse.ts`
- [x] extract stable artifact ordering and serialization into `src/cli/data-stack/plan/serialize.ts`
- [x] extract read/write helpers into `src/cli/data-stack/plan/io.ts`
- [x] keep `src/cli/data-stack/plan/index.ts` as the public facade for current imports
- [x] add or update `test/helpers/data-stack-test-utils.ts` with stack-plan builders only if it reduces repeated setup
- [x] split `test/data-stack-plan.test.ts` into `test/data-stack-plan/identity-serialization.test.ts` and `test/data-stack-plan/parse-io.test.ts`
- [x] verify stack-plan tests and the replay tests that consume stack-plan artifacts

Focused verification:

```bash
bun test test/data-stack-plan test/cli-command-data-stack.test.ts
bun run lint
```

### Phase 2: Split Codex report module and tests

- [x] move `src/cli/data-stack/codex-report.ts` to `src/cli/data-stack/codex-report/index.ts`
- [x] extract report constants, patch paths, and interfaces into `src/cli/data-stack/codex-report/types.ts`
- [x] extract patch and recommendation validation into `src/cli/data-stack/codex-report/validation.ts`
- [x] extract fact payload, report artifact creation, serialization, filename generation, and write helpers into `src/cli/data-stack/codex-report/artifact.ts`
- [x] extract accepted and edited recommendation application into `src/cli/data-stack/codex-report/apply.ts`
- [x] preserve recommendation lineage fields and `/input/columns` to `duplicates.uniqueBy` remapping
- [x] keep `src/cli/data-stack/codex-report/index.ts` as the public facade for current imports
- [x] extend `test/helpers/data-stack-test-utils.ts` with Codex-report builders only where assertions stay explicit
- [x] split `test/data-stack-codex-report.test.ts` into `test/data-stack-codex-report/validation.test.ts` and `test/data-stack-codex-report/apply.test.ts`
- [x] verify Codex report tests and direct Codex-assist action coverage

Focused verification:

```bash
bun test test/data-stack-codex-report test/cli-actions-data-stack.test.ts
bun run lint
```

### Phase 3: Split direct data-stack action and tests

- [x] move `src/cli/actions/data-stack.ts` to `src/cli/actions/data-stack/index.ts`
- [x] extract option validation and schema-mode option resolution into `src/cli/actions/data-stack/options.ts`
- [x] extract plan preparation, source fingerprints, artifact collision checks, and plan writing into `src/cli/actions/data-stack/plan-write.ts`
- [x] extract materialized output writing into `src/cli/actions/data-stack/output-write.ts`
- [x] extract dry-run, diagnostics, and Codex-assist summary rendering into `src/cli/actions/data-stack/reporting.ts`
- [x] extract direct action orchestration into `src/cli/actions/data-stack/run.ts`
- [x] preserve exports consumed by `src/cli/actions/index.ts` and interactive stack code
- [x] split `test/cli-actions-data-stack.test.ts` into behavior-owned files:
  - `test/cli-actions-data-stack/happy-paths.test.ts`
  - `test/cli-actions-data-stack/validation.test.ts`
  - `test/cli-actions-data-stack/schema-modes.test.ts`
  - `test/cli-actions-data-stack/dry-run-plan.test.ts`
  - `test/cli-actions-data-stack/codex-assist.test.ts`
- [x] verify direct action tests and command smoke coverage

Focused verification:

```bash
bun test test/cli-actions-data-stack test/cli-command-data-stack.test.ts
bun run lint
```

### Phase 4: Split command-layer stack tests

- [x] split `test/cli-command-data-stack.test.ts` into:
  - `test/cli-command-data-stack/direct-stack.test.ts`
  - `test/cli-command-data-stack/replay.test.ts`
  - `test/cli-command-data-stack/options.test.ts`
- [x] keep direct stack tests focused on direct command execution and materialized outputs
- [x] keep replay tests focused on artifact read, fingerprint drift, output override, duplicate policy, and auto-clean behavior
- [x] keep options tests focused on schema-mode aliases, duplicate policies, input-format options, and command-layer validation
- [x] verify no command-layer coverage was dropped during movement

Focused verification:

```bash
bun test test/cli-command-data-stack
bun run lint
```

### Phase 5: Move stack interactive tests and mocks

- [x] move stack-specific cases out of `test/cli-interactive-routing.test.ts`
- [x] create `test/cli-interactive-data-stack/` for stack-specific interactive tests
- [x] preserve one shared routing smoke case in `test/cli-interactive-routing.test.ts`
- [x] extract stack action mocks from `test/helpers/interactive-harness/mocks/action-data.ts` into `test/helpers/interactive-harness/mocks/action-stack.ts`
- [x] extract query and extract action mocks only if needed to keep the helper split coherent
- [x] keep shared lightweight data preview and conversion mocks in a small shared helper
- [x] verify interactive routing and stack-specific interactive coverage

Focused verification:

```bash
bun test test/cli-interactive-routing.test.ts test/cli-interactive-data-stack
bun run lint
```

### Phase 6: Split interactive data-stack source module

- [x] move `src/cli/interactive/data/stack.ts` to `src/cli/interactive/data/stack/index.ts`
- [x] extract source collection, source-kind detection, input-format selection, pattern, recursion, matched-file review, and source discovery options into `src/cli/interactive/data/stack/source-discovery.ts`
- [x] extract stack review, status preview, bounded samples, and replay-tip rendering into `src/cli/interactive/data/stack/review.ts`
- [x] extract plan path validation, report path persistence, keep/remove prompts, and cleanup into `src/cli/interactive/data/stack/artifacts.ts`
- [x] extract Codex signal detection, recommendation rendering, edited patch parsing, decision collection, and failure fallback into `src/cli/interactive/data/stack/codex-review.ts`
- [x] extract destination selection, preview preparation, final action selection, write execution, revise setup, dry-run only, and failure retention behavior into `src/cli/interactive/data/stack/write-flow.ts`
- [x] extract shared interactive stack types into `src/cli/interactive/data/stack/types.ts`
- [x] keep `runInteractiveDataStack` as the only public entrypoint from `index.ts`
- [x] verify stack interactive tests, direct action tests, and command tests

Focused verification:

```bash
bun test test/cli-interactive-data-stack test/cli-actions-data-stack test/cli-command-data-stack
bun run lint
```

### Phase 7: Final test-structure review and closeout

- [ ] review all moved stack test files for duplicated setup, missing coverage, and confusing grouping
- [ ] compare the new test layout against the original stack coverage list from the research doc
- [ ] run focused stack tests as one group
- [ ] run broader repo validation after the final grouping review passes
- [ ] update this plan checklist and add job records for implementation phases as they land

Focused verification:

```bash
bun test test/data-stack-plan test/data-stack-codex-report test/cli-actions-data-stack test/cli-command-data-stack test/cli-interactive-data-stack
bun run lint
bun run format:check
bun run build
```

## Review Notes

- This plan intentionally starts with the artifact leaf modules before touching action or interactive orchestration.
- The command-layer test split happens before the interactive source split so direct and replay behavior remains easy to audit.
- The final test-structure review is required even though each phase moves its own tests; it is the guard against accidentally creating a scattered or duplicated test surface.
- If any phase requires behavior changes to complete cleanly, stop and draft a separate corrective plan or follow-up rather than hiding behavior changes inside the refactor.
