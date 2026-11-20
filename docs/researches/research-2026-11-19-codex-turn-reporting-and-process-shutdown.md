---
title: "Codex turn reporting and process shutdown in canary.6 and canary.7"
created-date: 2026-11-19
modified-date: 2026-11-20
status: draft
agent: codex
---

## Research question

When a Codex operation fails, what can the CLI still tell the user about the turn, saved session, and local process? The full suite passed on `v0.2.2-canary.6` with Codex 0.170.0. Two targeted benchmark checks on that source exposed a misreported attempt and a missing JSON report. Both used a Node CLI built from the tagged source, one warm-up, one measured trial, and a synthetic app-server. The normal control exited 0 with both turns and complete usage. The frequency of the injected failures in ordinary use is unknown. [Benchmark fixture](../../test/codex-benchmark/fixtures/benchmark-app-server.mjs)

The `v0.2.2-canary.7` dependency refresh moved the SDK and bundled CLI to 0.171.0 and passed all 4,639 tests. Separate checks against the built canary.7 CLI reproduced both failures with a synthetic app-server. How the native binary behaves under equivalent faults remains open. [Dependency refresh](../plans/jobs/2026-11-20-v0.2.2-canary.7-dependency-refresh.md) · [v0.2.2-canary.7 investigation](../plans/jobs/2026-11-20-canary-7-turn-reporting-and-shutdown.md)

## Which commands talk to Codex?

| Command or action | How it uses Codex | What the caller needs back |
| --- | --- | --- |
| `codex-bench` | Talks directly to `codex app-server` for trial threads, turns, and retention. | A report containing the measurements already collected and any shutdown error. [Benchmark runner](../../src/adapters/codex/benchmark/index.ts) |
| Codex helpers for rename, data query/stack, Markdown/PDF, and interactive workflows | Run prompts through SDK `thread.run()` and `codex exec`. Helpers with archive or delete selected can open an app-server after final thread use. | The helper’s answer or original error, plus a diagnostic if requested retention failed or was skipped. Supported flags vary by command. [Command scope](../guides/codex-execution-configuration.md#command-scope) · [SDK helper entry point](../../src/adapters/codex/shared.ts) |
| `doctor` benchmark readiness check | Initializes an app-server, reads the reported version, and closes the connection. It creates no trial thread. | A readiness diagnostic. [Doctor probe](../../src/cli/doctor/codex-benchmark.ts) |
| `codex-info` discovery | Uses `DiscoveryTransport` to initialize an app-server, read configuration, and request model metadata when needed. | Discovery results. This transport has its own shutdown implementation. [Discovery](../../src/adapters/codex/discovery/index.ts) · [Transport](../../src/adapters/codex/discovery/transport.ts) |

## One helper session, from prompt to retention

For example, `data query codex` captures a SQL draft through the SDK. If the helper reuses a thread, it can finish follow-ups before retention runs. With the default `keep`, it opens no retention app-server. With `archive` or `delete`, it needs the owned thread ID and confirmation that its last turn completed. The wrapper uses the SDK result’s usage field as completion evidence. [SQL helper](../../src/cli/data-query/runner.ts) · [Thread lifecycle](../../src/adapters/codex/session-lifecycle.ts)

**cdx-chores v0.2.2-canary.6 helper session**

```mermaid
flowchart TD
    prompt["SDK thread.run() via codex exec"] --> result["Capture turn result or error"]
    result -->|Follow-up on this thread| prompt
    result -->|Final use| mode{"Retention mode?"}
    mode -->|Keep| done["Return helper outcome"]
    mode -->|Archive or delete| eligible{"Owned ID and completed last turn?"}
    eligible -->|No| skip["Report skipped retention"]
    eligible -->|Yes| server["Initialize app-server, request retention, then close"]
    skip --> done
    server -->|Success| done
    server -->|On failure, warn and preserve the helper outcome.| done
```

## When does a benchmark turn count as dispatched?

A successful `thread/start` supplies a session ID. On canary.6 the runner records the inference attempt and sent tier before writing `turn/start`. An attempted inference with missing counts makes the invocation’s usage total partial. [Benchmark runner](../../src/adapters/codex/benchmark/index.ts) · [Usage accounting](../../src/cli/codex-bench/usage.ts)

**Before — cdx-chores v0.2.2-canary.6 benchmark dispatch**

```mermaid
flowchart TD
    thread["Receive thread ID"] --> record["Set inferenceAttempted and sentTier"]
    record --> write["Write turn/start"]
    write -.->|Write throws| unsent["JSON reports an unsent turn as attempted and marks usage partial."]
    write -->|Server rejects queued request| rejected["Failed trial retains attempt and sent tier"]
```

**Observed.** When the second write threw before queuing any bytes, the fixture received only the first turn. JSON showed an attempt and the `default` tier for the second. In the rejection control, the fixture received and rejected both requests. Recording both attempts was correct.

**Proposed — benchmark dispatch**

```mermaid
flowchart TD
    thread["Receive thread ID"] --> write{"Did the transport queue turn/start?"}
    write -->|Write refused| unsent["Keep thread ID, inferenceAttempted = false, sentTier = null"]
    write -->|Write queued| sent["Set inferenceAttempted = true and record sent tier"]
    sent -->|Server rejects request| rejected["Keep dispatch details on failed trial"]
    sent -->|Matching completion| complete["Record turn result and recover usage"]
```

The acceptance check compares the trace with JSON. A refused local write should preserve earlier usage totals. A queued request should count even if Codex rejects it or its reply is lost.

**Withheld start reply.** When Standard completed before the start RPC expired, the benchmark used the matching notification to recover the turn ID and archive the thread. The live check received the same notification but reported a start timeout. When Standard stayed active, the benchmark stopped scheduling and the live check started Fast. With the start reply restored, the benchmark interrupted the known turn at the completion deadline and required a matching terminal event before continuing. [v0.2.2-canary.7 withheld `turn/start` reply investigation](../plans/jobs/2026-11-20-canary-7-withheld-turn-start-reply.md)

## What survives a shutdown failure?

At shutdown the benchmark already holds its trial records. On canary.6, a timer sends `SIGKILL` after one second of grace. If the timer callback throws, the error escapes the caller’s `await close()`. Catching and ignoring it could leave the CLI waiting indefinitely for the child, since the bounded group-exit check starts only after child closure. [App-server shutdown](../../src/adapters/codex/app-server.ts) · [Report writer](../../src/cli/commands/codex-bench.ts)

**Before — cdx-chores v0.2.2-canary.6 benchmark shutdown**

```mermaid
flowchart TD
    trials["Trials already recorded"] --> close["Request shutdown and await close()"]
    close -->|Shutdown succeeds| report["Write benchmark JSON"]
    close -.->|Timed SIGKILL throws EPERM| lost["CLI exits with empty stdout"]
```

**Observed.** Both turns completed while the fixture delayed exit beyond the grace period. With escalation allowed, the CLI exited 0 and returned both results. When the group kill threw `EPERM`, the CLI exited 1 without writing either result.

**Proposed — benchmark shutdown**

```mermaid
flowchart TD
    trials["Trials already recorded"] --> close["Request shutdown, escalate if needed, and verify exit by deadline"]
    close -->|Exit verified| report["Write one JSON report with all recorded trials"]
    close -->|Shutdown failed or exit unverified| failure["Set run.shutdownError and a nonzero exit status"]
    failure --> report
```

**Regression check.** Deny escalation while the leader is alive. Require a bounded nonzero CLI exit and valid JSON containing both completed trials and the shutdown diagnostic. Independently observe the owned group before claiming that its workers exited.

**Other callers to verify.** Helper retention and the `doctor` probe share `CodexAppServer.close()`. The empty-stdout result was reproduced through the benchmark only. For helper retention, inject a shutdown failure after a successful SDK turn and check that the answer survives with a retention diagnostic. For `doctor`, check that the probe returns a diagnostic within a deadline. Assess `codex-info` separately through its discovery transport.

## Upstream applicability to Codex 0.171.0

The published TypeScript SDK JavaScript and declarations match 0.170.0. The native `codex exec` that runs helper prompts now uses the shared app-server client. The native app-server also ties each `turn/interrupt` reply to its target turn and returns an error if its thread listener shuts down. The synthetic Standard/Fast comparison established how our callers handle those events. Their ordering with the native server and a provider remains open. The benchmark still queues its own writes and runs its own shutdown timer. [Package comparison](../plans/jobs/2026-11-20-v0.2.2-canary.7-dependency-refresh.md#package-review) · [Native exec change](https://github.com/openai/codex/pull/61706) · [Interrupt ordering change](https://github.com/openai/codex/pull/62066)

All four issues below were open on 2026-11-20.

| Upstream evidence | What to check on 0.171.0 |
| --- | --- |
| On Linux, `events.return()` resolved while a streamed turn’s direct child was still alive after ignoring `SIGTERM`. Early iterator cleanup in 0.171.0 still requests termination without awaiting exit. [SDK #36658](https://github.com/openai/codex/issues/36658) · [Tagged SDK executor](https://github.com/openai/codex/blob/rust-v0.171.0/sdk/typescript/src/exec.ts#L248-L263) | Repeat the streamed control, then cancel a helper’s buffered `thread.run()` against the same fixture. Observe when the helper settles and when the child exits. |
| Closing a streamed iterator and immediately aborting its signal terminated the Node host with an unhandled `AbortError`. The SDK still removes the child’s listeners during cleanup. [SDK #51537](https://github.com/openai/codex/issues/51537) | In a disposable Node host, compare that sequence with a helper’s normal abort path. Record whether the helper rejects and whether the host survives. |
| On macOS, closing app-server stdin cut short stdio MCP cleanup and left descendants alive on 0.157.1 and 0.158.0. A Linux trace on 0.163.0 also showed premature termination after the parent sent `SIGTERM`. [App-server #48524](https://github.com/openai/codex/issues/48524) · [macOS follow-up](https://github.com/openai/codex/issues/48524#issuecomment-5882628955) · [Linux trace](https://github.com/openai/codex/issues/48524#issuecomment-6251417643) | Compare stdin EOF alone with the pipe closure and `SIGTERM` used by our transport. Check the MCP server’s cleanup marker, each process’s exit, and which descendants belong to the owned group. |
| The tagged `exec --json` code ends an interrupted turn without emitting a terminal JSON turn event. The native runner records a matching interruption as an error and exits nonzero. [Exec #50585](https://github.com/openai/codex/issues/50585) · [JSON event mapping](https://github.com/openai/codex/blob/rust-v0.171.0/codex-rs/exec/src/event_processor_with_jsonl_output.rs#L528-L568) · [Native exit handling](https://github.com/openai/codex/blob/rust-v0.171.0/codex-rs/exec/src/lib.rs#L1473-L1545) | Interrupt a helper turn with retention requested. Capture the SDK result or error, native exit status, and whether the helper skips retention for the interrupted turn. |

## Test-runner evidence

**What the receipts established.** In an earlier managed run, the application suite reached its 300-second deadline. The runner sent `SIGTERM` at 300.025 seconds. The active `raw-fragmented-arrows` fixture recorded `cancelled` and `stopped: true` after 0.852 seconds of its own 12-second allowance. Its `result.ok` assertion failed before the test compared the arrow-key behavior. The case passed five isolated repetitions. [Frame-menu fixture](../../test/video/interactive/fixtures/frames-menu-fixture.ts) · [Arrow-input test](../../test/video/interactive/frames-menu-bytes.app.test.ts)

Four more fixtures started after the cancelled fixture recorded completion. Three completed. The fourth had a start receipt and no completion receipt. The runner sent `SIGKILL` to the outer suite at 301.026 seconds and confirmed that it stopped. With the fourth fixture’s exit unverified, the runner retained scratch and skipped the Codex and Pandoc suites. The launcher installs and removes signal listeners for each fixture, so a later launch can miss a cancellation already delivered to the suite. A controlled canary.7 run confirmed that a second fixture acquired a PID after the first recorded a stopped cancellation. [v0.2.2-canary.7 investigation](../plans/jobs/2026-11-20-canary-7-turn-reporting-and-shutdown.md)

**Why the earlier suite reached 300 seconds remains open.** A focused run overlapped that invocation for about 56 seconds. All three subsequent isolated canary.7 runs finished within the allowance and crossed the 240-second reassessment threshold. Their timings identify where to profile current costs. The contribution of concurrent work or any test family to the earlier timeout is still unknown. [Timeout decision and measurement method](../plans/jobs/2026-10-18-application-test-costs-and-timeout-budgeting.md#timeout-decision)

## Implementation Direction

The canary.7 investigation supports the following changes and timing decision. Runtime fixes and their regression checks are pending. [v0.2.2-canary.7 investigation](../plans/jobs/2026-11-20-canary-7-turn-reporting-and-shutdown.md)

- **Dispatch.** Record the attempt and sent tier once the transport queues `turn/start`. A refused write preserves the thread ID and the completeness of earlier usage totals. A queued request still counts if the server rejects it or its reply is lost.
- **Benchmark start timeout.** If the start RPC times out after a turn was announced, use its thread and turn IDs with the existing interrupt and confirmation logic. Retain the failed trial and attributable usage. Require a matching terminal event before archive or another trial. An interrupt acknowledgement alone leaves the turn unconfirmed.
- **Standard/Fast live check.** Match a cached terminal event to the announced Standard turn even if its start reply is missing. If Standard’s completion remains unconfirmed at timeout, report the error, skip archive, and end the comparison before Fast starts.
- **Shutdown.** Preserve all completed trials in one JSON report. When shutdown fails, return within a deadline with a nonzero exit and `run.shutdownError`. Report the owned group as stopped only after verifying its exit.
- **Suite cancellation.** Remember cancellation for the lifetime of the suite. Let the active fixture record its completion and reject subsequent fixture launches before they allocate a PID.
- **Timing.** Keep the 300-second application-suite allowance while profiling the video and Codex benchmark test families.

## Related Plans

- [Codex CLI benchmark](../plans/plan-2026-11-18-codex-cli-benchmark.md)
- [Codex request timeout contract](../plans/plan-2026-08-21-codex-request-timeout-contract.md)
