---
title: "Test Suite Refactor Implementation Record"
created-date: 2026-09-05
status: in-progress
agent: codex
---

## Scope and References

Execute the [implementation plan](../plan-2026-09-05-multi-test-commands.md)
against the [research contracts](../../researches/research-2026-09-05-multi-test-commands.md).
Phase 1 establishes bounded process ownership; later phases remain pending.

## Phase 1: Process Lifecycle

Status: in progress.

Fixed review base: `a67aa95255150ba785605e942a8395d7537fe7e0`.

Environment: macOS 26.6.2, Node 26.5.0, Bun 1.4.1. The initial tracked worktree
was clean. Installed Codex version and process timing evidence are pending.

### Implementation and Evidence

The current transport and independent probe await their immediate child.
The installed Codex entry point starts a native child, so verification must
distinguish launcher exit, stream closure, and remaining owned processes.
The test-only owner uses a detached process group, direct-child exit/stream close,
and bounded `ps` state observations. Zombie-only groups are not live work. It
signals only its allocated group and retires that signal target once observed
without live members. Children must inherit the group; arbitrary daemonizing
workloads are outside this mechanism's containment contract.

`scripts/testing/preflight.ts` gates an actual second command on successful probe
completion. Synchronous probe work runs in a child; failed or cancelled preflight
does not launch the following command. Production discovery code is unchanged.

| Checkpoint attempt                          | Outcome                                                                                            |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Initial focused run                         | 4 pass, 11 fail: process observation was denied by the execution sandbox; no completion claim made |
| Process observation permitted               | 12 pass, 3 fail: fractional remaining milliseconds reached Node's integer timeout option           |
| Timeout conversion corrected                | 15 pass, 0 fail; 71 assertions                                                                     |
| Real sequencing/cancellation coverage added | 17 pass, 0 fail; 86 assertions; 4.80 seconds                                                       |

The deadline and unresolved-descendant regressions subsequently passed: 19 tests,
97 assertions, 5.44 seconds.

Command: `bun test ./test/test-runner/process-table.unit.test.ts ./test/test-runner/process.app.test.ts`.
TypeScript and focused lint pass. Fixture limits are 2,500 ms execution, 250 ms
grace, and 1,500 ms total termination; timeout fixtures use shorter explicit
execution deadlines. Installed-Codex budgets and Node execution remain pending.

The first checkpoint is `2605651c`. A subsequent review tightened signal ordering:
no termination attempt may begin after the cleanup budget expires. Observation
loss after launcher exit returns `stopped: false` and the owned group identity;
callers retain scratch and stop scheduling. Recovery requires fresh ownership
evidence, rather than an unverified post-completion force-kill API. Both boundaries
have dedicated regressions, including verified fixture-only recovery.

### Acceptance

- [x] Process completion and termination scenarios verified with bounded fixtures.
- [x] Hanging preflight and cancellation verified with real sequencing markers.
- [ ] Installed Codex terminal/captured repetition protocol completed.
- [ ] Full phase range reviewed and findings resolved.

## Remaining Phases

Phases 2–4 have not started. Record their mappings and execution evidence here
as implementation proceeds.
