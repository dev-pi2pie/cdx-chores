---
title: "Codex benchmark lifecycle corrections"
created-date: 2026-11-20
status: draft
agent: codex
---

## Outcome and scope

Make `codex-bench` report locally accepted turns accurately and make the Standard/Fast live check report tiers on the same evidence. Both callers should schedule and apply retention using fresh thread identities, matching terminal events and identifiable refusals before Core submission. Cover the live check’s shutdown deadline when the owned app-server group survives escalation.

## Implementation Record

When implementation begins, create the unified job record at `docs/plans/jobs/2026-11-20-codex-benchmark-lifecycle-corrections.md` and link it here. The filename uses the plan date. Set the record’s `created-date` to its actual UTC creation date. Use the same numbered phase headings through closeout. After each phase meets its acceptance criteria, record its checkpoint, tested revision, observed results and review outcome.

## Phase 1. Local dispatch and reporting

- [ ] Set `inferenceAttempted` and any explicit `sentTier` when app-server stdin accepts `turn/start`. Apply the same dispatch evidence to live-check `sentTier`. Distinguish an immediate stream error from a `false` return caused by backpressure before counting dispatch. Preserve the attempt and tier on a later error. [Transport](../../src/adapters/codex/app-server.ts) · [Live check](../../scripts/spikes/codex-benchmark-live-check.ts)
- [ ] Compare caller reports with the server trace for the cases below. Use the built Node CLI to verify benchmark stream behavior and token totals. Exercise the live check’s tier reporting and scheduling through its entry point. [Dispatch tests](../../test/codex-benchmark/dispatch-accounting.app.test.ts) · [Benchmark runner tests](../../test/codex-benchmark/benchmark-runner.app.test.ts)

For scheduling checks in Phases 1 and 2, leave a distinguishable successor planned and check whether its `thread/start` and `turn/start` reach the server. In the benchmark, leave a later planned trial after the fault. In the live check, fault Standard and trace whether Fast starts.

| Case | Acceptance evidence |
| --- | --- |
| `thread/start` fails before dispatch | The server receives no `turn/start` for the trial. The benchmark reports `inferenceAttempted: false`, and both callers report `sentTier: null`. |
| Healthy local `turn/start` refusal | The server receives no `turn/start`, `thread/archive` or `thread/delete` for the refused thread with retention requested. The benchmark leaves the trial unattempted with prior usage complete, and both callers report `sentTier: null`. On a healthy connection in an uncancelled run, the next planned trial starts without retrying the refused trial. |
| Peer-closed stdin | Close server stdin before replying to `thread/start`. In the benchmark, apply the fault after the warm-up. With client stdin still writable before the measured write, observe `write()` return `false` with immediate `EPIPE`. Only the benchmark warm-up turn reaches the server, and its 230-token total stays complete. The benchmark reports `inferenceAttempted: false`, and both callers report `sentTier: null` and stop scheduling. |
| Genuine backpressure | `write()` returns `false` with bytes buffered and no immediate error. The accepted `turn/start` reaches the server once, and the report preserves the attempt and explicit tier. |
| Later transport loss | The server sees the accepted `turn/start` before transport loss. The failed trial retains the attempt and tier, available usage stays in the report, and incomplete usage is marked partial. No later trial starts. |

## Phase 2. Thread identity, scheduling and retention

- [ ] Require a fresh, nonempty thread ID before `turn/start`. Repeated or missing IDs produce no new `turn/start` or retention RPC for that trial. Use distinct IDs as the control and compare thread and turn IDs in the trace. [Benchmark runner](../../src/adapters/codex/benchmark/index.ts) · [Turn recovery tests](../../test/codex-benchmark/turn-recovery.app.test.ts)
- [ ] Preserve structured `turn/start` error data in both callers. Use the Codex 0.171.0 refusal with code `-32602` and `data.input_error_code: "input_too_large"` as the recognized case. Verify that the refused trial retains its dispatch and tier, issues no archive or delete, and lets the next planned trial start on a healthy connection in an uncancelled run with no conflicting turn evidence. Verify that a generic error with no known turn, a matching code or message without the discriminator, and a recognized refusal contradicted by an unconfirmed turn all stop scheduling and skip archive or delete.
- [ ] Exercise a normal reply and a withheld `turn/start` reply recovered by `turn/started` and a matching `turn/completed`. Match both the owned thread ID and the current turn ID. Verify that requested archive or delete follows readback or its deadline and precedes the next planned start. Include matching live completion with no saved `task_complete`. An unrelated terminal event or an interrupt acknowledgement alone leaves completion unconfirmed. Verify `keep` sends no retention RPC. [Turn observer](../../src/adapters/codex/benchmark/turn.ts) · [Rollout recovery tests](../../test/codex-benchmark/rollout-recovery.app.test.ts)
- [ ] Use each caller’s existing timeout and interrupt policy. On a start or completion timeout with a known unsettled turn, check that the benchmark interrupts the identified turn. A matching terminal event from that turn permits retention and, on a healthy connection in an uncancelled run, continuation. The live check stops before Fast. With no known turn at the start deadline, verify that both callers stop without interrupt or retention. On cancellation, verify no later trial starts, initiating signal exit status is preserved, and archive or delete is skipped when completion remains unconfirmed. [Existing timeout and recovery cases](plan-2026-11-20-codex-turn-reporting-and-app-server-shutdown.md#phase-2-turn-recovery-and-scheduling)

## Phase 3. Live-check test launcher and shutdown

- [ ] Give the turn-recovery and shared-shutdown suites a test-owned launcher for the actual Standard/Fast live check. Verify both suites use it and supply their own scenario settings. [Turn recovery tests](../../test/codex-benchmark/turn-recovery.app.test.ts) · [Shared shutdown tests](../../test/codex-benchmark/shared-shutdown.app.test.ts)
- [ ] Add a POSIX live-check regression in which group-directed `SIGKILL` reports success and is not delivered. Require a trace with two matching completions and group-directed `SIGTERM` and `SIGKILL`. Independently observe both the app-server leader and worker alive in the owned group at caller exit, before fixture release. Verify exit `1`, a shutdown deadline diagnostic on stderr, and one JSON report with completed Standard and Fast results. Bound the wait for caller exit and verify fixture cleanup within a deadline, including cleanup after a failed assertion. [Shared shutdown contract](../../src/adapters/codex/app-server-shutdown.ts)

## Phase 4. Documentation, validation and closeout

- [ ] Update the benchmark guide and research to reflect verified dispatch, scheduling, retention and shutdown behavior. Keep native and process-scope evidence limits visible. Verify the reciprocal links and the job record link. [Benchmark guide](../guides/codex-benchmark.md)
- [ ] Run the focused phase regressions, the unit, application and Codex integration suites, the Node-target build, TypeScript and lint checks, and whitespace checks. Record outcomes and outstanding verification in the unified job record.
- [ ] Review the entire implementation range, including tests and affected documentation, from the commit before implementation through the final implementation revision. Record the exact reviewed range and outcome. Resolve findings and re-review the range with the fixes included. Check off acceptance criteria against recorded evidence and mark the plan and job record complete once validation and review support closeout.

## Related Research

- [Evidence for Codex benchmark lifecycle decisions](../researches/research-2026-11-20-codex-benchmark-lifecycle-evidence.md)
