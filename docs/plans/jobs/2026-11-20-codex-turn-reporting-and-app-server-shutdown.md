---
title: "Codex turn reporting and app-server shutdown implementation"
created-date: 2026-11-20
status: in-progress
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
