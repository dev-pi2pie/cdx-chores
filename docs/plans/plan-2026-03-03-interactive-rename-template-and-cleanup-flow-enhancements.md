---
title: "Interactive rename template and cleanup flow enhancements"
created-date: 2026-03-03
modified-date: 2026-03-03
status: draft
agent: codex
---

## Goal

Improve interactive rename UX in two focused areas without reopening broader rename docs work yet:

- reduce the custom-template hint surface so it shows only the main placeholder direction plus a very short advanced note
- add the missing interactive `rename cleanup` entry and flow so interactive mode matches the current CLI feature surface

## Why This Plan

The current interactive rename custom-template prompt is carrying too much Route A placeholder detail inline.
That creates a wall of tokens at the exact moment the user needs a short naming hint.

Separately, `rename cleanup` is already implemented in the CLI and documented as completed work, but interactive mode still does not expose it.
That is a feature-surface mismatch, not a backend gap.

These should be handled together because they both live in the interactive rename layer, but they should stay as two distinct implementation tracks:

- copy/hint simplification for the current custom-template entry
- interactive command-surface completion for `rename cleanup`

## Current State

### Custom template prompt

- `src/cli/interactive/rename.ts` uses a plain `@inquirer/prompts` text input for custom rename templates.
- The current message includes the full placeholder family, including Route A explicit timestamp variants.
- The circled example in the current UX is static message text, not a real inline placeholder or ghost hint.
- `{uid}` is not part of the current rename template placeholder contract for `rename file` / `rename batch`.
- Current UID naming belongs only to `rename cleanup` through its `uid` hint family and `--style uid` output behavior.

### Rename cleanup interactive availability

- `src/command.ts` already exposes `rename cleanup <path>`.
- `src/cli/actions/rename/cleanup.ts` already implements the cleanup action.
- `src/cli/interactive/menu.ts` does not list `rename:cleanup`.
- `src/cli/interactive/index.ts` does not dispatch `rename:cleanup`.
- `src/cli/interactive/rename.ts` does not implement a cleanup-specific interactive flow.

## Scope

- update the interactive custom-template prompt copy in `src/cli/interactive/rename.ts`
- decide whether the first pass remains on plain Inquirer input or moves to a TUI-backed input primitive
- add `rename cleanup` to the interactive rename submenu and dispatcher
- implement a new interactive cleanup question flow that maps cleanly onto `actionRenameCleanup(...)`
- add focused tests for interactive menu wiring and any extracted prompt helpers
- document implementation work with job records only after behavior is settled

## Out Of Scope

- broad redesign of the full rename template system
- changing CLI `--pattern` help text in `src/command.ts` unless implementation reveals a clear mismatch
- expanding cleanup v1 semantics beyond the current CLI contract
- reopening cleanup hint-family rules or Route A timestamp placeholder design
- broad docs refresh before the interactive behavior is finalized

## Proposed Design Direction

### Track A: Custom template hint simplification

Preferred first-pass direction:

- keep the prompt short and input-first
- list only the main placeholder directions:
  - `{prefix}`
  - `{timestamp}`
  - `{date}`
  - `{stem}`
  - `{serial}`
- do not imply `{uid}` is available in rename templates yet
- add one very short note that advanced variants and serial parameters are supported
- stop printing the full explicit placeholder inventory inside the prompt body

Recommended example guidance:

- use a short sample such as `{timestamp}-{stem}`
- avoid making the example look like required syntax

### Track A decision boundary: static copy vs real ghost placeholder

There are two implementation levels here:

1. string-only improvement
2. true dimmed inline placeholder / ghost-hint behavior

The current custom-template entry is a normal Inquirer input prompt, so a real inline ghost placeholder is not just a text tweak.
It likely requires moving this prompt onto the project’s newer TUI/custom-input path or adding a narrow reusable prompt primitive for template entry.

Plan rule:

- Phase 1 should first simplify the copy on the current primitive
- Phase 2 may upgrade the prompt to a true inline ghost placeholder only if the implementation remains narrow and does not destabilize other prompts
- Phase 1 should also keep the wording explicit that UID output is a cleanup-only concept for now, not a general template token

### Track B: Interactive rename cleanup flow

Add `rename cleanup` as a first-class interactive rename action.

Recommended flow:

1. target path
2. hint family selection
3. style selection
4. timestamp keep/remove prompt only when `timestamp` is selected
5. recursive toggle when the target is a directory or directory-like path flow is selected
6. directory-only filters as follow-up prompts when relevant
7. dry-run toggle
8. skipped-item preview mode when dry-run is enabled for directory mode
9. optional immediate apply after a successful dry run, reusing `rename apply` behavior where appropriate

Design rules:

- do not ask Codex-related questions because cleanup is deterministic-only in v1
- keep hint selection explicit; do not infer or auto-select hints
- keep file-mode prompts smaller than directory-mode prompts
- preserve existing validation behavior from `actionRenameCleanup(...)`

## Open UX Decisions

### Cleanup hint selection primitive

Need to choose between:

- multi-select checklist
- repeatable single-select loop
- comma-separated text input

Recommended default:

- use a checkbox-style multi-select if the current prompt stack supports it cleanly
- otherwise use a controlled repeatable loop rather than raw comma-typed input

Reason:

- cleanup hints are a small fixed set
- explicit selection is clearer than typing mini-syntax in interactive mode

### Directory/file branching

Need to decide whether interactive mode asks the user up front:

- “file or directory?”

or whether it should:

- inspect the target path after entry and branch automatically

Recommended default:

- keep path-first entry, then branch from the resolved target type

Reason:

- this matches the existing CLI contract
- it avoids duplicating the path question

### Ghost placeholder upgrade threshold

The real inline placeholder enhancement should proceed only if:

- it can be isolated to one reusable prompt helper
- it does not require a broad rewrite of interactive rename prompts
- it keeps fallback behavior predictable in non-ideal terminals

If those conditions are not met, the first implementation should stop at simplified prompt copy.

## Implementation Shape

Potential touchpoints:

- `src/cli/interactive/menu.ts`
- `src/cli/interactive/index.ts`
- `src/cli/interactive/rename.ts`
- `src/cli/actions/index.ts`
- `src/cli/actions/rename/cleanup.ts`
- `src/cli/tui/` helpers if the ghost-placeholder upgrade proceeds
- focused tests under `test/`

Possible extraction boundary:

- extract rename-template prompt copy/config into a small helper so text changes and prompt-primitive changes are not mixed into the main action handler
- extract cleanup interactive prompting into a dedicated helper if the branch becomes large enough

## Phase Checklist

### Phase 1: Freeze interactive UX targets

- [ ] confirm the reduced custom-template hint wording
- [ ] confirm the short advanced-note wording
- [ ] confirm whether the example should be:
  - [ ] static help text only
  - [ ] or a true ghost placeholder target for a later phase
- [ ] confirm the interactive cleanup prompt order
- [ ] confirm the cleanup hint selection primitive
- [ ] confirm whether immediate apply should be offered after dry-run cleanup previews

### Phase 2: Interactive rename cleanup wiring

- [ ] add `rename:cleanup` to `src/cli/interactive/menu.ts`
- [ ] update interactive action typing to include the new rename action
- [ ] dispatch `rename:cleanup` in `src/cli/interactive/index.ts`
- [ ] implement the cleanup interactive flow in `src/cli/interactive/rename.ts`
- [ ] map interactive answers into `actionRenameCleanup(...)`
- [ ] keep file-vs-directory behavior aligned with the existing cleanup action validation rules

### Phase 3: Custom-template hint simplification

- [ ] replace the long placeholder inventory with a short primary-placeholder hint
- [ ] add a very short note for advanced variants and params
- [ ] ensure the prompt remains readable in narrow terminals
- [ ] keep existing rename-template behavior unchanged

### Phase 4: Optional ghost-placeholder enhancement

- [ ] evaluate whether the custom-template prompt should move to a TUI/custom-input primitive
- [ ] if yes, implement a narrow reusable prompt helper with dimmed placeholder/ghost behavior
- [ ] preserve simple fallback behavior if terminal capabilities are limited
- [ ] avoid changing unrelated interactive prompts in the same pass

### Phase 5: Tests and verification

- [ ] add or update tests for interactive menu wiring
- [ ] add focused tests for cleanup interactive dispatch and answer mapping
- [ ] add prompt-helper tests if extraction occurs
- [ ] run verification:
  - [ ] `bunx tsc --noEmit`
  - [ ] targeted `bun test ...`
  - [ ] manual interactive smoke checks for:
    - [ ] rename batch custom-template prompt readability
    - [ ] rename file custom-template prompt readability
    - [ ] rename cleanup file flow
    - [ ] rename cleanup directory dry-run flow

## Completion Criteria

- interactive rename custom-template guidance is short enough to scan quickly
- the prompt still signals that advanced variants/params exist without listing every token inline
- interactive mode exposes `rename cleanup` alongside the other rename actions
- the cleanup interactive flow covers the current v1 CLI contract without adding new semantics
- any real ghost-placeholder upgrade is either implemented narrowly and stably, or explicitly deferred without blocking the rest of the work

## Related Plans

- `docs/plans/plan-2026-03-03-rename-cleanup-v1-implementation.md`
- `docs/plans/plan-2026-03-02-cli-tui-foundation-and-path-inline-refactor.md`
- `docs/plans/plan-2026-03-02-interactive-path-sibling-navigation-and-ghost-preview.md`
- `docs/plans/plan-2026-03-01-rename-timestamp-format-route-a-and-guides.md`

## Related Research

- `docs/researches/research-2026-03-02-rename-cleanup-subcommand-and-pattern-hints.md`
- `docs/researches/research-2026-02-28-interactive-path-ghost-hint-and-sibling-navigation-ux.md`
- `docs/researches/research-2026-03-01-rename-timestamp-format-and-template-ux.md`
