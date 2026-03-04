---
title: "Interactive rename template and cleanup flow enhancements"
created-date: 2026-03-03
modified-date: 2026-03-04
status: completed
agent: codex
---

## Historical Note

This completed plan intentionally kept `{uid}` out of general rename templates while cleanup semantics were still being stabilized.

Follow-up doc review now treats that as a temporary implementation gap rather than a preferred steady-state boundary, because `rename cleanup` already established a reusable deterministic `uid-<token>` shape.

## Goal

Improve interactive rename UX and cleanup command clarity in four focused areas without reopening a full cleanup-command redesign:

- reduce the custom-template hint surface so it shows only the main placeholder direction plus a very short advanced note
- add the missing interactive `rename cleanup` entry and flow so interactive mode matches the current CLI feature surface
- keep `rename cleanup` path-first with automatic file/directory detection while making file-candidate filtering clearer and planning the future Codex-assisted cleanup direction
- clarify the cleanup option surface so styling, fragment matching, and conflict handling do not blur together

## Why This Plan

The current interactive rename custom-template prompt is carrying too much Route A placeholder detail inline.
That creates a wall of tokens at the exact moment the user needs a short naming hint.

Separately, `rename cleanup` is already implemented in the CLI and documented as completed work, but interactive mode still does not expose it.
That is a feature-surface mismatch, not a backend gap.

These should be handled together because they both live in the interactive rename layer, but they should stay as two distinct implementation tracks:

- copy/hint simplification for the current custom-template entry
- interactive command-surface completion for `rename cleanup`
- follow-up UX/design work for auto-detect clarity, conflict handling, and analyzer-assisted cleanup suggestion

## Current State

### Custom template prompt

- `src/cli/interactive/rename.ts` uses a plain `@inquirer/prompts` text input for custom rename templates.
- The current message includes the full placeholder family, including Route A explicit timestamp variants.
- The circled example in the current UX is static message text, not a real inline placeholder or ghost hint.
- `{uid}` is not part of the current rename template placeholder contract for `rename file` / `rename batch`.
- Current UID cleanup belongs only to `rename cleanup` through its `uid` hint family.

### Rename cleanup interactive availability

- `src/command.ts` already exposes `rename cleanup <path>`.
- `src/cli/actions/rename/cleanup.ts` already implements the cleanup action.
- cleanup mode is already auto-detected from the resolved target path rather than chosen up front.
- the action resolves file vs directory from the path itself.
- interactive mode now shares the action-side path-kind resolver.
- directory-scope filter prompts are really file-candidate filters, but the current wording can make them sound like a mode toggle.
- Codex-assisted cleanup pattern analysis is still intentionally absent from v1.
- cleanup fragment-removal semantics are now implemented for `serial` and `uid`:
  - `serial` removes only the matched serial fragment
  - `uid` removes only the matched `uid-<token>` fragment while preserving surrounding text
  - cleanup output styling is now limited to `preserve` and `slug`
- directory cleanup conflicts currently stay on the strict-skip path with reason `target conflict`
- there is no explicit cleanup conflict policy option yet
- `--style` is now much narrower in practice, but the docs should state that boundary more directly

## Scope

- update the interactive custom-template prompt copy in `src/cli/interactive/rename.ts`
- decide whether the first pass remains on plain Inquirer input or moves to a TUI-backed input primitive
- add `rename cleanup` to the interactive rename submenu and dispatcher
- implement a new interactive cleanup question flow that maps cleanly onto `actionRenameCleanup(...)`
- refine auto-detect messaging so cleanup stays path-first without asking the user to choose file vs batch mode
- clarify that cleanup filters are file-selection controls, not mode-selection controls
- clarify that cleanup `--style` formats surviving text only and does not own conflict handling
- define the next cleanup conflict-policy surface before implementation starts
- implement `--conflict-strategy` for cleanup without overloading `--style`
- re-check cleanup doc status, wording, and scope markers after the option-surface changes
- plan the future Codex analyzer-assisted cleanup direction without mixing it into the deterministic v1 behavior
- revise cleanup semantics so hint-driven cleanup removes only the matched fragment and does not rewrite unrelated basename parts
- add focused tests for interactive menu wiring and any extracted prompt helpers
- document implementation work with job records only after behavior is settled

## Out Of Scope

- broad redesign of the full rename template system
- replacing the CLI `rename cleanup <path>` contract with separate `file` / `batch` cleanup subcommands in this plan
- changing CLI `--pattern` help text in `src/command.ts` unless implementation reveals a clear mismatch
- expanding cleanup v1 semantics beyond the current CLI contract
- reopening cleanup hint-family rules or Route A timestamp placeholder design
- broad docs refresh before the interactive behavior is finalized

## New Cleanup Semantics Direction

The cleanup semantics direction now follows one principle:

- a cleanup hint removes only the matched cleanup fragment and does not rewrite unrelated basename text

Concrete direction:

- `serial` hint should remove only the matched serial fragment
- `serial` cleanup should not preserve or re-emit the matched serial in normalized form
- `uid` handling should remove only the matched `uid-<token>` fragment
- `uid` cleanup should not remove surrounding prefix or suffix text
- whole-basename `uid-<token>` replacement should remain out of scope unless it returns later as a separately named behavior
- hot-fix scope should update matcher logic, planner outcomes, tests, and user-facing docs together so the new semantics are documented as one coherent contract

## Proposed Design Direction

### Cleanup option axes

Cleanup should keep its option surface explicit and non-overlapping:

- `--hint` selects which fragment families are detected and cleaned
- `--style` formats only the surviving basename text after cleanup matching
- `--timestamp-action` modifies timestamp cleanup behavior only when timestamp cleanup is active
- `--conflict-strategy` should become the explicit collision-policy axis when added, and it should apply only to collided targets

Contract rule:

- do not overload `--style` with conflict handling or whole-basename replacement behavior

### Track A: Custom template hint simplification

Preferred first-pass direction:

- keep the prompt short and input-first
- list only the main placeholder directions:
  - `{prefix}`
  - `{timestamp}`
  - `{date}`
  - `{stem}`
  - `{serial}`
- do not imply `{uid}` is available in rename templates in this phase; follow-up template work should add it once the shared UID contract is lifted out of cleanup-only behavior
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

### Track B.1: Auto-detect clarity without a mode picker

The command should remain path-first and auto-detected.
Interactive mode should not ask the user to choose `file` vs `batch` / `directory` up front.

Recommended direction:

- keep one target-path prompt
- resolve the entered path to file vs directory automatically
- branch prompts from the detected target kind
- phrase follow-up filters as file-candidate filtering, not as directory-mode configuration
- omit the filter-entry prompt entirely for single-file targets

Implementation note:

- path-kind resolution is now shared between the cleanup action and interactive mode
- later UX work can build on the shared resolver without adding a mode picker

### Track B.2: Cleanup fragment-removal semantics

Cleanup should behave as fragment cleanup, not broad basename rewriting.

Recommended direction:

- `serial` removes the matched trailing serial fragment and keeps the remaining basename text
- `uid` removes the matched `uid-<token>` fragment and keeps both surviving prefix and suffix text
- cleanup output styling remains `preserve` or `slug` over the surviving text after fragment removal
- `preserve` and `slug` remain the relevant styles for surviving text after fragment removal
- conflict handling stays in the planner layer after fragment removal

Examples:

- `app-00001.log` with hint `serial` should become `app.log`
- `report uid-7k3m9q2x4t final.txt` with hint `uid` should become `report final.txt`

Non-goals:

- do not silently invent new replacement tokens when the chosen hint is meant to remove a fragment
- do not collapse cleanup into a whole-basename replacement unless that is a separate explicitly named style later

### Track B.3: Cleanup conflict strategy

Cleanup conflict handling should become an explicit option surface instead of staying implicit inside planner behavior.

Current behavior:

- directory cleanup skips conflicting targets with reason `target conflict`
- this includes same-run collisions, unchanged-target collisions, and existing-path collisions

Recommended direction:

- keep strict skip as the default behavior
- introduce a separate `--conflict-strategy` option instead of expanding `--style`
- apply conflict strategy only when the preferred cleaned target actually collides
- keep the first non-conflicting winner on the clean unsuffixed basename
- treat suffix-based collision resolution as explicit opt-in behavior

First-pass shape:

- `--conflict-strategy skip` preserves current behavior
- `--conflict-strategy number` appends increasing numeric suffixes such as `-1`, `-2`, `-3`
- `--conflict-strategy uid-suffix` appends `-uid-<token>` only for collided targets

Naming rule:

- do not use bare `uid` as a conflict-strategy name, because `uid` already names a cleanup hint family

Non-goals:

- do not silently resolve directory cleanup collisions behind the user’s back
- do not make `slug` imply collision suffixing
- do not mix conflict-strategy work with the Codex-assisted cleanup feature

### Track C: Codex analyzer-assisted cleanup suggestion

This is a future direction, not current v1 behavior.

Desired role:

- inspect filename examples
- suggest likely cleanup hints or cleanup patterns
- keep the final cleanup action explicit and confirmable by the user

Recommended first implementation boundary:

- start with filename-list analysis only
- do not read file contents in the first analyzer-assisted cleanup pass
- send a bounded set of current filenames, ideally pre-grouped or sampled locally first
- ask Codex for structured cleanup suggestions, not open-ended prose only

Non-goals:

- do not silently infer and apply cleanup rules without review
- do not blur deterministic cleanup and analyzer suggestion into one opaque step

Likely interaction shape:

- keep deterministic cleanup as the default path
- add a separate interactive analyzer-assisted branch or suggestion step
- treat analyzer output as recommendation, not authority

Suggested analyzer result shape:

- recommended hints
- recommended style
- recommended timestamp action when applicable
- confidence
- short reasoning summary

Suggested first interactive wording:

- `Suggest cleanup hints with Codex?`

If accepted:

- collect a bounded filename sample from the current scope
- request structured suggestions from Codex
- show the suggestion summary
- let the user accept or edit the proposed cleanup settings before running deterministic cleanup

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

### Auto-detect presentation

Need to decide how clearly interactive mode should surface the detected target kind after path entry.

Recommended default:

- keep auto-detect silent if the subsequent prompts make the mode obvious
- otherwise add a short detected-kind confirmation line rather than a full mode-selection question

Reason:

- the user asked for auto-detect, not another level of menu choice
- the real clarity problem is prompt wording, not the absence of a mode selector

### Cleanup filter wording

The current concept is file-based filtering, even in directory mode.

Recommended default:

- replace wording like `Add directory filters?`
- prefer wording like:
  - `Filter files before cleanup?`
  - or `Limit which files are included?`
- do not show this prompt at all for file targets

Reason:

- filters operate on candidate files
- they do not define the cleanup mode itself

### Cleanup fragment semantics

Resolved direction:

- remove only the matched fragment for `serial` and `uid`
- keep unrelated prefix/suffix text intact
- continue applying `preserve` / `slug` only to the surviving text, not to a freshly synthesized basename

Reason:

- this better matches the mental model of "cleanup"
- it avoids surprising whole-name replacement behavior on ordinary logs and mixed filenames

### Cleanup conflict strategy naming

Need to decide the first public cleanup conflict-policy contract.

Recommended default:

- add `--conflict-strategy` as a collision-only axis
- use `skip` as the default
- plan for `number` and `uid-suffix` as the first real additional options

Reason:

- current `target conflict` skipping is already safe and deterministic
- a one-option selector is awkward in interactive mode
- the option is easier to understand once it has real choices
- it keeps collision policy separate from cleanup matching and text styling

### Codex analyzer-assisted trigger surface

Need to decide where analyzer-assisted cleanup belongs in interactive mode.

Recommended default:

- keep it out of the main deterministic prompt path until the contract is clearer
- evaluate either:
  - a separate `analyze cleanup pattern` branch under cleanup
  - or an optional `suggest hints with Codex` step before manual hint selection

Reason:

- this is a meaningful product/design expansion
- it should not be hidden inside the normal deterministic cleanup flow

### Analyzer input scope

Need to decide what data is sent to Codex for cleanup suggestion.

Recommended default:

- send filename lists only in the first pass
- do not send file contents in the first pass
- use bounded sampling and local grouping to avoid large noisy payloads

Reason:

- cleanup intent is primarily inferred from filename patterns
- this keeps cost, privacy exposure, and implementation complexity lower
- it also makes the analyzer-assisted path easier to explain and review

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

- [x] confirm the reduced custom-template hint wording
- [x] confirm the short advanced-note wording
- [x] confirm whether the example should be:
  - [x] static help text only
  - [ ] or a true ghost placeholder target for a later phase
- [x] confirm the interactive cleanup prompt order
- [x] confirm the cleanup hint selection primitive
- [x] confirm whether immediate apply should be offered after dry-run cleanup previews

### Phase 2: Interactive rename cleanup wiring

- [x] add `rename:cleanup` to `src/cli/interactive/menu.ts`
- [x] update interactive action typing to include the new rename action
- [x] dispatch `rename:cleanup` in `src/cli/interactive/index.ts`
- [x] implement the cleanup interactive flow in `src/cli/interactive/rename.ts`
- [x] map interactive answers into `actionRenameCleanup(...)`
- [x] keep file-vs-directory behavior aligned with the existing cleanup action validation rules

### Phase 2.1: Auto-detect cleanup follow-up

- [x] audit the current path-kind auto-detect logic across:
  - [x] `src/cli/actions/rename/cleanup.ts`
  - [x] `src/cli/interactive/rename.ts`
- [x] decide whether to centralize path-kind resolution or keep a narrow interactive mirror
- [x] keep cleanup path-first with no explicit mode-selection prompt
- [x] revise interactive wording so filters are clearly file-candidate filters
- [x] omit file-filter prompts entirely for single-file cleanup targets
- [x] confirm after implementation/manual checks that no extra detected-kind confirmation is needed right now

### Phase 2.1b: Cleanup semantics follow-up

- [x] revise `serial` cleanup so it removes only the matched serial fragment
- [x] revise `uid` cleanup so it removes only the matched `uid-<token>` fragment and preserves surrounding text
- [x] remove the current whole-basename cleanup `uid` style behavior from the cleanup flow
- [x] keep `preserve` / `slug` as styling over the surviving basename text rather than as whole-name replacement for these hints
- [x] add focused regression coverage for log-style names such as `app-00001.log`
- [x] add focused regression coverage for mixed-prefix/suffix UID names such as `report uid-7k3m9q2x4t final.txt`
- [x] update cleanup docs and examples so they no longer describe `uid-<token>` whole-basename output as current behavior

### Phase 2.1c: Cleanup option-surface and conflict-policy contract

- [x] document that cleanup `--style` formats only surviving text after fragment cleanup
- [x] document current directory cleanup collision behavior as strict skip with `target conflict`
- [x] define `--conflict-strategy` as a collision-only option surface rather than a whole-output rewrite surface
- [x] define `skip`, `number`, and `uid-suffix` as the intended real strategy set
- [x] decide that conflict strategy should apply only to collided targets and leave the first winner on the clean basename
- [x] update interactive wording and prompt planning so conflict handling is treated as a separate axis from style
- [x] update user-facing docs before implementation so the cleanup path is explicit

### Phase 2.1d: Cleanup conflict-strategy implementation

- [x] add `--conflict-strategy <value>` to `src/command.ts`
- [x] parse and validate cleanup conflict-strategy values in the CLI layer
- [x] extend `RenameCleanupOptions` and related action types to carry conflict strategy explicitly
- [x] implement `skip` as the current default cleanup conflict strategy without changing current behavior
- [x] expand CLI parsing and validation to the real strategy set: `skip`, `number`, `uid-suffix`
- [x] implement deterministic `number` planning for directory cleanup conflicts
- [x] implement deterministic `uid-suffix` planning for directory cleanup conflicts
- [x] define that `number` and `uid-suffix` also apply to single-file existing-target conflicts in the same pass
- [x] update help text so it lists the real strategy set: `skip`, `number`, `uid-suffix`
- [x] keep single-file cleanup behavior coherent with the chosen conflict-strategy contract
- [x] revise interactive cleanup flow so conflict strategy is surfaced only once there are real choices
- [x] confirm existing dry-run preview and skipped-summary wording remains valid while `skip` preserves current planner outcomes
- [x] add focused tests for CLI parsing, planner behavior, and interactive answer mapping around conflict strategy
- [x] add manual smoke checks for conflict-heavy cleanup fixtures such as `examples/playground/huge-logs`

### Phase 2.1e: Cleanup docs wording and status audit

- [x] re-check cleanup-related plan, research, guide, and README status fields after the latest scope changes
- [x] confirm research docs that still inform active work remain `draft` or `in-progress` rather than `completed`
- [x] confirm completed job records describe implemented behavior only and do not overstate deferred work
- [x] audit cleanup wording for outdated `uid`-as-style phrasing
- [x] audit cleanup wording for outdated collision behavior or missing `--conflict-strategy` notes
- [x] audit interactive cleanup wording so prompt labels match the documented option roles
- [x] update docs where necessary so current behavior, planned behavior, and deferred behavior are clearly separated

### Phase 2.2: Codex analyzer-assisted cleanup planning

- [x] define the minimum analyzer-assisted cleanup goal:
  - [x] suggest hints
  - [x] suggest cleanup pattern families
  - [x] decide not to suggest a whole cleanup command draft in the first pass
- [x] decide where analyzer-assisted cleanup should appear in interactive mode
- [x] define the fallback when Codex is unavailable or unsupported
- [x] define how analyzer output is reviewed and confirmed before any cleanup run
- [x] define the first-pass analyzer input boundary:
  - [x] filename list only
  - [x] bounded sample / grouping strategy
  - [x] no file-content reading in the initial design
- [x] define the structured Codex suggestion response shape
- [x] expand this into a separate dedicated plan

### Phase 3: Custom-template hint simplification

- [x] replace the long placeholder inventory with a short primary-placeholder hint
- [x] add a very short note for advanced variants and params
- [x] ensure the prompt remains readable in narrow terminals
- [x] keep existing rename-template behavior unchanged

### Phase 4: Optional ghost-placeholder enhancement

- [x] evaluate whether the custom-template prompt should move to a TUI/custom-input primitive
- [x] implement a narrow reusable prompt helper with dimmed placeholder/ghost behavior
- [x] preserve simple fallback behavior if terminal capabilities are limited
- [x] avoid changing unrelated interactive prompts in the same pass

### Phase 5: Tests and verification

- [x] add or update tests for interactive menu wiring
- [x] add focused tests for cleanup interactive dispatch and answer mapping
- [x] add prompt-helper tests if extraction occurs
- [x] run verification:
  - [x] `bunx tsc --noEmit`
  - [x] targeted `bun test ...`
  - [x] manual interactive smoke checks for:
    - [x] rename batch custom-template prompt readability
    - [x] rename file custom-template prompt readability
    - [x] rename cleanup file flow
    - [x] rename cleanup directory dry-run flow

## Completion Criteria

- interactive rename custom-template guidance is short enough to scan quickly
- the prompt still signals that advanced variants/params exist without listing every token inline
- interactive mode exposes `rename cleanup` alongside the other rename actions
- the cleanup interactive flow covers the current v1 CLI contract without adding new semantics
- cleanup stays path-first with auto-detect rather than adding a new mode-selection layer
- cleanup filtering language makes clear that include/exclude rules are file-based candidate filters
- single-file cleanup does not show file-filter prompts that only make sense for directory candidate sets
- cleanup fragment-removal semantics match the current contract for `serial` and `uid` without broad basename replacement
- cleanup option roles are explicit enough that `--style` is no longer overloaded with replacement or collision semantics
- cleanup conflict handling is either still explicitly documented as strict skip or upgraded behind a named `--conflict-strategy` contract
- the active cleanup conflict-strategy behavior is reflected consistently across CLI help, interactive flow, tests, and docs
- any real ghost-placeholder upgrade is either implemented narrowly and stably, or explicitly deferred without blocking the rest of the work
- any analyzer-assisted cleanup direction is explicitly planned rather than half-hidden inside deterministic cleanup

## Related Plans

- `docs/plans/plan-2026-03-03-codex-analyzer-assisted-rename-cleanup.md`
- `docs/plans/plan-2026-03-03-rename-cleanup-v1-implementation.md`
- `docs/plans/plan-2026-03-02-cli-tui-foundation-and-path-inline-refactor.md`
- `docs/plans/plan-2026-03-02-interactive-path-sibling-navigation-and-ghost-preview.md`
- `docs/plans/plan-2026-03-01-rename-timestamp-format-route-a-and-guides.md`

## Related Research

- `docs/researches/research-2026-03-02-rename-cleanup-subcommand-and-pattern-hints.md`
- `docs/researches/research-2026-03-03-rename-cleanup-option-surface-and-conflict-strategy.md`
- `docs/researches/research-2026-03-03-codex-analyzer-assisted-rename-cleanup.md`
- `docs/researches/research-2026-02-28-interactive-path-ghost-hint-and-sibling-navigation-ux.md`
- `docs/researches/research-2026-03-01-rename-timestamp-format-and-template-ux.md`
