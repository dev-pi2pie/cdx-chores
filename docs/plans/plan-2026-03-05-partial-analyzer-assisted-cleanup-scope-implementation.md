---
title: "Partial analyzer-assisted cleanup scope implementation"
created-date: 2026-03-05
modified-date: 2026-03-05
status: active
agent: codex
---

## Goal

Implement the partial-scope analyzer-assisted `rename cleanup` interaction so users can select only part of mixed filename families before deterministic cleanup planning, while keeping behavior explicit, deterministic, and review-first.

## Why This Plan

The current analyzer-assisted cleanup path produces one overall suggestion for one overall scope.
The updated research direction now requires:

- interactive-first family selection
- null/default full-scope fallback
- one global deterministic cleanup settings step after family selection
- separate artifact retention decisions for plan CSV and analysis report CSV

This plan converts those decisions into implementation phases and tracking checkpoints.

## Current State

- interactive analyzer-assisted cleanup exists with grouped evidence and one overall suggestion
- grouped analyzer report CSV is optional and advisory
- deterministic cleanup plan/apply path is already implemented
- artifact cleanup behavior for plan CSV versus analyzer report CSV is currently coupled enough to cause retention confusion

## Scope

- add interactive analyzer-family selection before deterministic cleanup settings
- keep analyzer-family values aligned to existing cleanup families:
  - `date`
  - `timestamp`
  - `serial`
  - `uid`
- default family selection to all eligible families selected
- keep deterministic cleanup settings as one global decision across selected groups
- add explicit per-artifact retention prompts for:
  - dry-run/apply plan CSV
  - analyzer report CSV
- preserve analyzer-assisted cleanup as interactive-only in this implementation

## Non-Goals

- adding CLI `--codex-include-hint` / `--codex-exclude-hint` in this pass
- adding analyzer-specific taxonomy such as `screenshot` labels
- splitting analyzer family selection into separate include/exclude step flows in this pass
- per-group deterministic cleanup settings
- regex include/exclude analyzer scope logic
- changing replay semantics of `rename apply`

## Implementation Touchpoints

- `src/cli/interactive/rename-cleanup.ts`
- `src/cli/actions/rename/cleanup-analyzer.ts`
- `src/cli/actions/rename/cleanup-codex.ts`
- `src/cli/actions/rename/cleanup.ts`
- `test/cli-interactive-rename.test.ts`
- focused cleanup/analyzer tests under `test/`
- `docs/guides/rename-common-usage.md`

## Phase Checklist

### Phase 1: Freeze implementation contract from research

- [x] codify interactive-only boundary for partial analyzer scope selection
- [x] codify family value set for scope selection:
  - [x] `date`
  - [x] `timestamp`
  - [x] `serial`
  - [x] `uid`
- [x] codify null/default behavior:
  - [x] no include/exclude narrowing means scan all eligible families
- [x] codify one global deterministic cleanup settings step after family selection
- [x] codify artifact retention as two distinct decisions (plan CSV vs analysis CSV)

### Phase 2: Analyzer-family selection UI

- [x] add one combined multi-select interaction for analyzer families
- [x] default all families selected
- [x] support deselect-to-narrow behavior
- [x] keep grouped analyzer review visible after selection
- [x] ensure selected family set is shown clearly before deterministic settings

### Phase 3: Analyzer evidence and suggestion flow integration

- [x] apply family selection to analyzer-side grouped review scope
- [x] keep Codex suggestion contract unchanged for first pass
- [x] keep fallback to manual settings intact when suggestion is unavailable
- [x] ensure no silent auto-apply of cleanup settings from selected groups

### Phase 4: Deterministic cleanup handoff

- [x] keep one global cleanup hint/style/timestamp-action selection step
- [x] ensure selected analyzer scope does not bypass explicit deterministic settings confirmation
- [x] validate no regressions in existing hint semantics and conflict strategy behavior

### Phase 5: Artifact retention flow

- [ ] implement prompt sequence from research decision matrix:
  - [ ] apply-now prompt
  - [ ] plan CSV keep/remove prompt
  - [ ] analysis CSV keep/remove prompt (when present)
- [ ] ensure apply failure keeps all existing CSV artifacts
- [ ] ensure plan and analysis retention choices can diverge in one run
- [ ] keep prompt defaults aligned with research:
  - [ ] dry-run no-apply: keep plan `Yes`, keep report `Yes`
  - [ ] apply success: keep plan `No`, keep report `Yes`

### Phase 6: Tests

- [ ] add interactive flow coverage for combined family multi-select default/all-selected behavior
- [ ] add coverage for narrowed family selection handoff into grouped review
- [ ] add coverage for retention decisions when:
  - [ ] only plan CSV exists
  - [ ] both plan CSV and analysis CSV exist
  - [ ] apply fails after plan exists
- [ ] keep existing analyzer fallback tests green

### Phase 7: Docs and manual verification

- [ ] update user-facing cleanup guidance for partial analyzer scope behavior
- [ ] document artifact-retention behavior with plan/report split
- [ ] run manual smoke checks in `examples/playground/cleanup-analyzer/`
- [ ] verify dry-run/apply messaging clarity in TTY and non-TTY output

### Phase 8: Completion and follow-up capture

- [ ] mark research decisions implemented or explicitly deferred
- [ ] evaluate deferred-decision revisit triggers from research and record outcome:
  - [ ] CLI include/exclude surface trigger met or not met
  - [ ] explicit exclude-behavior trigger met or not met
- [ ] if a revisit trigger is met, open a separate future plan with narrow scope
- [ ] close implementation plan with verification notes

## Job Record Strategy (Anti-Bloat)

Use one primary execution job record for this plan unless a split is justified.

Recommended primary job record path:

- `docs/plans/jobs/2026-03-05-partial-analyzer-scope-implementation.md`

Create additional job records only when one of these gates is true:

- independent deliverable that can merge separately and needs standalone verification history
- blocked stream that pauses while other streams continue
- ownership split across parallel contributors where one shared log would be ambiguous
- substantial out-of-scope follow-up explicitly deferred from this plan

Otherwise:

- append to the primary job record with dated subsections
- keep one running checklist per phase instead of opening a new job file for each micro-change
- treat doc-only nits and small test follow-ups as updates to the same record

## Success Criteria

- users can narrow analyzer-assisted cleanup scope through one interactive multi-select family step
- default behavior with no narrowing remains full-scope analyzer review
- deterministic cleanup settings remain explicit and global for selected scope
- plan CSV and analysis CSV retention are decided independently in interactive flow
- tests cover selection behavior and artifact retention outcomes without regression

## Verification

- `bunx tsc --noEmit`
- `bun test test/cli-interactive-rename.test.ts test/cli-actions-rename-cleanup-single.test.ts test/cli-actions-rename-cleanup-directory.test.ts`
- `bun test` (full suite before closing the plan)
- manual interactive smoke checks in `examples/playground/cleanup-analyzer/`:
  - combined family multi-select default/all-selected path
  - narrowed family selection path
  - dry-run no-apply retention prompts
  - apply-success retention prompts
  - apply-failure artifact retention behavior

## Related Research

- `docs/researches/research-2026-03-04-partial-analyzer-assisted-cleanup-scope.md`
- `docs/researches/research-2026-03-03-codex-analyzer-assisted-rename-cleanup.md`
- `docs/researches/research-2026-03-03-rename-cleanup-analyzer-report-artifact.md`

## Related Plans

- `docs/plans/plan-2026-03-03-codex-analyzer-assisted-rename-cleanup.md`

## Related Job Record

- `docs/plans/jobs/2026-03-05-partial-analyzer-scope-implementation.md`
