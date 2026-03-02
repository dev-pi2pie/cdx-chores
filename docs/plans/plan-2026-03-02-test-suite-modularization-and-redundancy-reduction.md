---
title: "Test suite modularization and redundancy reduction"
created-date: 2026-03-02
modified-date: 2026-03-02
status: active
agent: codex
---

## Goal

Reduce redundant test coverage, split oversized test files by responsibility, and refactor the rename action implementation so the test suite can grow without concentrating more behavior in a small number of large files.

## Why This Plan

The current audit shows two related problems:

- the rename workflow is concentrated in both source and tests
- some behaviors are asserted at both the helper/unit layer and the higher action/controller layer

The main concentration points are:

- `src/cli/actions/rename.ts` at 1180 lines
- `test/cli-actions-rename-batch-core.test.ts` at 684 lines
- `test/cli-actions-rename-apply.test.ts` at 601 lines
- `test/cli-actions-rename-file.test.ts` at 413 lines
- `test/cli-path-inline.test.ts` at 437 lines

There is already useful lower-level coverage in:

- `test/cli-rename-preview.test.ts`
- `test/cli-path-inline-state.test.ts`
- `test/cli-path-sibling-preview.test.ts`
- `test/cli-path-suggestions.test.ts`

That lower-level coverage is good, but some controller/action files are still rechecking the same contracts. The work should reduce overlap without weakening confidence at the user-facing flow level.

## Reviewed Findings To Turn Into Task Items

1. Preview composition is tested both directly and again through `actionRenameBatch`.
2. Inline path prompt behavior is tested at both the state/helper level and again through the full prompt controller.
3. `test/cli-actions-rename-apply.test.ts` is heavy mostly because it mixes replay flow coverage with many CSV validation cases.
4. `src/cli/actions/rename.ts` is still the main implementation bottleneck and should be split before additional rename test growth.

## User Experience Targets

- rename batch and rename file behavior must remain unchanged
- replayable rename plan CSV behavior must remain unchanged
- prompt path inline behavior must remain unchanged
- test intent should become easier to scan by reading file names alone
- lower-level unit tests should carry algorithm/formatter/state confidence
- higher-level action/controller tests should keep only the contracts that matter end to end

## In Scope

### Test suite compaction

- trim or merge redundant assertions where the same contract is already covered at a lower layer
- split oversized test files by behavior area
- preserve at least one end-to-end assertion per user-visible behavior family

### Rename workflow modularization

- split `src/cli/actions/rename.ts` into smaller implementation units
- extract shared reporting, Codex orchestration, and CSV-plan concerns where practical
- align file boundaries with the new test boundaries where possible

### Verification and docs

- rerun relevant tests after each phase
- keep traceability between the research audit and the implementation work

## Out of Scope

- changing rename CLI semantics
- removing lower-level unit coverage in favor of action-only testing
- broad non-rename command refactors
- changing prompt UX or prompt key bindings
- weakening validation to make tests easier to rewrite

## Target File Shape

Recommended test target structure:

```text
test/
  cli-actions-rename-batch-core.test.ts            # keep only core smoke/integration coverage
  cli-actions-rename-batch-filters.test.ts
  cli-actions-rename-batch-recursion.test.ts
  cli-actions-rename-batch-preview.test.ts
  cli-actions-rename-apply-replay.test.ts
  cli-actions-rename-apply-validation.test.ts
```

Recommended source target structure:

```text
src/cli/actions/
  rename.ts                         # keep public action exports thin
  rename-batch.ts                   # batch action orchestration
  rename-file.ts                    # single-file action orchestration
  rename-filters.ts                 # batch filter/profile/regex/extension helpers
  rename-reporting.ts               # preview/summary printing helpers
  rename-codex.ts                   # codex analyzer orchestration helpers
  rename-plan-output.ts             # plan csv row building/writing helpers
```

Notes:

- `actionRenameApply()` is already a very thin wrapper today, so it does not need its own tiny module by default.
- If apply-related logic is moved, prefer grouping it with CSV plan helpers rather than extracting a trivially small `rename-apply.ts`.
- The exact filenames can change during implementation if a simpler boundary emerges, but the end state should remove the current single-file concentration.

## Phases

## Phase 1: Establish safe compaction boundaries

### Task Items

- [ ] map each large test file to the exact behavior families it owns today
- [ ] mark which behaviors already have direct lower-level coverage and should not be asserted repeatedly at the action/controller layer
- [ ] define the minimum action-level smoke coverage to keep for:
  - [ ] rename batch preview output
  - [ ] rename apply replay flow
  - [ ] path inline controller lifecycle
- [ ] produce a literal keep/move/remove decision matrix with one row per existing test case in each heavy file and columns for:
  - [ ] keep in place
  - [ ] move to target file
  - [ ] merge into another case
  - [ ] remove because covered by another test
- [ ] record which tests are duplicate-in-spirit versus merely heavy but still distinct
- [ ] confirm the planned splits do not leave any user-visible contract with only one brittle assertion path
- [ ] explicitly map timestamp and serial-order coverage to its intended long-term file home

### Findings Addressed

- [ ] preview behavior is tested both in `test/cli-rename-preview.test.ts` and `test/cli-actions-rename-batch-core.test.ts`
- [ ] path inline behavior is tested both in helper/state files and in `test/cli-path-inline.test.ts`

### Phase Deliverable

- [ ] a literal keep/move/remove matrix for each heavy test file, including timestamp and serial coverage ownership

## Phase 2: Split and compact rename batch tests

### Task Items

- [ ] split `test/cli-actions-rename-batch-core.test.ts` by responsibility
- [ ] move recursion and symlink coverage into `test/cli-actions-rename-batch-recursion.test.ts`
- [ ] move regex, extension, and profile filter coverage into `test/cli-actions-rename-batch-filters.test.ts`
- [ ] move compact preview and skipped-detail output coverage into `test/cli-actions-rename-batch-preview.test.ts`
- [ ] keep `test/cli-actions-rename-batch-core.test.ts` focused on:
  - [ ] dry-run happy path
  - [ ] apply happy path
  - [ ] empty-directory behavior
  - [ ] one representative preview/reporting integration assertion
- [ ] decide explicitly whether timestamp and serial-order batch assertions should:
  - [ ] stay in `test/cli-actions-rename-batch-core.test.ts` as small core coverage
  - [ ] move into `test/cli-actions-rename-timestamp.test.ts`
- [ ] remove or merge repetitive preview assertions that are already guaranteed by `test/cli-rename-preview.test.ts`

### Findings Addressed

- [ ] `test/cli-actions-rename-batch-core.test.ts` is too large and currently mixes unrelated concerns
- [ ] compact truncation, changed-row preference, and skipped-detail rendering are already covered directly in `test/cli-rename-preview.test.ts`

### Phase Deliverable

- [ ] batch rename tests are separated by behavior area and the old mixed bucket is materially smaller

## Phase 3: Split rename apply replay vs validation coverage

### Task Items

- [ ] split `test/cli-actions-rename-apply.test.ts` into replay-focused and validation-focused files
- [ ] keep dry-run CSV generation, replay apply, and auto-clean coverage together in `test/cli-actions-rename-apply-replay.test.ts`
- [ ] move CSV schema and row validation failures into `test/cli-actions-rename-apply-validation.test.ts`
- [ ] factor shared CSV row/header fixture builders into a small helper if both new files need them
- [ ] ensure lenient inspection-read coverage remains explicit and is not lost during the split

### Findings Addressed

- [ ] `test/cli-actions-rename-apply.test.ts` is heavy due to mixed responsibilities more than true redundancy

### Phase Deliverable

- [ ] rename apply tests clearly separate success-path replay behavior from validation behavior

## Phase 4: Modularize rename action implementation

### Priority Note

- [ ] treat this as higher priority than path inline test compaction because it addresses the main 1180-line source hotspot

### Task Items

- [ ] extract batch-specific orchestration from `src/cli/actions/rename.ts`
- [ ] extract single-file orchestration from `src/cli/actions/rename.ts`
- [ ] extract shared batch filter/profile/regex/extension normalization helpers into:
  - [ ] `src/cli/actions/rename-filters.ts`
  - [ ] or a clearly bounded section of `rename-batch.ts`
- [ ] extract shared dry-run/report printing helpers
- [ ] extract Codex analyzer orchestration helpers shared by batch and file flows
- [ ] extract rename plan CSV row creation and output helpers if that boundary reduces duplication
- [ ] keep `src/cli/actions/rename.ts` as a thin public surface or compatibility layer if needed
- [ ] keep `actionRenameApply()` in the thin surface layer unless a larger plan/csv module makes grouping more coherent
- [ ] preserve all current option handling and messaging semantics through focused tests

### Findings Addressed

- [ ] `src/cli/actions/rename.ts` remains the main implementation hotspot and the current test concentration mirrors that source concentration
- [ ] filter/profile/regex/extension helpers currently lack an explicit target extraction boundary in the original plan

### Phase Deliverable

- [ ] rename actions are split into smaller modules with clearer ownership and a thinner top-level entry file

## Phase 5: Reduce path inline controller duplication

### Priority Note

- [ ] keep this phase behind rename batch/apply compaction and source modularization unless fresh evidence shows larger overlap than the current audit suggests

### Task Items

- [ ] review `test/cli-path-inline.test.ts` line by line against:
  - [ ] `test/cli-path-inline-state.test.ts`
  - [ ] `test/cli-path-sibling-preview.test.ts`
  - [ ] `test/cli-path-suggestions.test.ts`
- [ ] keep controller-level assertions only where the full prompt wiring matters
- [ ] preserve controller tests for:
  - [ ] raw-session lifecycle and teardown
  - [ ] direct key handling integration
  - [ ] late async suggestion resolution not repainting after settle
  - [ ] one sibling-preview end-to-end flow
- [ ] merge or remove controller tests that mainly restate lower-level state transition contracts
- [ ] confirm prompt coverage still spans ghost text, tab cycle, parent navigation, abort, and async-race safety

### Findings Addressed

- [ ] `test/cli-path-inline.test.ts` currently duplicates part of the behavior already covered in lower-level path prompt files

### Phase Deliverable

- [ ] path inline controller tests remain integration-focused instead of repeating helper/state contracts

## Phase 6: Verification, docs, and cleanup

### Task Items

- [ ] rerun focused tests after each split or extraction step
- [ ] run the full test suite after the refactor settles
- [ ] update or add job records for concrete implementation passes
- [ ] update this plan with `modified-date` when implementation materially changes its scope or sequencing
- [ ] confirm no audit-backed task item was dropped silently during execution

### Phase Deliverable

- [ ] the refactor lands with preserved behavior, smaller files, and traceable documentation

## Verification Plan

### Functional checks

- [ ] `bun test test/cli-rename-preview.test.ts`
- [ ] `bun test test/cli-actions-rename-batch-core.test.ts`
- [ ] `bun test test/cli-actions-rename-batch-filters.test.ts`
- [ ] `bun test test/cli-actions-rename-batch-recursion.test.ts`
- [ ] `bun test test/cli-actions-rename-batch-preview.test.ts`
- [ ] `bun test test/cli-actions-rename-apply-replay.test.ts`
- [ ] `bun test test/cli-actions-rename-apply-validation.test.ts`
- [ ] `bun test test/cli-actions-rename-timestamp.test.ts`
- [ ] `bun test test/cli-path-inline.test.ts`
- [ ] `bun test test/cli-path-inline-state.test.ts`
- [ ] `bun test test/cli-path-sibling-preview.test.ts`
- [ ] `bun test test/cli-path-suggestions.test.ts`

### Structural checks

- [ ] no new oversized mixed-responsibility test bucket replaces the current ones
- [ ] `src/cli/actions/rename.ts` is materially smaller than 1180 lines
- [ ] each new test file name reflects a single behavior area

### Quality checks

- [ ] `bun test`
- [ ] `bunx tsc --noEmit`
- [ ] `bunx oxlint --tsconfig tsconfig.json src test scripts`

## Risks and Mitigations

- Risk: compaction removes a useful end-to-end assertion and makes regressions easier to miss.
  - Mitigation: keep one representative controller/action-level check per user-visible contract.
- Risk: test splitting increases helper indirection and makes fixtures harder to follow.
  - Mitigation: extract only small, obvious helpers and keep scenario setup close to the tests that use it.
- Risk: source modularization changes output wording or option precedence by accident.
  - Mitigation: preserve current high-level action tests before trimming duplicates and rerun them after each extraction.
- Risk: a new file layout mirrors proposed boundaries but not real code ownership.
  - Mitigation: prefer smaller practical extractions over forcing the exact suggested filenames.

## Execution Note

- Prefer landing the work in phase-sized commits where practical, especially after Phase 2, Phase 3, and Phase 4, so any split or extraction pass can be reverted independently if review or verification finds a regression.

## Deliverables

- smaller, more focused rename-related test files
- reduced duplicate coverage between unit/helper and action/controller layers
- a modularized rename action implementation with clearer boundaries
- updated documentation linking the audit findings to concrete execution work

## Related Research

- `docs/researches/research-2026-03-02-test-suite-audit.md`
