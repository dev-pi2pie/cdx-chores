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

## Fixture Readback Timing Follow-Up

Checkpoint `df48b2f2` uses a 250 ms test-only readback deadline for selected turns in 11 scenarios. The cases still exercise real subprocesses and rollout readback and verify protocol order and retention decisions. The single-measurement readback-loss and unconfirmed turn-timeout controls retain the default two-second readback. Both signal orders retain the normal interrupt wait and check that sending the second signal succeeds and the first signal determines the exit status. Production deadlines and the 360-second Application limit are unchanged. [Turn recovery tests](../../../test/codex-benchmark/turn-recovery.app.test.ts) · [Benchmark runner tests](../../../test/codex-benchmark/benchmark-runner.app.test.ts)

**Application timing.** Three sequential `bun run test:integration:app --keep-results` runs at `2d934865` preceded three runs with the identical test changes committed in `df48b2f2`. Times are managed test-process seconds. Headroom is measured against 360 seconds.

| Run | Before | After | Headroom before | Headroom after |
| --- | ---: | ---: | ---: | ---: |
| 1 | 343.762 | 326.394 | 16.238 | 33.606 |
| 2 | 343.533 | 323.408 | 16.467 | 36.592 |
| 3 | 347.399 | 323.631 | 12.601 | 36.369 |
| Median | 343.762 | 323.631 | 16.238 | 36.369 |

Median execution fell by 20.131 seconds. Median summed JUnit case times fell by 12.140 seconds in the turn-recovery file and 7.193 seconds in the benchmark-runner file. These six samples measure the observed workload. Reliability under other loads remains unverified.

**Validation.** The 128 focused cases passed. All six managed runs passed the same 2,628 cases across 313 files, with no errors, failures or skips. The runner verified process shutdown without escalation and removed scratch while retaining reports. TypeScript, scoped lint and formatting, Markdown links and anchors, and diff checks passed.

**Guide and review.** The benchmark guide clarifies that observed turn evidence for the refused thread blocks continuation even when IDs agree. Other threads' events leave that decision unchanged. Maintainability, test and documentation reviews of `2d934865..41335ad5` found no material issues. [Benchmark guide](../../guides/codex-benchmark.md#failures-and-exit-codes)

## Shutdown Fixture Pre-Spawn Rejection Follow-Up

Checkpoint `514831d1` classifies failures from checks before spawn as confirmed launch rejections. The shutdown fixture preserves the setup error and completes both managed handoffs without a PID when an invalid deadline or an already-aborted signal prevents launch. The managed runner treats these as ordinary fixture failures, cleans up and runs the later suites. Unclassified failures and unverified app-server shutdown still leave unresolved receipts and withhold cleanup. [Fixture receipt handling](../../../scripts/testing/fixtures/fixture-process.ts) · [Shutdown cleanup tests](../../../test/codex-benchmark/shared-shutdown-cleanup.app.test.ts)

**Validation and review.** All 74 focused shutdown and managed runner cases passed, including direct and managed controls for both launch rejections and the existing uncertain shutdown cases. TypeScript, lint, formatting and diff checks passed. Maintainability and test reviews of `1d76b593..514831d1` found no material issues.

## Maintainer Live Check Bundle Follow-Up

Checkpoint `e3e5232c` keeps the maintainer command on a dedicated Node-targeted ESM bundle in the ignored playground. The bundle preserves the relative default Codex executable and the `CDX_CHORES_CODEX_PATH` override. A direct Bun source invocation with live arguments exits 1 with build and run instructions before app-server launch. Source and bundle help show the same commands. Test-owned entry points still import `runLiveCheck`. Stale invocation examples were removed from the historical research. [Maintainer entry](../../../scripts/spikes/codex-benchmark-live-check.ts) · [Command tests](../../../test/codex-benchmark/dispatch-accounting.app.test.ts) · [Benchmark research](../../researches/research-2026-11-18-codex-cli-benchmark.md#first-live-check)

**Command evidence.** The Node bundle observed immediate `EPIPE` through the fixture override and reported a null sent tier. The server received no turn for the refused thread, no retention request and no Fast successor. The default executable control observed real buffered backpressure, completed both turns and archived both threads. The bundle preserved `SIGINT` and `SIGTERM` exit statuses 130 and 143. The Bun guard and help controls produced no app-server launch receipt or protocol trace. These are synthetic observations on macOS. Windows shutdown remains unverified.

**Validation and review.** At `e3e5232c`, all 66 focused cases passed. The six command cases also passed with Node 22.23.5 on the fixture path. The dedicated bundle build and help, package build, built CLI help, TypeScript, lint, formatting, Markdown links and diff checks passed. Managed `bun run test:all` passed 2,141 Unit, 2,638 Application, 30 Codex and 5 Pandoc cases with zero failures, errors or skips. Application execution took 328.691 seconds. The runner verified shutdown without escalation and removed the run's scratch and results. Maintainability, test and documentation reviews of `54e5ac52..e3e5232c` found no material issues.

**Superseded runs.** The direct-source revision `f07cecb2` passed managed validation. The run at `1adaddfd` was canceled during Application after the direct-Bun guard was requested. It escalated and retained scratch for one incomplete nested receipt. Later signal-zero probes found the recorded leader and group absent.

## Empty Executable Rejection Follow-Up

Checkpoint `c71258ce` rejects an empty executable before spawn and preserves the native diagnostic and `ERR_INVALID_ARG_VALUE` on the rejection and its `TypeError` cause. A whitespace-only executable name and a path ending in whitespace both launched as supplied in isolated checks. [Launch validation](../../../scripts/testing/execution/process.ts) · [Shutdown cleanup tests](../../../test/codex-benchmark/shared-shutdown-cleanup.app.test.ts)

**Regression evidence.** The two new cases failed before the fix. The managed control retained scratch and skipped later suites with two pending receipts and no start records. After the fix, both cases passed. The managed control completed both no-launch receipts without a PID or group ID, removed scratch and ran the later suites. The existing uncertainty controls still withheld cleanup.

**Validation and review.** All 76 focused Application cases and 2,141 managed Unit cases passed. Build, TypeScript, lint, formatting and diff checks passed. Maintainability and test reviews of `10059418..c71258ce` found no material issues.

## NUL Byte Rejection Follow-Up

Checkpoint `64544ab0` checks the executable and the argument list passed to `spawn`. NUL bytes are rejected before launch with `ERR_INVALID_ARG_VALUE` on the rejection and its `TypeError` cause. The diagnostic names `file` or the offending argument index. A process check confirmed that a whitespace-only executable name and valid empty and whitespace arguments still pass through unchanged. [Launch validation](../../../scripts/testing/execution/process.ts) · [Shutdown cleanup tests](../../../test/codex-benchmark/shared-shutdown-cleanup.app.test.ts)

**Regression evidence.** Both new inputs failed the direct and managed controls before the fix. Each managed control retained scratch with two pending receipts and skipped later suites. After the fix, all four controls passed. Both managed handoffs completed as `launch-rejected` without a PID, group ID or start record, allowing scratch removal and later suites. Existing uncertainty controls still withheld cleanup.

**Validation and review.** All 80 focused Application cases and 2,141 managed Unit cases passed. Build, TypeScript, lint, formatting and diff checks passed. Maintainability and test reviews of `a757ece4..64544ab0` found no material issues.
