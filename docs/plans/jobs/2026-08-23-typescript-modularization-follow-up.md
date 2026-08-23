---
title: "TypeScript Modularization Follow-Up Execution"
created-date: 2026-08-23
status: in-progress
agent: codex
---

## Goal

Record concise, reproducible execution evidence for the phased TypeScript
modularization follow-up without duplicating the parent plan's checklists.

## Related Plan

- `docs/plans/plan-2026-08-23-typescript-modularization-follow-up.md`

## Related Research

- `docs/researches/research-2026-08-23-typescript-modularization-follow-up.md`

## Starting Evidence

- implementation started from a clean worktree
- the research baseline records 59 source files and 75 test files above 300
  lines; the threshold remains a review aid rather than a completion target
- Phase 1 started with
  `test/cli-actions-md-to-pdf-profile-codex-action.test.ts` at 3,027 lines
- the Phase 1 focused baseline passed 66 tests across four files with 0 failures

## Phase Summary

| Phase | Boundary                                     | Status      | Review range         | Decision |
| ----: | -------------------------------------------- | ----------- | -------------------- | -------- |
|     1 | Profile Codex action test                    | completed   | `f81a68e5..909c8c50` | Continue |
|     2 | Template asset handling                      | completed   | `6ecd8597..7ecc882d` | Continue |
|     3 | Project Codex action-write test              | completed   | `f1941d88..69aefb8e` | Continue |
|     4 | Rename Codex option ownership                | completed   | `a5ac3ed3..8df643e1` | Continue |
|     5 | Doctor workflow projection                   | completed   | `8a2f9136..e2c15629` | Continue |
|     6 | Interactive Codex authoring test             | completed   | `d2172ad8..e197efed` | Continue |
|     7 | Template synthesis test                      | completed   | `f74795e7..b68ed2d1` | Continue |
|     8 | Profile adapter test                         | completed   | `2e5fa5f1..8c7c6ae6` | Continue |
|     9 | Template adapter test                        | completed   | `e9234ac0..c0b34c53` | Continue |
|    10 | Markdown PDF command-surface test            | completed   | `9d5a2d4d..d8cfc74c` | Continue |
|    11 | Interactive Markdown `to-pdf` decision gate  | completed   | `f10fdb8e..5f9aa9be` | Split    |
|    12 | Cumulative validation and lifecycle closeout | in-progress | pending              | pending  |

## Phase 1: Profile Codex Action Test

Status: `completed`

Implementation range: `f81a68e5..909c8c50`

Implementation commit: `909c8c50`

| Dimension          | Before                                                | After                                                                                             |
| ------------------ | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| File topology      | one mixed-responsibility action test                  | five behavior-owned test suites plus one local fixture module                                     |
| Largest file       | 3,027 lines                                           | 757 lines                                                                                         |
| Focused validation | 66 passing tests across four files; 0 failures        | 66 passing tests across eight files; 0 failures                                                   |
| Production scope   | no production change                                  | no production change                                                                              |
| Ownership          | request, output, signal, report, and path cases mixed | 11 request/progress, 11 output/dry-run, 16 signal/base, 14 report/failure, and 8 path/alias tests |

Baseline validation:

```bash
bun test test/cli-actions-md-to-pdf-profile-codex-action.test.ts test/cli-actions-md-to-pdf-profile-codex-command-wiring.test.ts test/cli-actions-md-to-pdf-profile-codex-helpers.test.ts test/cli-actions-md-to-pdf-profile-codex-prepared.test.ts
```

Result: 66 passed, 0 failed, 464 assertions across four files.

After validation:

```bash
bun test test/cli-actions-md-to-pdf-profile-codex-action test/cli-actions-md-to-pdf-profile-codex-command-wiring.test.ts test/cli-actions-md-to-pdf-profile-codex-helpers.test.ts test/cli-actions-md-to-pdf-profile-codex-prepared.test.ts
bunx tsc --noEmit
bun run lint
bun run format:check
git diff --check
```

Result: 66 passed, 0 failed, 464 assertions across eight files. TypeScript,
lint, formatting, and diff checks passed. The implementation range contains no
`src/` changes, and all 60 action test names and bodies were preserved.

Exact-range review found no material issues. A possible global mock concurrency
concern was dismissed after confirming that the repository's standard Bun
commands do not enable concurrent tests and that the affected globals are
restored after each use.

Decision: `Continue` to Phase 2.

## Phase 2: Template Asset Handling

Status: `completed`

Implementation range: `6ecd8597..7ecc882d`

Characterization commit: `4b9a8004`

Implementation commit: `7ecc882d`

| Dimension          | Before                                                     | After                                                                                             |
| ------------------ | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| File topology      | one 540-line mixed Template asset module                   | 2-line facade plus 143-line reference, 230-line remote-policy, and 212-line local-rewrite modules |
| Responsibility     | classification, scanning, containment, and rewriting mixed | shared grammar, remote rejection, and local rewriting have feature-local owners                   |
| Focused validation | 103 passing tests; 0 failures; 417 assertions              | 105 passing tests; 0 failures; 425 assertions                                                     |
| Public imports     | `render.ts` imports two functions from `template-assets`   | the same two facade imports; `render.ts` is unchanged                                             |

Baseline validation:

```bash
bun test test/cli-actions-md-to-pdf-actions-assets.test.ts test/cli-actions-md-to-pdf-actions.test.ts test/cli-actions-md-to-pdf-bundle.test.ts test/cli-actions-md-to-pdf-options.test.ts test/cli-actions-md-to-pdf-prepared-render.test.ts
```

Result: 103 passed, 0 failed, 417 assertions across five files.

Two characterization tests were added before movement: cyclic CSS imports
terminate while retaining nested remote-asset detection, and an accepted
in-root Template `file:` URL remains unchanged.

After validation:

```bash
bun test test/cli-actions-md-to-pdf-actions-assets.test.ts test/cli-actions-md-to-pdf-actions.test.ts test/cli-actions-md-to-pdf-bundle.test.ts test/cli-actions-md-to-pdf-options.test.ts test/cli-actions-md-to-pdf-prepared-render.test.ts
bunx tsc --noEmit
bun run lint
bun run format:check
bun run build
git diff --check
```

Result: 105 passed, 0 failed, 425 assertions. TypeScript, lint, formatting,
build, and diff checks passed.

Exact-range security, maintainability, and test reviews found no material
issues. The security diff review covered only the four changed production
files in `6ecd8597..7ecc882d`, used `render.ts` and the characterization tests
as supporting context, and recorded complete coverage with zero findings. No
whole-repository security scan was performed.

Decision: `Continue` to Phase 3.

## Phase 3: Project Codex Action-Write Test

Status: `completed`

Implementation range: `f1941d88..69aefb8e`

Implementation commit: `69aefb8e`

| Dimension          | Before                                             | After                                                                                             |
| ------------------ | -------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| File topology      | one 2,310-line action-write suite                  | five behavior-owned suites plus one action-write fixture module                                   |
| Largest file       | 2,310 lines                                        | 796 lines                                                                                         |
| Focused validation | 89 passing tests; 0 failures; 1,294 assertions     | 89 passing tests; 0 failures; 1,294 assertions                                                    |
| Production scope   | no production change                               | no production change                                                                              |
| Ownership          | 28 review, write, privacy, and failure tests mixed | 6 review/dry-run, 9 privacy/redaction, 6 successful-write, 2 asset-safety, and 5 prevention tests |

Baseline validation:

```bash
bun test test/cli-actions-md-to-pdf-project-codex/action-write.test.ts test/cli-actions-md-to-pdf-project-codex/command-state.test.ts test/cli-actions-md-to-pdf-project-codex/output-plan.test.ts test/cli-actions-md-to-pdf-project-codex/prepared.test.ts test/cli-actions-md-to-pdf-project-codex/validation.test.ts
```

Result: 89 passed, 0 failed, 1,294 assertions across five files.

After validation:

```bash
bun test test/cli-actions-md-to-pdf-project-codex/action-write test/cli-actions-md-to-pdf-project-codex/command-state.test.ts test/cli-actions-md-to-pdf-project-codex/output-plan.test.ts test/cli-actions-md-to-pdf-project-codex/prepared.test.ts test/cli-actions-md-to-pdf-project-codex/validation.test.ts
bunx tsc --noEmit
bun run lint
bun run format:check
git diff --check
```

Result: 89 passed, 0 failed, 1,294 assertions across nine files. TypeScript,
lint, formatting, and diff checks passed. All 28 test names and 268 static
assertions were preserved, with no `src/` change.

Exact-range test and maintainability reviews found no material issues. The
shared fixture remains local to the action-write boundary, while the existing
Template fixture retains ownership of its reusable PNG and path helpers. The
privacy/redaction suite remains cohesive despite being the largest resulting
file.

Decision: `Continue` to Phase 4.

## Phase 4: Rename Codex Option Ownership

Status: `completed`

Implementation range: `a5ac3ed3..8df643e1`

Characterization commit: `19987de8`

Implementation commit: `5228e93a`

Review-fix commit: `8df643e1`

| Dimension          | Before                                                   | After                                                                                          |
| ------------------ | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| File topology      | one 441-line rename command module                       | 282-line command facade plus 81-line option and 84-line timeout modules                        |
| Responsibility     | registration, Codex options, migration, and wiring mixed | option registration and timeout preparation have private feature owners; action wiring remains |
| Focused validation | 50 passing tests; 0 failures; 288 assertions             | 56 passing tests; 0 failures; 298 assertions                                                   |
| Public imports     | callers import `registerRenameCommands` from `rename.ts` | the same public import; only `rename.ts` imports the new internals                             |

Baseline validation:

```bash
bun test test/cli-command-rename-timeout.test.ts test/cli-actions-rename-file.test.ts test/cli-actions-rename-batch-codex-auto.test.ts test/cli-actions-rename-batch-codex-docs.test.ts test/cli-actions-rename-batch-codex-images.test.ts
```

Result: 50 passed, 0 failed, 288 assertions across five files.

Characterization coverage added exact Commander option ordering and unchanged
retry and batch-size forwarding for `rename file`, `rename batch`, and the
`batch-rename` alias.

After validation:

```bash
bun test test/cli-command-rename-timeout.test.ts test/cli-actions-rename-file.test.ts test/cli-actions-rename-batch-codex-auto.test.ts test/cli-actions-rename-batch-codex-docs.test.ts test/cli-actions-rename-batch-codex-images.test.ts
bunx tsc --noEmit
bun run lint
bun run format:check
bun run build
git diff --check
```

Result: 56 passed, 0 failed, 298 assertions. TypeScript, lint, formatting,
build, and diff checks passed. The extraction added no barrel, and retry,
batch-size, and default-timeout ownership remain in the action analyzer.

The first exact-range review found one small missing assertion for combined
legacy migration-notice ordering. The accepted fix now locks image-before-
document ordering. Test and maintainability reviewers re-reviewed the widened
`a5ac3ed3..8df643e1` range and found no remaining material issues.

Decision: `Continue` to Phase 5.

## Phase 5: Doctor Workflow Projection

Status: `completed`

Implementation range: `8a2f9136..e2c15629`

Characterization commit: `513cd93d`

Implementation commit: `e2c15629`

| Dimension          | Before                                            | After                                                                                        |
| ------------------ | ------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| File topology      | one 506-line workflow projection module           | 33-line facade plus model, kernel, Markdown, video, data, extension, and font modules        |
| Responsibility     | public model, aggregation, and five domains mixed | public model, deterministic kernel, and domain projection ownership are explicit             |
| Focused validation | 122 passing tests; 0 failures; 886 assertions     | 124 passing tests; 0 failures; 894 assertions                                                |
| Public imports     | callers import the public `workflow.ts` surface   | the same facade exports all prior constants, types, interfaces, and `projectDoctorWorkflows` |

After topology: `model.ts` is 76 lines, `kernel.ts` 136, `markdown.ts` 132,
`video.ts` 24, `data.ts` 54, `extension.ts` 51, and `fonts.ts` 53.

Baseline validation:

```bash
bun test test/cli-doctor-workflow.test.ts test/cli-action-doctor.test.ts test/cli-actions-doctor-markdown-video-deferred.test.ts test/cli-command-doctor.test.ts
```

Result: 122 passed, 0 failed, 886 assertions across four files.

Characterization coverage added a complete public-facade compile/runtime
contract and one mixed projection that freezes cross-domain condition, action,
state, and count ordering.

After validation:

```bash
bun test test/cli-doctor-workflow.test.ts test/cli-action-doctor.test.ts test/cli-actions-doctor-markdown-video-deferred.test.ts test/cli-command-doctor.test.ts
bunx tsc --noEmit
bun run lint
bun run format:check
bun run build
git diff --check
```

Result: 124 passed, 0 failed, 894 assertions. TypeScript, lint, formatting,
build, and diff checks passed. Projector invocation remains Markdown, video,
data, then fonts; no caller imports an internal module.

Exact-range maintainability, test, and security reviews found no material
issues. The compact projection still excludes raw report detail, and extension
command construction remains limited to the closed SQLite and Excel set.

Decision: `Continue` to Phase 6.

## Phase 6: Interactive Codex Authoring Test

Status: `completed`

Implementation range: `d2172ad8..e197efed`

Implementation commit: `e197efed`

| Dimension          | Before                                        | After                                                                                         |
| ------------------ | --------------------------------------------- | --------------------------------------------------------------------------------------------- |
| File topology      | one 1,652-line Codex authoring suite          | five behavior-owned suites plus one 13-line local fixture module                              |
| Largest file       | 1,652 lines                                   | 637 lines                                                                                     |
| Focused validation | 153 passing tests; 0 failures; 715 assertions | 153 passing tests; 0 failures; 715 assertions                                                 |
| Production scope   | no production change                          | no production change                                                                          |
| Ownership          | 75 authoring and lifecycle cases mixed        | 15 entry/setup, 9 font-hint, 8 regeneration, 14 Project-handoff, and 29 output/recovery cases |

Baseline validation:

```bash
bun test test/cli-interactive-markdown-pdf/codex-authoring.test.ts test/cli-interactive-markdown-pdf/handoff.test.ts test/cli-interactive-markdown-pdf/lifecycle.test.ts test/cli-interactive-markdown-pdf/materialization.test.ts
```

Result: 153 passed, 0 failed, 715 assertions across four files. The moved
Codex authoring boundary contributed 75 tests and 371 runtime assertions.

After validation:

```bash
bun test test/cli-interactive-markdown-pdf/codex-authoring test/cli-interactive-markdown-pdf/handoff.test.ts test/cli-interactive-markdown-pdf/lifecycle.test.ts test/cli-interactive-markdown-pdf/materialization.test.ts
bunx tsc --noEmit
bun run lint
bun run format:check
git diff --check
```

Result: 153 passed, 0 failed, 715 assertions across eight files. TypeScript,
lint, formatting, and diff checks passed. All 75 moved tests and 371 runtime
assertions were preserved; scenarios remain isolated in child processes.

Exact-range test and maintainability reviews found no material issues. The
637-line output/recovery suite remains an explicit deferred concentration: its
cases share output selection, report binding, rendering, recovery, and final-
review state transitions, so Phase 6 does not force a second split solely to
cross the 300-line threshold.

Decision: `Continue` to Phase 7.

## Phase 7: Template Synthesis Test

Status: `completed`

Implementation range: `f74795e7..b68ed2d1`

Implementation commit: `b68ed2d1`

| Dimension          | Before                                         | After                                                                                     |
| ------------------ | ---------------------------------------------- | ----------------------------------------------------------------------------------------- |
| File topology      | one 1,592-line Template synthesis suite        | four behavior-owned suites plus one feature-local CSS assertion helper                    |
| Largest file       | 1,592 lines                                    | 875 lines                                                                                 |
| Focused validation | 60 passing tests; 0 failures; 576 assertions   | 60 passing tests; 0 failures; 576 assertions                                              |
| Production scope   | no production change                           | no production change                                                                      |
| Ownership          | 31 structure, font, cover, and ToC cases mixed | 9 document/title, 15 font-ownership, 6 cover-layout, and 1 seven-scenario ToC branch test |

Baseline validation:

```bash
bun test test/cli-actions-md-to-pdf-template-codex/template-synthesis.test.ts test/cli-actions-md-to-pdf-template-codex/action-integration.test.ts test/cli-actions-md-to-pdf-template-codex/families.test.ts test/cli-actions-md-to-pdf-template-codex/font-ownership.test.ts
```

Result: 60 passed, 0 failed, 576 assertions across four files.

After validation:

```bash
bun test test/cli-actions-md-to-pdf-template-codex/template-synthesis test/cli-actions-md-to-pdf-template-codex/action-integration.test.ts test/cli-actions-md-to-pdf-template-codex/families.test.ts test/cli-actions-md-to-pdf-template-codex/font-ownership.test.ts
bunx tsc --noEmit
bun run lint
bun run format:check
git diff --check
```

Result: 60 passed, 0 failed, 576 assertions across seven files. TypeScript,
lint, formatting, and diff checks passed. All 31 test bodies and the feature-
local CSS parser and assertions were preserved.

Exact-range test and maintainability reviews found no material issues. A short
decision fixture remains local to two suites rather than introducing a shared
abstraction. The 875-line font-ownership suite is an explicit deferred
concentration because its cases share the same ownership-mask, selector, and
override contract.

Decision: `Continue` to Phase 8.

## Phase 8: Profile Adapter Test

Status: `completed`

Implementation range: `2e5fa5f1..8c7c6ae6`

Implementation commit: `8c7c6ae6`

| Dimension          | Before                                            | After                                                                          |
| ------------------ | ------------------------------------------------- | ------------------------------------------------------------------------------ |
| File topology      | one 1,440-line Profile adapter suite              | four behavior-owned suites plus one pure adapter fixture module                |
| Largest file       | 1,440 lines                                       | 690 lines                                                                      |
| Focused validation | 88 passing tests; 0 failures; 654 assertions      | 88 passing tests; 0 failures; 654 assertions                                   |
| Production scope   | no production change                              | no production change                                                           |
| Ownership          | 25 prompt, runner, patch, and failure tests mixed | 10 prompt/schema, 2 runner, 10 patch-application, and 3 fallback/failure tests |

Baseline validation:

```bash
bun test test/adapters-codex-markdown-pdf-profile.test.ts test/cli-actions-md-to-pdf-profile-codex-action test/cli-actions-md-to-pdf-profile-codex-helpers.test.ts
```

Result: 88 passed, 0 failed, 654 assertions across seven files. The adapter
boundary contributed 25 tests and 211 assertions.

After validation:

```bash
bun test test/adapters-codex-markdown-pdf-profile/runner-behavior.test.ts
bun test test/adapters-codex-markdown-pdf-profile test/cli-actions-md-to-pdf-profile-codex-action test/cli-actions-md-to-pdf-profile-codex-helpers.test.ts
bunx tsc --noEmit
bun run lint
bun run format:check
git diff --check
```

Result: the runner suite passed 2 tests with 8 assertions, and the complete
focused scope passed 88 tests with 654 assertions across ten files. TypeScript,
lint, formatting, and diff checks passed. Module mocks and timeout restoration
remain local to the sequential runner suite.

Exact-range test and maintainability reviews found no material issues. The
690-line patch-application suite is an explicit deferred concentration because
its cases share bounded patch validation, nested materialization, page-number
domains, page-chrome behavior, and immutability.

Decision: `Continue` to Phase 9.

## Phase 9: Template Adapter Test

Status: `completed`

Implementation range: `e9234ac0..c0b34c53`

Implementation commits: `44d0c506`, `c0b34c53`

| Dimension          | Before                                                    | After                                                                             |
| ------------------ | --------------------------------------------------------- | --------------------------------------------------------------------------------- |
| File topology      | one 1,429-line Template adapter suite                     | five behavior-owned suites plus one 129-line adapter fixture module               |
| Largest file       | 1,429 lines                                               | 531 lines                                                                         |
| Focused validation | 66 passing tests; 0 failures; 380 assertions              | 67 passing tests; 0 failures; 383 assertions                                      |
| Production scope   | no production change                                      | no production change                                                              |
| Ownership          | 39 prompt, decision, repair, CSS, and failure tests mixed | 4 prompt/schema, 19 decision, 5 repair/timeout, 8 CSS-safety, and 4 failure tests |

Baseline validation:

```bash
bun test test/adapters-codex-markdown-pdf-template.test.ts test/cli-actions-md-to-pdf-template-codex/action.test.ts test/cli-actions-md-to-pdf-template-codex/action-integration.test.ts
```

Result: 66 passed, 0 failed, 380 assertions across three files. The adapter
boundary contributed 39 tests.

Characterization added an explicit two-call ceiling for a failed application
repair, closing the repair-limit evidence gap before moving the suite.

After validation:

```bash
bun test test/adapters-codex-markdown-pdf-template
bun test test/adapters-codex-markdown-pdf-template test/cli-actions-md-to-pdf-template-codex/action.test.ts test/cli-actions-md-to-pdf-template-codex/action-integration.test.ts
bunx tsc --noEmit
bun run lint
bun run format:check
git diff --check
```

Result: the adapter suites passed 40 tests with 169 assertions, and the
complete focused scope passed 67 tests with 383 assertions across seven files.
TypeScript, lint, formatting, and diff checks passed. Module mock cleanup and
`AbortSignal.timeout` restoration remain local to the repair/timeout suite.

Exact-range test and maintainability reviews found no material issues. All 39
original tests remain present, the repair-limit characterization adds one test,
and shared request and response construction remains adapter-local. The
531-line decision-parsing suite is an explicit deferred concentration because
its cases share bounded decision parsing and application rules.

Decision: `Continue` to Phase 10.

## Phase 10: Markdown PDF Command-Surface Test

Status: `completed`

Implementation range: `9d5a2d4d..d8cfc74c`

Implementation commit: `d8cfc74c`

| Dimension          | Before                                                | After                                                            |
| ------------------ | ----------------------------------------------------- | ---------------------------------------------------------------- |
| File topology      | one 995-line command-surface suite                    | four surface-owned suites plus one 147-line local fixture module |
| Largest file       | 995 lines                                             | 270 lines                                                        |
| Focused validation | 35 passing tests; 0 failures; 259 assertions          | 35 passing tests; 0 failures; 259 assertions                     |
| Production scope   | no production change                                  | no production change                                             |
| Ownership          | 27 direct, Template, Project, and Profile cases mixed | 6 direct-render, 8 Template, 7 Project, and 6 Profile tests      |

Baseline validation:

```bash
bun test test/cli-actions-md-to-pdf-commands.test.ts test/cli-actions-md-to-pdf-command-wiring.test.ts test/cli-actions-md-to-pdf-options.test.ts
```

Result: 35 passed, 0 failed, 259 assertions across three files. The moved
command-surface boundary contributed 27 tests and 242 assertions.

After validation:

```bash
bun test test/cli-actions-md-to-pdf-commands test/cli-actions-md-to-pdf-command-wiring.test.ts test/cli-actions-md-to-pdf-options.test.ts
bunx tsc --noEmit
bun run lint
bun run format:check
git diff --check
```

Result: 35 passed, 0 failed, 259 assertions across six files. TypeScript,
lint, formatting, and diff checks passed. All 27 original test bodies and their
help, option-routing, validation, action-selection, exit, stdout, and stderr
assertions were preserved.

Exact-range test and maintainability reviews found no material issues. The
shared CLI, Codex-stub, fake-dependency, PNG, and path helpers remain bounded to
one feature-local fixture module. No separate cross-surface smoke suite was
added because each surface already invokes the registered public CLI and owns
its relevant help assertions.

Decision: `Continue` to Phase 11.

## Phase 11: Interactive Markdown `to-pdf`

Status: `completed`

Decision: `Split`

Implementation range: `f10fdb8e..5f9aa9be`

Implementation commit: `5f9aa9be`

| Dimension          | Before                                                                        | After                                                                                       |
| ------------------ | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| File topology      | one 530-line mixed flow module                                                | one 159-line facade plus three private responsibility modules                               |
| Largest file       | 530 lines                                                                     | 187 lines                                                                                   |
| Focused validation | 347 passing tests; 0 failures; 1,537 assertions                               | 347 passing tests; 0 failures; 1,537 assertions                                             |
| Public surface     | two exports from `to-pdf.ts`; two production callers                          | the same exports, path, and caller imports                                                  |
| Responsibility     | preparation, prepared rendering, output review, and route orchestration mixed | source preparation, prepared rendering, output review, and outer orchestration are explicit |

After topology: `source-preparation.ts` is 65 lines, `prepared-render.ts` is
157, `output-review.ts` is 187, and the retained `to-pdf.ts` facade is 159.

Decision-gate evidence:

- source preparation still owns an independent prompt sequence, saved Project
  completeness guard, and one authoritative preparation call
- prepared rendering still owns recipe review, output selection, final
  confirmation, override changes, output rebinding, and execution
- output review still owns destination planning and retry plus final and
  renderer-capability presentation
- the facade remains responsible for saved, direct, and generated route
  transitions, cancellation and backtracking, both public exports, and Codex
  session cleanup

Baseline and after validation:

```bash
bun test test/cli-interactive-markdown-pdf
bunx tsc --noEmit
bun run lint
bun run format:check
bun run build
git diff --check
```

Result: the focused scope passed 347 tests with 1,537 assertions before and
after the split. TypeScript, lint, formatting, build, and diff checks passed.
The existing tests cover prompt order, cancellation, backtracking,
regeneration, handoff, source preparation, output recovery, plan rebinding,
renderer warnings and capabilities, and artifact lifecycle.

Exact-range test and maintainability reviews found no material issues. No
accidental deep imports or cycles were introduced, and the two production
callers retain their imports from `to-pdf.ts`.

Decision: `Continue` to cumulative validation and documentation closeout.

## Phase 12: Cumulative Validation And Lifecycle Closeout

Status: `in-progress`

Fresh-validation base: `9e34db77`

### Focused And Cumulative Validation

Each post-refactor focused command recorded in Phases 1 through 11 was rerun
from the fresh-validation base:

| Phase | Tests | Failures | Assertions | Files |
| ----: | ----: | -------: | ---------: | ----: |
|     1 |    66 |        0 |        464 |     8 |
|     2 |   105 |        0 |        425 |     5 |
|     3 |    89 |        0 |      1,294 |     9 |
|     4 |    56 |        0 |        298 |     5 |
|     5 |   124 |        0 |        894 |     4 |
|     6 |   153 |        0 |        715 |     8 |
|     7 |    60 |        0 |        576 |     7 |
|     8 |    88 |        0 |        654 |    10 |
|     9 |    67 |        0 |        383 |     7 |
|    10 |    35 |        0 |        259 |     6 |
|    11 |   347 |        0 |      1,537 |    20 |

These scopes overlap, so their totals are not summed as a unique-test count.

Closeout validation:

```bash
bun test
bunx tsc --noEmit
bun run lint
bun run format:check
bun run build
git diff --check
```

Result: the complete Bun suite passed 2,625 tests with 14,983 assertions across
289 files in 96.64 seconds. TypeScript checking, lint, repository formatting,
build, and diff checks passed, and the commands left the worktree clean.

### Strict Over-300-Line Inventory

The scan retains the research rule: a strict physical line count greater than
300, with Markdown PDF classification by `/markdown-pdf/` or
`/interactive/markdown/` for source and `md-to-pdf` or `markdown-pdf` for
tests.

| Root    | Baseline total | Baseline related | Baseline other | Final total | Final related | Final other | Change |
| ------- | -------------: | ---------------: | -------------: | ----------: | ------------: | ----------: | -----: |
| `src/`  |             59 |               33 |             26 |          55 |            29 |          26 |     -4 |
| `test/` |             75 |               48 |             27 |          84 |            57 |          27 |     +9 |
| Total   |            134 |               81 |             53 |         139 |            86 |          53 |     +5 |

Four accepted production monoliths left the inventory. The seven accepted test
monoliths also left it, while their behavior-owned replacements contribute 16
files still above 300 lines, producing the net test increase of nine. This is
threshold fragmentation, not a claim that the test structure regressed.

All 139 remaining paths are accounted for below. “Retain” means the current
responsibility is accepted for this plan, not that the file can never be
reconsidered.

<details>
<summary>Source deferrals: 55 paths</summary>

Prior responsibility-reviewed ordered boundaries (8), retained because each
owns one normalization, signal, synthesis, planning, validation, preparation,
or projection pipeline:

- `src/cli/markdown-pdf/profile/normalize.ts`
- `src/cli/markdown-pdf/profile/signals.ts`
- `src/cli/markdown-pdf/template-codex/synthesize-css.ts`
- `src/cli/markdown-pdf/template-codex/output-plan.ts`
- `src/cli/markdown-pdf/project-codex/validate-project.ts`
- `src/cli/markdown-pdf/project-codex/output-plan.ts`
- `src/cli/markdown-pdf/project-codex/prepared.ts`
- `src/cli/markdown-pdf/project-codex/handoff-projection.ts`

Research-explicit safety, parser, and state boundaries (7), retained as raw
terminal state machines, strict parsers, transactional pipelines, or
format-specific APIs:

- `src/cli/prompts/path-inline.ts`
- `src/cli/prompts/text-inline.ts`
- `src/cli/data-stack/plan/parse.ts`
- `src/cli/markdown-pdf/code-highlight.ts`
- `src/cli/file-io.ts`
- `src/cli/markdown-pdf/template/init-service.ts`
- `src/utils/exif.ts`

Other Markdown PDF decision, registry, report, preparation, compatibility, and
lifecycle boundaries (23), retained because each path owns one feature-local
contract and another split would mainly add cross-module state or indirection:

- `src/adapters/codex/markdown-pdf-profile/decision.ts`
- `src/adapters/codex/markdown-pdf-template/decision.ts`
- `src/cli/actions/markdown/to-pdf-service.ts`
- `src/cli/commands/markdown.ts`
- `src/cli/interactive/markdown/authoring.ts`
- `src/cli/interactive/markdown/codex-review.ts`
- `src/cli/interactive/markdown/font-hints/service.ts`
- `src/cli/interactive/markdown/formal-guide/collection.ts`
- `src/cli/interactive/markdown/formal-guide/prompts.ts`
- `src/cli/interactive/markdown/generated-lifecycle.ts`
- `src/cli/interactive/markdown/materialization.ts`
- `src/cli/markdown-pdf/profile-codex/prepare.ts`
- `src/cli/markdown-pdf/profile/feature-registry.ts`
- `src/cli/markdown-pdf/project-codex/page-number-compatibility.ts`
- `src/cli/markdown-pdf/project-codex/project-bundle-completeness.ts`
- `src/cli/markdown-pdf/project-codex/report.ts`
- `src/cli/markdown-pdf/render-bundle.ts`
- `src/cli/markdown-pdf/renderer-capabilities.ts`
- `src/cli/markdown-pdf/template-codex/codex-decision.ts`
- `src/cli/markdown-pdf/template-codex/image-metadata.ts`
- `src/cli/markdown-pdf/template-codex/prepared.ts`
- `src/cli/markdown-pdf/template-codex/report.ts`
- `src/cli/markdown-pdf/template-codex/slots.ts`

Other feature-owned pipelines (17), retained as one font, rename, data,
DuckDB, or Interactive execution, validation, discovery, or presentation
contract:

- `src/cli/actions/font-check.ts`
- `src/cli/actions/font.ts`
- `src/cli/actions/rename/cleanup-codex.ts`
- `src/cli/actions/rename/cleanup-planner.ts`
- `src/cli/actions/rename/cleanup.ts`
- `src/cli/rename-plan-csv.ts`
- `src/cli/rename-preview.ts`
- `src/cli/data-preview/source.ts`
- `src/cli/data-stack/codex-report/validation.ts`
- `src/cli/data-stack/rows.ts`
- `src/cli/duckdb/extensions.ts`
- `src/cli/duckdb/header-mapping/artifact.ts`
- `src/cli/duckdb/query/prepare-source.ts`
- `src/cli/interactive/data-query/execution.ts`
- `src/cli/interactive/data/stack/codex-review.ts`
- `src/cli/interactive/data/stack/source-discovery.ts`
- `src/fonts/coverage.ts`

</details>

<details>
<summary>Test deferrals and future candidates: 84 paths</summary>

Phase-produced behavior-owned suites (16), retained because their remaining
size is concentrated within the named patch, schema, signal, privacy, write,
font, or lifecycle contract already reviewed at its phase boundary:

- `test/adapters-codex-markdown-pdf-profile/patch-application.test.ts`
- `test/adapters-codex-markdown-pdf-profile/prompt-schema.test.ts`
- `test/adapters-codex-markdown-pdf-template/decision-parsing.test.ts`
- `test/cli-actions-md-to-pdf-profile-codex-action/outputs-dry-run.test.ts`
- `test/cli-actions-md-to-pdf-profile-codex-action/path-alias-safety.test.ts`
- `test/cli-actions-md-to-pdf-profile-codex-action/reports-failures.test.ts`
- `test/cli-actions-md-to-pdf-profile-codex-action/request-progress.test.ts`
- `test/cli-actions-md-to-pdf-profile-codex-action/signals-bases.test.ts`
- `test/cli-actions-md-to-pdf-project-codex/action-write/privacy-redaction.test.ts`
- `test/cli-actions-md-to-pdf-project-codex/action-write/review-dry-run.test.ts`
- `test/cli-actions-md-to-pdf-project-codex/action-write/successful-writes.test.ts`
- `test/cli-actions-md-to-pdf-project-codex/action-write/write-prevention.test.ts`
- `test/cli-actions-md-to-pdf-template-codex/template-synthesis/cover-layout.test.ts`
- `test/cli-actions-md-to-pdf-template-codex/template-synthesis/font-ownership.test.ts`
- `test/cli-interactive-markdown-pdf/codex-authoring/font-hint-editing.test.ts`
- `test/cli-interactive-markdown-pdf/codex-authoring/output-recovery-lifecycle.test.ts`

Project and Template Codex phase suites (10), retained as one handoff,
planning, preparation, signal, validation, action integration, bundle write,
or signal collection contract:

- `test/cli-actions-md-to-pdf-project-codex/handoff-equivalence.test.ts`
- `test/cli-actions-md-to-pdf-project-codex/output-plan.test.ts`
- `test/cli-actions-md-to-pdf-project-codex/prepared.test.ts`
- `test/cli-actions-md-to-pdf-project-codex/profile-phase.test.ts`
- `test/cli-actions-md-to-pdf-project-codex/signals.test.ts`
- `test/cli-actions-md-to-pdf-project-codex/template-phase.test.ts`
- `test/cli-actions-md-to-pdf-project-codex/validation.test.ts`
- `test/cli-actions-md-to-pdf-template-codex/action-integration.test.ts`
- `test/cli-actions-md-to-pdf-template-codex/bundle-write.test.ts`
- `test/cli-actions-md-to-pdf-template-codex/signal-collection.test.ts`

Core Markdown PDF contract and evidence files (20), retained because each
couples its cases or fixtures to one render, Profile, compatibility,
capability, evidence, or smoke contract:

- `test/cli-actions-md-to-pdf-actions-assets.test.ts`
- `test/cli-actions-md-to-pdf-actions-profile-rendering.test.ts`
- `test/cli-actions-md-to-pdf-actions-validation.test.ts`
- `test/cli-actions-md-to-pdf-actions.test.ts`
- `test/cli-actions-md-to-pdf-code-highlight.test.ts`
- `test/cli-actions-md-to-pdf-diagnostics.test.ts`
- `test/cli-actions-md-to-pdf-no-default-css.test.ts`
- `test/cli-actions-md-to-pdf-page-chrome.test.ts`
- `test/cli-actions-md-to-pdf-prepared-render.test.ts`
- `test/cli-actions-md-to-pdf-profile-codex-phase2.test.ts`
- `test/cli-actions-md-to-pdf-profile-revision.test.ts`
- `test/cli-actions-md-to-pdf-profile.test.ts`
- `test/cli-actions-md-to-pdf-recipe.test.ts`
- `test/cli-actions-md-to-pdf-template-compatibility.test.ts`
- `test/cli-markdown-pdf-renderer-capabilities.test.ts`
- `test/markdown-pdf-page-number-renderer-evidence/inspection.test.ts`
- `test/markdown-pdf-page-number-renderer-evidence/orchestration.test.ts`
- `test/markdown-pdf-profile-font-preservation-smoke.test.ts`
- `test/fixtures/markdown-pdf/page-number-renderer-contract/product-scenarios.ts`
- `test/fixtures/markdown-pdf/page-number-renderer-contract/renderer-scenarios.ts`

Interactive Markdown suites and harness (9), retained as stateful authoring,
guide, handoff, lifecycle, materialization, render-source, or shared mock
contracts:

- `test/cli-interactive-markdown-pdf/deterministic-authoring.test.ts`
- `test/cli-interactive-markdown-pdf/deterministic-service.test.ts`
- `test/cli-interactive-markdown-pdf/formal-guide-prompts.test.ts`
- `test/cli-interactive-markdown-pdf/formal-guide.test.ts`
- `test/cli-interactive-markdown-pdf/handoff.test.ts`
- `test/cli-interactive-markdown-pdf/lifecycle.test.ts`
- `test/cli-interactive-markdown-pdf/materialization.test.ts`
- `test/cli-interactive-markdown-pdf/render-sources.test.ts`
- `test/helpers/interactive-harness/mocks/markdown-pdf.ts`

Other feature contract suites and fixtures (26), retained because each owns
one adapter, action, command, workflow, raw prompt, data, harness, or release
contract:

- `test/adapters-docx-ooxml-metadata.test.ts`
- `test/cli-action-doctor.test.ts`
- `test/cli-actions-data-stack/validation.test.ts`
- `test/cli-actions-rename-apply-validation.test.ts`
- `test/cli-actions-rename-cleanup-single.test.ts`
- `test/cli-actions-rename-file.test.ts`
- `test/cli-actions-video-gif.test.ts`
- `test/cli-command-data-stack/options.test.ts`
- `test/cli-command-data-stack/replay.test.ts`
- `test/cli-command-rename-timeout.test.ts`
- `test/cli-doctor-workflow.test.ts`
- `test/cli-fs-utils-rename-template.test.ts`
- `test/cli-interactive-data-stack/codex-review.test.ts`
- `test/cli-interactive-data-stack/discovery.test.ts`
- `test/cli-interactive-data-stack/dry-run-write.test.ts`
- `test/cli-interactive-routing-data-query-codex-single.test.ts`
- `test/cli-path-inline.test.ts`
- `test/cli-text-inline.test.ts`
- `test/cli-ux.test.ts`
- `test/data-query-xlsx-sources.test.ts`
- `test/data-source-shape.test.ts`
- `test/data-stack-codex-report/apply.test.ts`
- `test/data-stack-codex-report/validation.test.ts`
- `test/fonts-cli-list.test.ts`
- `test/helpers/interactive-harness/mocks/action-stack.ts`
- `test/release-scripts.test.ts`

Future split candidates (3), explicitly deferred because they are outside the
accepted Phase 1 through 11 boundary rather than because they are cohesive:

- `test/cli-actions-doctor-markdown-video-deferred.test.ts`: Doctor inspection
  and Markdown, DOCX, and video failure describes
- `test/cli-actions-md-to-pdf-bundle.test.ts`: bundle discovery, resolution,
  and action integration
- `test/cli-interactive-markdown-pdf/font-hints.test.ts`: font-hint model,
  suggestion service, and post-Codex review

</details>

### Import And Test-Layout Review

Public import review found no actionable issue. Template assets retain both
facade exports, rename retains `registerRenameCommands`, Doctor retains its
constants, types, and `projectDoctorWorkflows`, and Interactive Markdown
retains both `to-pdf.ts` exports. Existing callers still import those facades;
no unrelated source or test imports a new private module, and the package root
export map is unchanged.

Bun discovered all 32 behavior-owned suites created by the seven test phases
and passed 286 tests with 2,614 assertions. No obsolete compatibility loader,
executable reference to a deleted monolith, or discovery gap remains.

Exact `pathExists` and `minimalPng` helpers remain duplicated between the
Template and command-surface feature fixtures, while some earlier suites reuse
the Template fixture. This small ownership inconsistency is intentionally
deferred: consolidating it here would introduce a broader cross-feature test
helper outside the accepted refactor scope.

Pending before lifecycle completion:

- exact review of the complete plan range
- research lifecycle and current-state wording review
- final documentation review and lifecycle status updates
