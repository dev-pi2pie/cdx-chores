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

Status: completed.

Fixed review base: `a67aa95255150ba785605e942a8395d7537fe7e0`.

Environment: macOS 26.6.2, Node 26.5.0, Bun 1.4.1, Codex CLI 0.153.4.
The initial tracked worktree was clean.

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

After the full-range ownership review, focused verification passed 20 tests and
120 assertions in 5.72 seconds. TypeScript, repository lint, and formatting passed.

Command: `bun test ./test/test-runner/process-table.unit.test.ts ./test/test-runner/process.app.test.ts`.
Fixture limits are 2,500 ms execution, 250 ms
grace, and 1,500 ms total termination; timeout fixtures use shorter explicit
execution deadlines. The installed-tool checkpoint verification passed 19 tests and 98 assertions
in 4.93 seconds, including safe cleanup for a launch failure with no spawned PID.
`tsc --noEmit`, repository lint, and repository format checks passed.

The first checkpoint is `2605651c`. A subsequent review tightened signal ordering:
no termination attempt may begin after the cleanup budget expires. Observation
loss after launcher exit returns `stopped: false` and the owned group identity;
callers retain scratch and stop scheduling. Recovery requires fresh ownership
evidence, rather than an unverified post-completion force-kill API. Both boundaries
have dedicated regressions, including verified fixture-only recovery. These fixes
were checkpointed in `04361b29`.

### Installed Codex and Node Evidence

Installed-tool protocol, fixed before execution: three sequential attempts for
each of the independent protocol client and production transport, first with
captured output and then in a terminal (12 probe runs total). Each attempt uses
a fresh isolated home/project and three bounded metadata requests. Verified
limits: 5 seconds for the version probe, 30 seconds for execution, 1 second for
normal/graceful shutdown, and 3 seconds total termination. Failed attempts remain
recorded below; each corrected series used the same fixed repetition count.

Command: `node scripts/testing/verify-codex-lifecycle.ts --attempts 3`.

| Series                                        | Protocol attempt durations (ms) | Transport attempt durations (ms) | Outcome                                                                                   |
| --------------------------------------------- | ------------------------------- | -------------------------------- | ----------------------------------------------------------------------------------------- |
| Initial captured series                       | 112, 114, 114                   | 113, 113, 114                    | Six startup failures; configured Codex home directory was missing; cleanup verified       |
| Diagnostic pair                               | 111                             | 110                              | Same startup failure; sanitized diagnostics captured                                      |
| Home corrected, original name check, captured | 861, 813, 772                   | 747, 787, 757                    | Requests/cleanup passed all six; native-name check passed only protocol 1 and transport 2 |
| Home corrected, original name check, terminal | 796, 748, 784                   | 770, 777, 744                    | Requests/cleanup passed all six; native-name check passed only protocol 3                 |
| Kernel name correction, captured              | 1085, 730, 724                  | 861, 746, 753                    | All six passed; native child observed; no escalation                                      |
| Kernel name correction, terminal              | 755, 848, 732                   | 739, 743, 760                    | All six passed; native child observed; no escalation                                      |

The name-check failures came from macOS `comm` fallback values such as `(codex)`.
The observer now requests `ucomm`, the kernel accounting name described by `ps(1)`;
names remain diagnostic, while numeric process-group ownership controls signals.
The fixture creates its configured home and sets a Git discovery ceiling so the
isolated project does not inherit the enclosing checkout's Git configuration.

Two additional diagnostic pairs (`--attempts 1`) measured direct-exit-to-verified-
completion drain: captured protocol/transport 667/614 ms (770/725 ms total), and
terminal 780/655 ms (888/779 ms total). All four passed. These observations support
the 1-second normal drain allowance for this verified environment; they are not a
cross-platform or future-version guarantee. Resistant fixtures separately verify
bounded escalation and failure reporting.

Codex startup also spawned Git helpers and occasionally `xcode-select`. The owner
observed their inherited group and awaited its completion, rather than equating
launcher exit with completion. All successful attempts removed their owned scratch;
no raw configuration, responses, or fixture updates were retained. Node ran the
verification owner directly; production code and package/runtime versions were
unchanged, so no new build/runtime behavior is claimed.

Process API reference: [Node child-process lifecycle and detached groups](https://nodejs.org/api/child_process.html).

### Full-Range Review Follow-Up

Review of `a67aa952..815908c4` identified two ownership refinements: expose the
successfully spawned `groupId` explicitly, and require continuity with a previously
observed live descendant before signaling after leader exit. A replacement group
must not inherit signal authorization merely by reusing the same numeric PGID.
The regression establishes the descendant observation before releasing its launcher,
then exercises both observation loss and a simulated replacement group.

Phase 1 verified process observation and shutdown on macOS. The lifecycle owner
currently rejects other platforms because their behavior has not been verified;
this is the current verification boundary, not a macOS-specific process model.
The research records the [Linux and Windows extension considerations](../../researches/research-2026-09-05-multi-test-commands.md#scope-evidence-and-documentation).

The fixed repetition protocol was rerun after these behavior changes; all 12
probes passed without escalation:

| Mode     | Protocol total / drain ms, attempts 1–3 | Transport total / drain ms, attempts 1–3 |
| -------- | --------------------------------------- | ---------------------------------------- |
| Captured | 835/647, 732/610, 763/646               | 742/630, 768/641, 752/637                |
| Terminal | 788/671, 740/630, 750/635               | 732/619, 760/642, 841/628                |

A subsequent review added a defensive observation regression: an empty snapshot
while the direct child is alive must not retire the group. Retirement now requires
direct-child exit; the test injects one empty observation, then verifies successful
server shutdown using real process observations. This is a synthetic boundary
check, not a claim that a startup race was observed in the installed tool.

Final focused verification passed 21 tests and 127 assertions in 5.75 seconds.
TypeScript, repository lint, formatting, and whitespace checks passed. The final
fixed 12-probe repetition also passed without escalation:

| Mode     | Protocol total / drain ms, attempts 1–3 | Transport total / drain ms, attempts 1–3 |
| -------- | --------------------------------------- | ---------------------------------------- |
| Captured | 946/759, 757/639, 778/633               | 770/655, 866/743, 847/726                |
| Terminal | 730/613, 754/633, 763/643               | 745/626, 768/648, 785/666                |

The final implementation review covered the complete fixed-base range
`a67aa95255150ba785605e942a8395d7537fe7e0..c30b9e974ebf5ebc2803c25a7c4d008cada17012`.
Security, test-coverage, and maintainability reviews found no remaining material
findings. Earlier findings were resolved in the checkpoint commits within that
range. Phase 1 is complete; the following documentation-only closeout updates
status and acceptance without changing the reviewed implementation.

All 34 repository-relative links and anchors in the research, plan, and job were
validated. No installed-Codex lifecycle scratch directories remained after the
final successful protocol.

### Acceptance

- [x] Process completion and termination scenarios verified with bounded fixtures.
- [x] Hanging preflight and cancellation verified with real sequencing markers.
- [x] Installed Codex terminal/captured repetition protocol completed.
- [x] Full phase range reviewed and findings resolved.

## Remaining Phases

Phases 2–4 have not started. Record their mappings and execution evidence here
as implementation proceeds.
