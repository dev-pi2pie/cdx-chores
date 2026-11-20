---
title: "Evidence for Codex benchmark lifecycle decisions"
created-date: 2026-11-20
status: draft
agent: codex
---

## Key Findings

### Dispatch when `write()` returns `false`

Stdin was writable before the measured `turn/start` for `thread-2`. The benchmark currently calls `onQueued` when the write returns without throwing. The proposed rule checks `stdin.errored` immediately after the write and skips `onQueued` if the stream already reports an error. [^transport] [^usage]

| Observed write outcome | Current | Proposed |
| --- | --- | --- |
| `false` with immediate `EPIPE` | `onQueued` runs. `inferenceAttempted: true`, `sentTier: "default"`. The 230-token warm-up total is marked partial. | Skip `onQueued`. `inferenceAttempted: false`, `sentTier: null`. The 230-token warm-up total stays complete. |
| `false` under backpressure with bytes queued and no immediate error | `onQueued` runs. `inferenceAttempted: true`, `sentTier: "default"`. | Same as current. |

In the peer-closed test, the synthetic app-server closed its input before replying to the measured `thread/start`, and its trace recorded only the warm-up turn. Under backpressure, the trace recorded exactly one measured `turn/start`. [^transport] [^dispatch]

A later transport failure preserves the attempt and tier because the write was already accepted, as in the test where the server recorded the measured `turn/start` before closing stdout without `turn/completed`. [^runner-tests]

## Evidence by decision

| Decision | Required evidence and current behavior |
| --- | --- |
| Count an attempt | Local acceptance of `turn/start` justifies `inferenceAttempted` and any explicit `sentTier`. The benchmark uses `onQueued`. The live check copies the selected tier. [^transport] [^live] |
| Apply requested retention | Archive or delete needs a thread created for the invocation and `turn/completed` matching the current thread and turn IDs. The benchmark checks for a fresh thread ID. The live check trusts `thread/start`. [^benchmark] [^live] [^retention] |
| Start another trial | A matching terminal event settles a queued turn. After an unconfirmed timeout, the benchmark can interrupt a known turn and wait for terminal confirmation. The live check stops. [^benchmark] [^live] [^recovery] |
| Report successful shutdown | Both await child `close` and, for an owned POSIX group, `ESRCH` from a group probe. Signal delivery, stdout EOF and leader exit alone leave shutdown unverified. [^shutdown] [^shutdown-tests] |

**Turn confirmation.** When the `turn/start` reply is missing, both callers can recover using `turn/started` paired with a matching `turn/completed` before the start deadline. Terminal statuses include `failed` and `interrupted`. An unrelated terminal event or an interrupt acknowledgement alone leaves the turn unconfirmed. Both callers allow continuation after an explicit start rejection before any turn is known. After confirmation they wait for saved readback or its deadline before retention. A saved `task_complete` supplies measurement evidence. A failed retention RPC can be reported while scheduling continues. [^benchmark] [^live] [^retention] [^recovery]

**Shutdown observations.** The existing tests independently checked for the leader and worker at caller exit. With escalation denied, both callers preserved completed trials and exited 1 without a cancellation signal. The benchmark reported `run.shutdownError` in JSON and the live check reported the failure on stderr. On cancellation, 130 or 143 identifies the initiating signal and the shutdown diagnostic carries the cleanup result. [^shutdown] [^shutdown-tests] [^shutdown-record]

## Where the callers diverge

**Observed reporting and scheduling.** When Standard’s `thread/start` was explicitly rejected, the live check reported `sentTier: "default"` for Standard while only Fast’s `turn/start` reached the server. It also reported `sentTier: "priority"` when the peer closed its input before the Fast write. In the benchmark, a measured write that threw before submitting any bytes left the attempt fields correct, but the remaining trial was skipped despite a healthy transport. By inspection, the runner sets `turnMayBeActive` before dispatch. [^live] [^benchmark]

**Observed with synthetic reused IDs.** The server returned `thread-1` again and replied to Fast’s `turn/start` with the old `turn-thread-1`. The live check’s completion cache is keyed by thread and turn across trials, so one Standard terminal event sufficed for two reported completions. The live check sent `thread/archive` twice for `thread-1` and exited 0 when the fixture acknowledged both. The benchmark refused the reused thread ID before a second `turn/start` or archive request. [^live] [^benchmark]

**Test ownership, by inspection.** The turn recovery and shared shutdown suites both use the manual lifecycle spike’s launcher. The launcher fixes the model, archive policy and synthetic executable wiring and relies on the default Standard/Fast sequence. The automated cases therefore depend on the manual comparison’s launch choices. [^recovery] [^shutdown-tests] [^launcher]

## Implementation Direction

Agree on the evidence both callers need, then make narrow corrections. Make the benchmark’s dispatch notification mean local acceptance. A proven local refusal on a healthy transport can permit the next planned trial. Retrying the refused request would be a separate policy decision. Have the live check report the tier after local acceptance and require a nonempty thread ID unused in this run before starting a turn. Give the two suites a test-owned launcher for the live check. The existing shared retention and shutdown code and the callers’ distinct interruption policies can serve the same evidence rules.

A linked follow-up plan is the next stage. Distinguish peer closure, real backpressure and failure after queueing. Check that a proven local refusal leaves the trial unattempted, skips archive and preserves the completeness of prior usage while allowing the next planned trial on a healthy transport. Pair it with a transport-loss case that stops scheduling. Cover the live check’s pre-dispatch tier reporting and require that reused IDs produce neither a second start nor a second archive, with distinct IDs as the control.

## Open Questions

- Can the native app-server announce a turn after explicitly rejecting its `turn/start` RPC? The late-announcement regression covers a timeout. The native ordering and frequency of the synthetic faults remain unknown. [^recovery] [^earlier]
- Shared shutdown verifies the owned POSIX group or, where no separate group is created, child closure. The tests observe undelivered escalation directly in the benchmark. The live check’s outcome under that fault, cleanup by native descendants outside the group, and Windows descendant behavior remain unverified here. [^shutdown] [^shutdown-tests] [^earlier]

## Related Plans

- [Codex turn reporting and app-server shutdown](../plans/plan-2026-11-20-codex-turn-reporting-and-app-server-shutdown.md)
- [Codex CLI benchmark](../plans/plan-2026-11-18-codex-cli-benchmark.md)

## References

[^transport]: [App-server requests and stream errors](../../src/adapters/codex/app-server.ts)
[^usage]: [Benchmark token accounting](../../src/cli/codex-bench/usage.ts)
[^dispatch]: [Dispatch accounting cases](../../test/codex-benchmark/dispatch-accounting.app.test.ts) · [Local refusal and backpressure controls](../../test/codex-benchmark/fixtures/turn-write-preload.cjs)
[^runner-tests]: [Benchmark runner cases](../../test/codex-benchmark/benchmark-runner.app.test.ts)
[^live]: [Standard/Fast live check](../../scripts/spikes/codex-benchmark-live-check.ts)
[^benchmark]: [Benchmark runner](../../src/adapters/codex/benchmark/index.ts) · [Turn observer](../../src/adapters/codex/benchmark/turn.ts)
[^retention]: [Shared session retention](../../src/adapters/codex/session-retention.ts) · [Rollout recovery cases](../../test/codex-benchmark/rollout-recovery.app.test.ts)
[^recovery]: [Turn recovery cases](../../test/codex-benchmark/turn-recovery.app.test.ts) · [Recorded caller comparison](../plans/jobs/2026-11-20-codex-turn-reporting-and-app-server-shutdown.md#phase-2-turn-recovery-and-scheduling)
[^shutdown]: [Shared app-server shutdown](../../src/adapters/codex/app-server-shutdown.ts) · [Benchmark CLI exit handling](../../src/cli/commands/codex-bench.ts)
[^shutdown-tests]: [Shared shutdown cases](../../test/codex-benchmark/shared-shutdown.app.test.ts)
[^shutdown-record]: [Live-check shutdown and benchmark exit handling](../plans/jobs/2026-11-20-codex-app-server-version-parsing.md#fourth-follow-up-live-check-worker-shutdown)
[^launcher]: [Manual lifecycle launcher](../../scripts/spikes/codex-turn-lifecycle/live.ts)
[^earlier]: [Earlier turn reporting and process shutdown research](research-2026-11-19-codex-turn-reporting-and-process-shutdown.md)
