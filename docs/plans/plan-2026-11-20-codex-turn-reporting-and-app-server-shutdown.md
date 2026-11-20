---
title: "Codex turn reporting and app-server shutdown"
created-date: 2026-11-20
status: active
agent: codex
---

## Outcome and scope

Make the benchmark report what it actually dispatched, require evidence that a turn ended before scheduling another after a timeout, and preserve caller results when the shared app-server fails to stop. On `v0.2.2-canary.7` with Codex 0.171.0, synthetic faults reproduced an unsent trial counted as attempted, Fast starting while Standard was active, and completed benchmark results lost on shutdown. [Dispatch and shutdown investigation](jobs/2026-11-20-canary-7-turn-reporting-and-shutdown.md) · [Withheld-reply investigation](jobs/2026-11-20-canary-7-withheld-turn-start-reply.md)

Direct turn handling applies to `codex-bench` and the Standard/Fast live check. Shared shutdown applies to the benchmark, SDK helpers that open an app-server for retention, and the `doctor` readiness probe. Native event ordering on 0.171.0, SDK prompt cancellation, and `codex-info` discovery shutdown remain separate verification questions. Managed suite cancellation and the cause of the original 300-second timeout are tracked separately in the research. [Scope by caller and test runner](../researches/research-2026-11-19-codex-turn-reporting-and-process-shutdown.md#scope-by-caller-and-test-runner)

## Implementation Record

The [unified job record](jobs/2026-11-20-codex-turn-reporting-and-app-server-shutdown.md) tracks changes, tested revisions, observed results, and outstanding checks under the matching phase headings.

## Phase 1. Benchmark dispatch accounting

- [x] Record `inferenceAttempted` and `sentTier` when the transport queues `turn/start`. A queued write counts even under backpressure or if the RPC later fails. [App-server transport](../../src/adapters/codex/app-server.ts) · [Benchmark runner](../../src/adapters/codex/benchmark/index.ts)
- [x] Compare the built CLI’s JSON with the server trace after a successful warm-up. Refuse the measured write locally and verify that only the warm-up reaches the server. The failed trial keeps its thread ID, reports `inferenceAttempted: false` and `sentTier: null`, and leaves the warm-up usage total complete.
- [x] Queue the measured write and have the server reject it. Verify that both requests reached the server, the failed trial retains its attempt and sent tier, and the total is partial when measured usage is unavailable.

## Phase 2. Turn recovery and scheduling

Use the existing start RPC, completion, and interrupt-confirmation deadlines. Match terminal notifications by both thread and turn ID. Exercise each case below through both callers with archive requested. Compare trial outcomes with the order of interrupt, terminal, archive, and subsequent start events. [Benchmark turn observer](../../src/adapters/codex/benchmark/turn.ts) · [Standard/Fast live check](../../scripts/spikes/codex-benchmark-live-check.ts)

| Case | Benchmark | Standard/Fast live check |
| --- | --- | --- |
| Start reply and matching completion | Record the result, archive, and continue. | Archive Standard before starting Fast. |
| Reply withheld, matching completion cached before the RPC deadline | Recover the result and follow the normal retention and scheduling path. | Recover Standard’s result and follow the same order as the normal case. |
| Reply withheld, turn ID known, completion unconfirmed at the RPC deadline | Interrupt that thread and turn. Keep the trial failed and retain attributable usage. A matching terminal event permits archive and another trial. An acknowledgement alone leaves both blocked when confirmation expires. | Report the timeout, skip archive, and end the comparison before Fast. |
| Reply and turn ID both missing when handling the RPC timeout | Record the attempt, sent tier, thread ID, and null turn ID. Stop immediately and skip interrupt and archive. | Report the timeout and stop immediately without interrupt, archive, or Fast. |
| Reply received, completion deadline expires | Interrupt the known turn and apply the same confirmation rule. | Report the timeout, skip archive, and stop before Fast. |

- [x] Add focused regressions for cached completion, confirmed interruption, acknowledgement alone, and a terminal event for another thread or turn. Verify that unrelated events cannot authorize archive or the next start.
- [x] Cover the no-ID case by withholding both the reply and announcement until the callers exit. In a second regression, deliver the announcement after each caller has recorded the timeout decision and before teardown finishes. Verify in both traces that neither caller issues an interrupt, archive, or subsequent start. The canary.7 spike announced an ID before timeout in every run.

## Phase 3. Bounded shared shutdown

- [x] Bound `CodexAppServer.close()` across escalation, child closure, and owned-group exit verification. Propagate a signal error through the awaited close operation. A live leader must not keep the caller waiting past the shutdown deadline. Verify group exit whenever the caller owns a separate process group.
- [x] After two completed benchmark trials, allow escalation and verify exit 0, both results, and an empty owned group. Repeat with group `SIGKILL` denied while the leader is alive. Measure from the initial shutdown signal to CLI exit with an independent clock. Allow three seconds in the fixture test (one second of grace, one second for exit verification, and one second of scheduling tolerance). Require nonzero status and exactly one valid JSON report containing both trials and `run.shutdownError`. Observe the group independently at CLI exit, before fixture cleanup. [Benchmark shutdown tests](../../test/codex-benchmark/shared-shutdown.app.test.ts)
- [x] Exercise shared-close failure after an eligible SDK turn with retention requested. Verify that the helper preserves its answer or original error and reports the retention diagnostic. Check the default `keep` path opens no retention app-server. Inject close failure into the `doctor` probe and verify it returns a readiness diagnostic within the same three-second shutdown test allowance. [Helper retention](../../src/adapters/codex/session-lifecycle.ts) · [Doctor probe](../../src/cli/doctor/codex-benchmark.ts)

## Phase 4. Documentation and validation

- [ ] Run the focused regressions and relevant suites. Repeat the manual lifecycle comparison and compare its eight observations with the canary.7 baseline and the Phase 2 expectations. Check the actual caller reports and protocol order for each case. [Comparison guide](../../scripts/spikes/codex-turn-lifecycle/README.md)
- [ ] Update the research scope table with verified outcomes and preserve the original synthetic observations as the baseline. Revise the benchmark and caller guides wherever output, retention diagnostics, or readiness behavior changed. [Benchmark guide](../guides/codex-benchmark.md) · [Codex execution configuration](../guides/codex-execution-configuration.md)
- [ ] Finalize the unified job record with outcomes by caller, suite results, and outstanding verification. Link it from the research.
- [ ] Review the plan, guides, research, and job record for agreement. Verify links and anchors. Mark the plan complete when the record supports every in-scope acceptance criterion.

## Related Research

- [Codex turn reporting and process shutdown in canary.6 and canary.7](../researches/research-2026-11-19-codex-turn-reporting-and-process-shutdown.md)
