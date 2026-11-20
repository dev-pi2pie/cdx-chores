---
title: "Codex benchmark lifecycle corrections"
created-date: 2026-11-20
modified-date: 2026-11-20
status: completed
agent: codex
---

## Outcome and scope

Align dispatch reporting, scheduling and retention in `codex-bench` and the Standard/Fast live check. Cover live-check shutdown when the owned app-server group survives escalation.

## Implementation Record

The [unified job record](jobs/2026-11-20-codex-benchmark-lifecycle-corrections.md) records each completed phase’s checkpoint, tested revision, evidence and review outcome under the matching numbered headings.

## Phase 1. Local dispatch and reporting

- [x] Check reports and protocol traces through the built Node benchmark and the live check. Local stdin acceptance of `turn/start` sets the benchmark attempt and any explicit `sentTier` in both callers. Before acceptance, the benchmark reports `inferenceAttempted: false` and both report `sentTier: null`. [Dispatch tests](../../test/codex-benchmark/dispatch-accounting.app.test.ts)

For every continuation or stop check in Phases 1 and 2, trace a distinguishable planned successor’s `thread/start` and `turn/start` or their absence, including Fast after Standard in the live check.

| Case | Expected outcome |
| --- | --- |
| `thread/start` fails | The server receives no `turn/start` for that trial. |
| Healthy local refusal of `turn/start` | No `turn/start`, archive or delete reaches the server for the refused thread. Prior benchmark usage stays complete. The next planned trial starts without retrying the refusal. |
| Peer-closed stdin | A writable stream returns `false` with immediate `EPIPE`. The server receives no `turn/start` for that trial, prior benchmark usage stays complete, and scheduling stops. |
| Genuine backpressure | `write()` returns `false` with bytes buffered and no immediate error. The server receives the turn once, and the report records the attempt and explicit tier. |
| Later transport loss | The server records `turn/start` before transport fails. Preserve the attempt, tier and available usage, mark incomplete usage partial, and stop scheduling. |

## Phase 2. Thread identity, scheduling and retention

- [x] Require a fresh, nonempty thread ID. Missing or reused IDs produce no `turn/start`, archive or delete for that trial. [Turn recovery tests](../../test/codex-benchmark/turn-recovery.app.test.ts)
- [x] Recognize the Codex 0.171.0 structured refusal (`-32602`, `data.input_error_code: "input_too_large"`). Keep the attempt and tier and skip archive or delete. The next planned trial starts only on a healthy, uncancelled connection with no conflicting turn evidence. Generic errors without the discriminator or responses with conflicting turn evidence stop scheduling and skip archive or delete while completion remains unconfirmed.
- [x] Require `turn/completed` matching the owned thread and turn, including when recovering a withheld start reply. Requested archive or delete follows readback or its deadline and precedes any next trial. This applies even without a saved `task_complete`. `keep` sends no retention RPC. [Rollout recovery tests](../../test/codex-benchmark/rollout-recovery.app.test.ts)
- [x] Preserve each caller’s timeout and interrupt policy. Cancellation blocks later trials, preserves the initiating signal’s exit status and skips archive or delete when completion is unconfirmed. [Caller-specific timeout behavior](plan-2026-11-20-codex-turn-reporting-and-app-server-shutdown.md#phase-2-turn-recovery-and-scheduling)

## Phase 3. Live-check test launcher and shutdown

- [x] Move the turn-recovery and shared-shutdown suites to a test-owned launcher that runs the Standard/Fast live check. [Turn recovery tests](../../test/codex-benchmark/turn-recovery.app.test.ts) · [Shared shutdown tests](../../test/codex-benchmark/shared-shutdown.app.test.ts)
- [x] On POSIX, cover group `SIGKILL` that reports success with delivery suppressed. Independently observe the leader and worker alive at caller exit before fixture release. Require exit `1`, a shutdown deadline diagnostic on stderr and both completed Standard/Fast results in JSON. Bound caller exit and verify fixture cleanup by a deadline, including after assertion failure.

## Phase 4. Documentation, validation and closeout

- [x] Update the guide and research with verified behavior and evidence limits. Check the document links. [Benchmark guide](../guides/codex-benchmark.md)
- [x] Run the focused regressions and managed `bun run test:all` for the unit, application, Codex and Pandoc suites. Verify cleanup, the Node-target build and package smoke, TypeScript, lint, formatting and whitespace checks. Record results in the unified job record.
- [x] Review the full implementation range, including tests and affected documentation. Record the exact base and tip, findings and any re-review with fixes included. Close the checklist, plan and job record when the evidence supports completion.

## Related Research

- [Evidence for Codex benchmark lifecycle decisions](../researches/research-2026-11-20-codex-benchmark-lifecycle-evidence.md)
