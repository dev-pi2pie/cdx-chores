---
title: "Codex benchmark lifecycle corrections implementation"
created-date: 2026-11-20
modified-date: 2026-11-20
status: in-progress
agent: codex
---

## Phase 1. Local dispatch and reporting

Implementation `91062b230f93cb125396b8562d8cdf8bc301ba15` ties dispatch accounting to local stdin acceptance. Checkpoint `9449b6605aabb464097abc604f54888c633ae2d8` gives the dispatch test deadline room for bounded fixture teardown. [Implementation plan](../plan-2026-11-20-codex-benchmark-lifecycle-corrections.md#phase-1-local-dispatch-and-reporting)

**Reports and traces.** In both Node callers, immediate `EPIPE` produced no turn request, no sent tier and no successor. The benchmark kept prior usage complete. Healthy local refusal skipped requested archive and delete and advanced to the distinct successor. Real backpressure buffered bytes and reached the server once. After accepted dispatch, transport loss preserved the tier and available benchmark usage. Loss before completion marked the benchmark total partial. Loss after completion preserved the completed result and exited 1 before the successor. The Bun live check also covered wire-level rejection and transport loss before and after completion. [Dispatch tests](../../../test/codex-benchmark/dispatch-accounting.app.test.ts)

**Validation at `9449b660`.** All 170 benchmark and readiness application tests passed, including 22 dispatch regressions. All 48 targeted unit tests passed. The packaged Node CLI also passed probes for local refusal, immediate `EPIPE`, backpressure and later transport loss. The build, TypeScript check, lint, changed-file formatting and implementation diff check passed.

**Review.** The initial reviews caught a potential success exit after between-trial transport loss and gaps in peer-fixture teardown and buffered-byte assertions. The fixes report transport failure, verify the recorded peer has exited before scratch cleanup, and assert positive buffered length. The test and maintainability re-reviews of `138e113eb126dacfffdceab76dfe4502523f2c81..9449b6605aabb464097abc604f54888c633ae2d8` found no outstanding Phase 1 issues.

## Phase 2. Thread identity, scheduling and retention

Implementation `3ef45fdb5ec1a3e85c5127e813ce8cf1b6a5f8e6` gates scheduling and retention on turn evidence. Checkpoint `e2710756e59f413c002ce9982346fd2f5067ccd4` preserves start evidence through recovery and the retention decision. [Implementation plan](../plan-2026-11-20-codex-benchmark-lifecycle-corrections.md#phase-2-thread-identity-scheduling-and-retention)

**Ownership and scheduling.** Both callers skipped dispatch and retention for malformed or reused thread IDs. The structured `input_too_large` refusal preserved dispatch accounting, skipped retention and let the distinct Fast successor start on a healthy, uncancelled connection. Generic lookalikes and structured refusals with same-thread evidence stopped scheduling and skipped retention. A terminal notification alone did not establish a turn ID. [Turn recovery tests](../../../test/codex-benchmark/turn-recovery.app.test.ts)

**Completion and retention.** Matching live completion allowed archive or delete after readback or its deadline, including without a saved `task_complete`. The trace placed retention before the successor. Unconfirmed completion skipped retention, and `keep` issued no retention RPC. Cancellation preserved exit `143` and blocked the successor. Tests also covered each caller's existing timeout and interrupt behavior. [Rollout recovery tests](../../../test/codex-benchmark/rollout-recovery.app.test.ts)

**Validation at `e2710756`.** All 222 benchmark and readiness application tests passed, including 75 turn-recovery tests. All 48 targeted unit tests passed. The packaged Node CLI passed probes for structured refusal, a generic lookalike and structured refusal with terminal-only evidence. The build, TypeScript check, lint, changed-file formatting and implementation diff check passed.

**Review.** Initial review led to immediate wake-up on conflicting start IDs and stronger ordering assertions. A later test showed the live check discarded a contradictory original start reply during readback. Both callers now observe this conflict within the original request deadline and stop before retention or the successor. They also recheck evidence before continuing after a structured refusal. Test and maintainability re-reviews of `2945140c0aaaf993845d5110c6ba92fac3e72546..e2710756e59f413c002ce9982346fd2f5067ccd4` found no outstanding Phase 2 issues.

### Phase 2 Follow-Up

Checkpoint `c3be46144619706578079b24e7dee9c2595f7e1f` clears first-token and duration fields when conflicting start evidence invalidates the benchmark turn ID. Before the fix, two readback conflicts and a measured-trial retention conflict each retained stale timings in the JSON row. After the fix, the row preserves recovered counts as partial, shows null throughput, and remains ineligible. The readback conflicts skip retention, the measured-trial conflict preserves its already-issued archive, and all three stop before the next planned trial. Known-ID completed and failed controls retain their timings. [Turn recovery tests](../../../test/codex-benchmark/turn-recovery.app.test.ts) · [Benchmark JSON tests](../../../test/codex-benchmark/benchmark-json.app.test.ts)

**Validation and review at `c3be4614`.** All 156 recovery, JSON, runner and rollout application tests and 30 benchmark unit tests passed. The built Node CLI passed controls for a known measured turn and a timing conflict during archive. Build, TypeScript, lint, changed-file formatting and diff checks passed. Test and maintainability reviews of `c96ac2148d558b5e0dfcd7e27dc85344aac7cdcb..c3be46144619706578079b24e7dee9c2595f7e1f` found no material issues.

## Phase 3. Live-check test launcher and shutdown

Checkpoint `4a014cc78294ad2c5f32b1053fbdeb1358461ead` moves the turn-recovery and shared-shutdown suites to the test-owned launcher for the Standard/Fast live check. It adds the undelivered group `SIGKILL` regression and preserves the normal, cancellation and denied-escalation controls. [Implementation plan](../plan-2026-11-20-codex-benchmark-lifecycle-corrections.md#phase-3-live-check-test-launcher-and-shutdown) · [Shutdown tests](../../../test/codex-benchmark/shared-shutdown.app.test.ts)

**Shutdown evidence.** The synthetic app-server completed distinct Standard and Fast turns. Both results survived in JSON when group `SIGKILL` reported success with delivery suppressed. The test verified group-directed `SIGTERM` and `SIGKILL` receipts, exit `1` within the bound and a shutdown deadline on stderr. The parent's process-table snapshot at the caller's `exit` event showed the leader and worker alive in the owned group. Fixture release followed that observation, and teardown verified no live member within its deadline. The evidence covers the synthetic POSIX group and its members on macOS.

**Validation at `2550dfef`.** All 223 benchmark and readiness application tests passed, including eight shared shutdown cases. All 60 targeted unit tests passed, including process-table validation. The Node-target build, TypeScript check, lint, changed test file formatting and implementation diff check passed. An actual-delivery control failed the survivor assertion as expected. Forced assertion failures before either readiness receipt and after the exit observation verified bounded group teardown.

**Review.** Test review found that cleanup could lack the group identity if the app-server missed its readiness receipt. Checkpoint `2550dfef460d207fcf4d5f7b008ec316a4d56056` records the app-server PID at spawn so teardown can verify the group even when both readiness receipts are absent. Test and maintainability re-reviews of `3743df4c272d2e7ffae23a894dc910847472bbaf..2550dfef460d207fcf4d5f7b008ec316a4d56056` found no outstanding Phase 3 issues.

### Phase 3 Cleanup Follow-Up

Checkpoint `6eacea71af82b5cfee8845ba51ffff1efb0da430` records a pending handoff for the detached app-server group before caller launch using the existing managed process receipts. Fixture deletion requires verified caller shutdown and proof that the group has no live members or that the launch created no group. Missing, interrupted or truncated spawn receipts and failed observation leave the handoff pending and preserve the fixture directory and any release marker and receipts. The managed runner reports withheld cleanup and skips later suites. An ordinary assertion failure with verified teardown still cleans up and allows later suites. [Cleanup controls](../../../test/codex-benchmark/shared-shutdown-cleanup.app.test.ts)

**Validation at `ca6e891c`.** All 235 benchmark and readiness application tests, 100 focused runner application tests and 134 runner unit tests passed. A focused managed Bun application leaf ran all 20 shutdown cases and completed normal cleanup. TypeScript, lint, changed-file formatting and implementation diff checks passed.

**Review.** Checkpoint `ca6e891c49bd192a96fcc46794824065c393d3b6` adds the missing and interrupted receipt cases and a genuine rejected launch. It isolates direct controls from any enclosing managed suite. The uncertainty controls inject faults after independently confirming the synthetic group stopped. They exercise the real inspector, scheduling and finalizer with controlled suite results. Test and maintainability re-reviews of `f01f9bb7d1bfdf83197d6e96751f6e333095371d..ca6e891c49bd192a96fcc46794824065c393d3b6` found no material issues.
