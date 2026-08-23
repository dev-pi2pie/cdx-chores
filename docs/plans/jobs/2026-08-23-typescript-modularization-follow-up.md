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

| Phase | Boundary                                     | Status    | Review range         | Decision |
| ----: | -------------------------------------------- | --------- | -------------------- | -------- |
|     1 | Profile Codex action test                    | completed | `f81a68e5..909c8c50` | Continue |
|     2 | Template asset handling                      | completed | `6ecd8597..7ecc882d` | Continue |
|     3 | Project Codex action-write test              | completed | `f1941d88..69aefb8e` | Continue |
|     4 | Rename Codex option ownership                | completed | `a5ac3ed3..8df643e1` | Continue |
|     5 | Doctor workflow projection                   | completed | `8a2f9136..e2c15629` | Continue |
|     6 | Interactive Codex authoring test             | completed | `d2172ad8..e197efed` | Continue |
|     7 | Template synthesis test                      | completed | `f74795e7..b68ed2d1` | Continue |
|     8 | Profile adapter test                         | completed | `2e5fa5f1..8c7c6ae6` | Continue |
|     9 | Template adapter test                        | pending   | pending              | pending  |
|    10 | Markdown PDF command-surface test            | pending   | pending              | pending  |
|    11 | Interactive Markdown `to-pdf` decision gate  | pending   | pending              | pending  |
|    12 | Cumulative validation and lifecycle closeout | pending   | pending              | pending  |

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
