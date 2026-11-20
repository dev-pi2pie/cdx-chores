---
title: "Codex turn reporting and app-server shutdown implementation"
created-date: 2026-11-20
status: completed
agent: codex
---

This record tracks the four phases of the [implementation plan](../plan-2026-11-20-codex-turn-reporting-and-app-server-shutdown.md).

## Phase 1. Benchmark dispatch accounting

At `621e9fcc`, the server received only the warm-up when the measured write threw locally, but the benchmark marked the measured trial attempted at the `default` tier. At `4ca92794`, the transport reports when it queues a request and the benchmark records the attempt and sent tier at that point. [Dispatch regressions](../../../test/codex-benchmark/dispatch-accounting.app.test.ts)

| Measured write | Server trace | Built Node CLI report |
| --- | --- | --- |
| Refused locally | Only the warm-up reached the server. | Failed trial kept its thread ID with `inferenceAttempted: false` and `sentTier: null`. The 230-token total was complete. |
| Stdin ended after the measured `thread/start` write | Only the warm-up `turn/start` reached the server. | Failed trial kept its thread ID and reported that stdin was no longer writable. The attempt, tier, and usage total matched the local refusal case. |
| Queued, then rejected by the server | Warm-up and measured requests both carried `default`. | Failed trial recorded an attempt at `default`. The 230-token total was partial. |
| Queued under socket backpressure | Both requests arrived once with `default`. | Both trials completed. The 460-token total was complete. |

The withheld-reply regression confirmed that both trials retained the sent tier when matching completions arrived. During application validation, an early stdin check masked the invalid-executable diagnostic in `doctor`. Limiting the check to requests that track dispatch restored the diagnostic. The six focused cases each passed three consecutive runs. [Withheld-reply test](../../../test/codex-benchmark/benchmark-runner.app.test.ts) · [Doctor regression](../../../test/doctor/commands/environment.app.test.ts)

Code review covered `621e9fcc..d36dd852` with no outstanding Phase 1 findings. The build, TypeScript check, lint, and formatting checks on changed files passed. Repository-wide formatting still flagged the unchanged [benchmark help test](../../../test/codex-benchmark/help.app.test.ts).

| Final managed suite at `d36dd852` | Cases | Assertions | Outcome |
| --- | ---: | ---: | --- |
| Unit | 2,123 | 127,949 | Passed |
| Application | 2,488 | 15,867 | Passed |
| Codex integration | 27 | 252 | Passed |

## Phase 2. Turn recovery and scheduling

Compared the built Node benchmark and the Bun Standard/Fast live check at `77116cf1` and `631d9e35` against the same synthetic app-server on the Codex 0.171.0 dependency baseline. The comparison kept the 15-second start RPC deadline and shortened the completion wait to 500 ms. It recorded four cases for each caller at each revision. [Original full-deadline observations](2026-11-20-canary-7-withheld-turn-start-reply.md#full-deadline-observations)

| Standard turn | At `77116cf1` | At `631d9e35` |
| --- | --- | --- |
| Normal reply and completion | Both archived Standard before Fast. | Both retained that order. |
| Reply withheld, matching completion received | Only the benchmark archived Standard. The live check reported a timeout. | Both recovered Standard, archived it, and then started Fast. |
| Reply withheld, announced turn still active | Neither interrupted. The benchmark stopped and the live check started Fast. | The benchmark interrupted the identified turn. With only an acknowledgement, both skipped archive and stopped before Fast. |
| Reply received, completion wait expired | The benchmark interrupted and stopped after acknowledgement alone. The live check started Fast. | The benchmark still required matching terminal evidence. The live check stopped before Fast. Neither archived Standard. |

The focused regressions verified that a matching terminal event after the benchmark interrupt permitted archive and continuation even when the interrupt reply was withheld. The trial stayed failed and preserved its 230 attributable tokens as partial usage. A terminal event for another thread or turn could not authorize archive or Fast. Both callers also stopped with no turn ID, including when the server delivered the announcement after the retention decision and before teardown. [Turn recovery tests](../../../test/codex-benchmark/turn-recovery.app.test.ts)

Review caught a live-check path that could still start Fast after Standard was announced and its start RPC was rejected. The corrected path stops on an unconfirmed announced turn. An explicit rejection before any announcement permits the comparison to continue. All 20 recovery cases passed twice, and 11 dispatch, timeout, transport, and readiness controls passed. Code review covered `77116cf1..631d9e35`. Native provider event ordering remains open.

| Final managed suite at `631d9e35` | Cases | Assertions | Outcome |
| --- | ---: | ---: | --- |
| Unit | 2,123 | 127,949 | Passed |
| Application | 2,509 | 16,096 | Passed in 289.96 seconds |
| Codex integration | 27 | 252 | Passed |

The build, TypeScript check, lint, and formatting checks on changed files passed. Repository-wide formatting continued to flag the benchmark help test recorded in Phase 1.

## Phase 3. Bounded shared shutdown

The shutdown fixtures ran on macOS arm64 with Node.js 26.13.1 and Codex SDK 0.171.0. At `be71da97`, the synthetic server completed a warm-up and one measured trial. With group `SIGKILL` denied, the built Node CLI exited 1 after 1.006 seconds with empty stdout. A process-table snapshot at CLI exit found the leader and worker alive. With escalation allowed, the CLI emitted both trials, exited 0, and left the group empty. [Canary.7 shutdown baseline](2026-11-20-canary-7-turn-reporting-and-shutdown.md)

The shared close now propagates signal errors to the caller and bounds the time spent awaiting child closure and owned-group exit. The table shows the packaged Node CLI at `425b37c2`. An independent observer measured from the first `SIGTERM` to CLI exit, parsed the entire stdout stream, and inspected the group before releasing the fixture. All three groups were empty after cleanup. The regression exercises the same three outcomes. [Shared close](../../../src/adapters/codex/app-server.ts) · [Benchmark shutdown tests](../../../test/codex-benchmark/shared-shutdown.app.test.ts)

| Group escalation after both trials completed | CLI exit | JSON report | Live group members at CLI exit |
| --- | --- | --- | --- |
| Allowed | 0 in 1.012 s | Both trials completed. `run.shutdownError` was null. | None |
| Denied while the leader was alive | 1 in 1.011 s | Both trials completed. `run.shutdownError` identified the denied signal. | Leader and worker |
| Signal call returned success without delivering `SIGKILL` | 1 in 2.010 s | Both trials completed. `run.shutdownError` reported the child closure deadline. | Leader and worker |

With the installed SDK and a synthetic executable, an archive request succeeded before a direct-child signal error. The helper returned its answer and wrote the failed-retention diagnostic to stderr. An equivalent delete case preserved the original helper error. The default `keep` trace contained only SDK prompt execution. [SDK retention tests](../../../test/codex-benchmark/sdk-retention.codex.test.ts)

After successful initialization, the Node readiness probe returned `failed` with the reported version and a shutdown diagnostic. It exited in 2.003 seconds while the direct child was still alive. When initialization and shutdown both failed, the probe preserved both diagnostics. The missing-executable control retained its configuration hint. [Doctor shutdown tests](../../../test/doctor/commands/codex-benchmark.app.test.ts) · [Executable diagnostic](../../../test/doctor/commands/environment.app.test.ts)

Code review covered `be71da97..425b37c2` with no outstanding Phase 3 findings. The build, TypeScript check, lint, and formatting of all ten changed source and test files passed. Repository-wide formatting still flagged the benchmark help test recorded in Phase 1.

| Final managed suite at `425b37c2` | Cases | Assertions | Outcome |
| --- | ---: | ---: | --- |
| Unit | 2,123 | 127,949 | Passed |
| Application | 2,514 | 16,173 | Passed in 297.48 seconds |
| Codex integration | 30 | 274 | Passed |

The application suite finished about 2.5 seconds inside its 300-second budget. The cause of the historical timeout remains open. [Application-suite investigation](2026-11-20-canary-7-turn-reporting-and-shutdown.md)

## Phase 4. Documentation and validation

At `5a77fe83`, the built Node.js 24.22.3 benchmark and Bun 1.4.5 live check each reported Codex 0.171.0 in all four synthetic scenarios. The comparison kept the 15-second start deadline and shortened the completion wait to 500 ms. Each first Standard result was checked against the trace for its own thread and turn IDs, archive request, and position of the next Fast request. All eight observations matched the Phase 2 expectations. [v0.2.2-canary.7 full-deadline baseline](2026-11-20-canary-7-withheld-turn-start-reply.md#full-deadline-observations)

| Standard turn | Built benchmark | Standard/Fast live check |
| --- | --- | --- |
| Start reply and matching completion | Completed, archived Standard, then started Fast. Exit 0. | Same order and exit. |
| Reply withheld, matching completion received | Recovered Standard, archived it, then started Fast. Exit 0. | Same order and exit. At the baseline it had skipped archive. |
| Reply withheld, announced Standard still active | Interrupted the announced turn. After acknowledgement alone, it skipped archive and stopped before Fast. Exit 1. At the baseline it had stopped without interrupting. | Timed out, skipped archive, and stopped before Fast without interrupting. Exit 1. At the baseline Fast had overlapped Standard. |
| Reply received, completion wait expired | Interrupted the identified turn. After acknowledgement alone, it skipped archive and stopped before Fast. Exit 1. The baseline also stopped before Fast. | Timed out, skipped archive, and stopped before Fast without interrupting. Exit 1. At the baseline Fast had overlapped Standard. |

The 106 focused regressions passed with 802 assertions across dispatch, turn recovery, shutdown, SDK retention, and readiness. The build, TypeScript check, lint, and formatting of all 22 changed source and test files passed. Repository-wide formatting flagged only the unchanged benchmark help test recorded in Phase 1.

The full managed invocation exited 1. The application suite reached its 300-second limit during the guided frames workflow. It received `SIGTERM` at 300.039 seconds and stopped without escalation. The fixture's `result.ok` assertion failed before its workflow assertions. The other 2,537 application cases passed, and the runner continued through Codex and Pandoc. The guided frames test then passed alone in 5.28 seconds. [Guided frames test](../../../test/video/interactive/frames-workflow.app.test.ts)

| Managed suite | Cases | Assertions | Result |
| --- | ---: | ---: | --- |
| Unit | 2,141 | 127,967 | Passed in the full invocation |
| Application | 2,538 | 16,265 | One failure at the 300-second limit in the full invocation |
| Application rerun | 2,538 | 16,266 | Passed alone in 285.67 seconds under the same limit |
| Codex integration | 30 | 274 | Passed in the full invocation |
| Pandoc integration | 5 | 162 | Passed in the full invocation |

Whole-plan code and test review covered `3cf61889..5a77fe83`, including the intervening [app-server version parsing changes](2026-11-20-codex-app-server-version-parsing.md). Review found no outstanding in-scope correctness or coverage issues. The plan, guides, research, and job record agree on caller behavior and the limits of the evidence. Their repository links and anchors passed validation. Native provider ordering and MCP teardown, buffered SDK prompt cancellation, and discovery transport shutdown remain open. The application suite still exceeds the 240-second reassessment threshold. Suite-wide cancellation and the cause of the historical 300-second timeout remain separate investigations. [Research scope and runner evidence](../../researches/research-2026-11-19-codex-turn-reporting-and-process-shutdown.md#test-runner-evidence)
