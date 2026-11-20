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
