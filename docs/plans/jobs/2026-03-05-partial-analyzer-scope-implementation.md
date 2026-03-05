---
title: "Partial analyzer scope implementation"
created-date: 2026-03-05
modified-date: 2026-03-05
status: in-progress
agent: codex
---

## Goal

Implement Phase 1 through Phase 6 of `docs/plans/plan-2026-03-05-partial-analyzer-assisted-cleanup-scope-implementation.md`.

## Phase Slice

- Phase 1: Freeze implementation contract from research
- Phase 2: Analyzer-family selection UI
- Phase 3: Analyzer evidence and suggestion flow integration
- Phase 4: Deterministic cleanup handoff
- Phase 5: Artifact retention flow
- Phase 6: Tests

## What Changed

- added an analyzer-family multi-select prompt in interactive cleanup:
  - `Analyzer families to focus on (all selected by default)`
- set default analyzer-family selection to all cleanup families:
  - `timestamp`, `date`, `serial`, `uid`
- implemented null/default full-scope fallback when the multi-select result is empty
- wired selected analyzer families into analyzer suggestion flow input handling
- added grouped analyzer review output before Codex suggestion:
  - grouped pattern
  - count
  - representative examples
- printed selected analyzer family set before deterministic cleanup settings handoff
- updated interactive test harness to mock `checkbox` prompts
- updated interactive rename tests for analyzer-assisted cleanup to include checkbox flow coverage
- narrowed analyzer evidence before Codex suggestion by selected families:
  - narrowed grouped patterns
  - narrowed sampled examples shown to Codex
- added explicit fallback to manual cleanup settings when selected analyzer families match no grouped patterns
- added interactive coverage for:
  - narrowed-evidence Codex handoff
  - no-matching-group fallback without issuing a Codex suggestion request
- made deterministic cleanup confirmation explicit in analyzer-assisted flow:
  - print `Deterministic cleanup settings (global)` before confirmation
  - changed prompt to `Use these as deterministic cleanup settings?`
- validated no regressions in existing cleanup hint semantics and conflict-strategy behavior with targeted cleanup suites
- implemented split artifact retention flow for dry-run cleanup:
  - no-apply path prompts:
    - `Keep dry-run plan CSV for later \`rename apply\`?`
    - `Keep cleanup analysis report CSV?` (when present)
  - apply-success path prompts:
    - `Keep applied plan CSV?`
    - `Keep cleanup analysis report CSV?` (when present)
- removed interactive auto-clean coupling for plan/report artifacts after apply by applying with `autoClean: false` and handling retention explicitly
- ensured apply failure skips retention deletion prompts and leaves existing artifacts untouched
- added interactive coverage for artifact-retention outcomes:
  - only plan CSV exists
  - both plan and analysis CSV exist with independent keep/remove decisions
  - apply failure after plan generation

## Verification

- `bunx tsc --noEmit`
- `bun test test/cli-interactive-rename.test.ts`
- `bun test test/cli-actions-rename-cleanup-analyzer.test.ts test/cli-actions-rename-cleanup-codex.test.ts`
- `bun test test/cli-actions-rename-cleanup-single.test.ts test/cli-actions-rename-cleanup-directory.test.ts test/cli-actions-rename-cleanup-validation.test.ts test/cli-command-rename-cleanup.test.ts`

## Related Plans

- `docs/plans/plan-2026-03-05-partial-analyzer-assisted-cleanup-scope-implementation.md`

## Related Research

- `docs/researches/research-2026-03-04-partial-analyzer-assisted-cleanup-scope.md`
