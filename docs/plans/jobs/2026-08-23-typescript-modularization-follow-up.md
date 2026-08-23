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
|     2 | Template asset handling                      | pending   | pending              | pending  |
|     3 | Project Codex action-write test              | pending   | pending              | pending  |
|     4 | Rename Codex option ownership                | pending   | pending              | pending  |
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
