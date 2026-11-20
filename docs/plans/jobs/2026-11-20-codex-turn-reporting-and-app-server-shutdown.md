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
