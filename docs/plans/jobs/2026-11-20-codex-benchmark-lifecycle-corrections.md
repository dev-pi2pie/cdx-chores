---
title: "Codex benchmark lifecycle corrections implementation"
created-date: 2026-11-20
modified-date: 2026-11-20
status: completed
agent: codex
---

## Phase 1. Local dispatch and reporting

Implementation `91062b23` ties dispatch accounting to local stdin acceptance. Checkpoint `9449b660` gives the dispatch test deadline room for bounded fixture teardown. [Implementation plan](../plan-2026-11-20-codex-benchmark-lifecycle-corrections.md#phase-1-local-dispatch-and-reporting)

**Reports and traces.** In both Node callers, immediate `EPIPE` produced no turn request, no sent tier and no successor. The benchmark kept prior usage complete. Healthy local refusal skipped requested archive and delete and advanced to the distinct successor. Real backpressure buffered bytes and reached the server once. After accepted dispatch, transport loss preserved the tier and available benchmark usage. Loss before completion marked the benchmark total partial. Loss after completion preserved the completed result and exited 1 before the successor. The Bun live check also covered wire-level rejection and transport loss before and after completion. [Dispatch tests](../../../test/codex-benchmark/dispatch-accounting.app.test.ts)

**Validation at `9449b660`.** All 170 benchmark and readiness application tests passed, including 22 dispatch regressions. All 48 targeted unit tests passed. The packaged Node CLI also passed probes for local refusal, immediate `EPIPE`, backpressure and later transport loss. The build, TypeScript check, lint, changed-file formatting and implementation diff check passed.

**Review.** The initial reviews caught a potential success exit after between-trial transport loss and gaps in peer-fixture teardown and buffered-byte assertions. The fixes report transport failure, verify the recorded peer has exited before scratch cleanup, and assert positive buffered length. The test and maintainability re-reviews of `138e113e..9449b660` found no outstanding Phase 1 issues.

## Phase 2. Thread identity, scheduling and retention

Implementation `3ef45fdb` gates scheduling and retention on turn evidence. Checkpoint `e2710756` preserves start evidence through recovery and the retention decision. [Implementation plan](../plan-2026-11-20-codex-benchmark-lifecycle-corrections.md#phase-2-thread-identity-scheduling-and-retention)

**Ownership and scheduling.** Both callers skipped dispatch and retention for malformed or reused thread IDs. The structured `input_too_large` refusal preserved dispatch accounting, skipped retention and let the distinct Fast successor start on a healthy, uncancelled connection. Generic lookalikes and structured refusals with same-thread evidence stopped scheduling and skipped retention. A terminal notification alone did not establish a turn ID. [Turn recovery tests](../../../test/codex-benchmark/turn-recovery.app.test.ts)

**Completion and retention.** Matching live completion allowed archive or delete after readback or its deadline, including without a saved `task_complete`. The trace placed retention before the successor. Unconfirmed completion skipped retention, and `keep` issued no retention RPC. Cancellation preserved exit `143` and blocked the successor. Tests also covered each caller's existing timeout and interrupt behavior. [Rollout recovery tests](../../../test/codex-benchmark/rollout-recovery.app.test.ts)

**Validation at `e2710756`.** All 222 benchmark and readiness application tests passed, including 75 turn-recovery tests. All 48 targeted unit tests passed. The packaged Node CLI passed probes for structured refusal, a generic lookalike and structured refusal with terminal-only evidence. The build, TypeScript check, lint, changed-file formatting and implementation diff check passed.

**Review.** Initial review led to immediate wake-up on conflicting start IDs and stronger ordering assertions. A later test showed the live check discarded a contradictory original start reply during readback. Both callers now observe this conflict within the original request deadline and stop before retention or the successor. They also recheck evidence before continuing after a structured refusal. Test and maintainability re-reviews of `2945140c..e2710756` found no outstanding Phase 2 issues.

### Phase 2 Follow-Up

Checkpoint `c3be4614` clears first-token and duration fields when conflicting start evidence invalidates the benchmark turn ID. Before the fix, two readback conflicts and a measured-trial retention conflict each retained stale timings in the JSON row. After the fix, the row preserves recovered counts as partial, shows null throughput, and remains ineligible. The readback conflicts skip retention, the measured-trial conflict preserves its already-issued archive, and all three stop before the next planned trial. Known-ID completed and failed controls retain their timings. [Turn recovery tests](../../../test/codex-benchmark/turn-recovery.app.test.ts) · [Benchmark JSON tests](../../../test/codex-benchmark/benchmark-json.app.test.ts)

**Validation and review at `c3be4614`.** All 156 recovery, JSON, runner and rollout application tests and 30 benchmark unit tests passed. The built Node CLI passed controls for a known measured turn and a timing conflict during archive. Build, TypeScript, lint, changed-file formatting and diff checks passed. Test and maintainability reviews of `c96ac214..c3be4614` found no material issues.

## Phase 3. Live-check test launcher and shutdown

Checkpoint `4a014cc7` moves the turn-recovery and shared-shutdown suites to the test-owned launcher for the Standard/Fast live check. It adds the undelivered group `SIGKILL` regression and preserves the normal, cancellation and denied-escalation controls. [Implementation plan](../plan-2026-11-20-codex-benchmark-lifecycle-corrections.md#phase-3-live-check-test-launcher-and-shutdown) · [Shutdown tests](../../../test/codex-benchmark/shared-shutdown.app.test.ts)

**Shutdown evidence.** The synthetic app-server completed distinct Standard and Fast turns. Both results survived in JSON when group `SIGKILL` reported success with delivery suppressed. The test verified group-directed `SIGTERM` and `SIGKILL` receipts, exit `1` within the bound and a shutdown deadline on stderr. The parent's process-table snapshot at the caller's `exit` event showed the leader and worker alive in the owned group. Fixture release followed that observation, and teardown verified no live member within its deadline. The evidence covers the synthetic POSIX group and its members on macOS.

**Validation at `2550dfef`.** All 223 benchmark and readiness application tests passed, including eight shared shutdown cases. All 60 targeted unit tests passed, including process-table validation. The Node-target build, TypeScript check, lint, changed test file formatting and implementation diff check passed. An actual-delivery control failed the survivor assertion as expected. Forced assertion failures before either readiness receipt and after the exit observation verified bounded group teardown.

**Review.** Test review found that cleanup could lack the group identity if the app-server missed its readiness receipt. Checkpoint `2550dfef` records the app-server PID at spawn so teardown can verify the group even when both readiness receipts are absent. Test and maintainability re-reviews of `3743df4c..2550dfef` found no outstanding Phase 3 issues.

### Phase 3 Cleanup Follow-Up

Checkpoint `6eacea71` records a pending handoff for the detached app-server group before caller launch using the existing managed process receipts. Fixture deletion requires verified caller shutdown and proof that the group has no live members or that the launch created no group. Missing, interrupted or truncated spawn receipts and failed observation leave the handoff pending and preserve the fixture directory and any release marker and receipts. The managed runner reports withheld cleanup and skips later suites. An ordinary assertion failure with verified teardown still cleans up and allows later suites. [Cleanup controls](../../../test/codex-benchmark/shared-shutdown-cleanup.app.test.ts)

**Validation at `ca6e891c`.** All 235 benchmark and readiness application tests, 100 focused runner application tests and 134 runner unit tests passed. A focused managed Bun application leaf ran all 20 shutdown cases and completed normal cleanup. TypeScript, lint, changed-file formatting and implementation diff checks passed.

**Review.** Checkpoint `ca6e891c` adds the missing and interrupted receipt cases and a genuine rejected launch. It isolates direct controls from any enclosing managed suite. The uncertainty controls inject faults after independently confirming the synthetic group stopped. They exercise the real inspector, scheduling and finalizer with controlled suite results. Test and maintainability re-reviews of `f01f9bb7..ca6e891c` found no material issues.

## Benchmark Preload Follow-Up

Checkpoint `f483ebe6` converts the three tracked benchmark preloads and the generated TTY and deadline preloads to ESM. Node loads file URLs with `--import` and Bun uses `--preload`. The EOF and shutdown preloads retain mutable built-in access through `createRequire` and synchronize named exports with `syncBuiltinESMExports`. The fixture references now point to the ESM files, including the historical record of the original CommonJS choice. [Earlier fixture migration](2026-11-18-test-fixture-esm-migration.md)

**Hook evidence.** Node and Bun produced the readback-after-EOF marker, preserved completed results and exited `1`. The socket fixture proved buffered backpressure and immediate `EPIPE`. Shutdown cases checked spawn and signal receipts, process-group observation and cleanup. Doctor and SDK retention exercised signal denial. The generated preloads produced the expected TTY trace and triggered the test deadline. [Dispatch controls](../../../test/codex-benchmark/dispatch-accounting.app.test.ts) · [Shutdown controls](../../../test/codex-benchmark/shared-shutdown.app.test.ts) · [SDK retention controls](../../../test/codex-benchmark/sdk-retention.codex.test.ts)

**Validation at `f483ebe6`.** On macOS with Bun 1.4.5 and Node 26.13.1, 235 benchmark and readiness application cases and eight SDK retention cases passed. With Node 22.23.5, scoped managed app and Codex runs passed 60 and eight cases and completed cleanup. Eight additional Bun TTY, EOF and deadline cases passed with that Node version on the fixture path. The packaged Node CLI passed a preload URL containing spaces and reserved characters on both Node versions. TypeScript, lint, test formatting, preload reference, document link and diff checks passed.

**Review.** Test and maintainability reviews of `adbf4a69..f483ebe6` found no material issues.

## Phase 4. Documentation, validation and closeout

**Initial managed run at `cc9eb597`.** Unit passed. Application reached its 300-second deadline after printing 2,519 case outcomes. The runner stopped Application, retained scratch for an incomplete nested process receipt and left Codex and Pandoc unrun. A later signal-zero probe found the recorded group absent. The `decoder-partial` case failed during the timed-out run and passed on its own at `825320e6`. The aggregate timeout's cause remains unconfirmed.

**Managed rerun at `bcf61d96`.** The Application execution limit increased to 360 seconds. `bun run test:all` passed 2,141 Unit, 2,628 Application, 30 Codex and 5 Pandoc cases with zero failures, errors or skips. Application finished in 345.98 seconds, including the decoder case. All suite processes stopped without escalation, and the runner removed the rerun's scratch and results.

**Focused validation at `bcf61d96`.** All 78 selected lifecycle cases passed, covering both callers' dispatch, identity, retention, timeout, POSIX shutdown and receipt handling, plus EOF and TTY hooks. The Node-target build passed. Package smoke passed on Node 22.23.5 and 26.13.1 for ESM and CommonJS consumers, structured and generic refusals, and a timing conflict during retention. TypeScript, lint, formatting, whitespace, Markdown links and anchors, and Mermaid syntax passed. All 28 existing checkpoint and range references resolve to the same commits at eight characters.

**Review.** Code and test reviews covered `138e113e..825320e6` and the widened `138e113e..bcf61d96` with no material findings. Both reviewers found the six-minute limit justified for the observed workload. The roughly 14 seconds of headroom leaves reliability under timing variation unverified. Documentation review checked the guide, research, plan and job record against the implementation and evidence. [Benchmark guide](../../guides/codex-benchmark.md) · [Implementation plan](../plan-2026-11-20-codex-benchmark-lifecycle-corrections.md#phase-4-documentation-validation-and-closeout)

**Evidence limits.** The native Codex 0.171.0 probe observed the structured input-size refusal. Tagged source inspection supports the Core reply-loss path. The shutdown and cleanup regressions use synthetic POSIX groups on macOS. Other native error ordering, real fault frequency, Windows descendant cleanup and escaped descendants remain unverified. [Lifecycle research](../../researches/research-2026-11-20-codex-benchmark-lifecycle-evidence.md)
