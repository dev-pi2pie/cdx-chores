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
|     5 | Doctor workflow projection                   | pending   | pending              | pending  |
|     6 | Interactive Codex authoring test             | pending   | pending              | pending  |
|     7 | Template synthesis test                      | pending   | pending              | pending  |
|     8 | Profile adapter test                         | pending   | pending              | pending  |
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
