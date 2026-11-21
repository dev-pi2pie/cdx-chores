---
title: "Codex benchmark lifecycle corrections, Part II — Process ownership and launch evidence"
created-date: 2026-11-21
modified-date: 2026-11-21
status: active
agent: codex
---

## Outcome and scope

Close two gaps in process ownership. Both Node benchmark callers must stop their detached app-server group on `SIGHUP` and preserve the caller’s signal outcome. The managed test runner must recognize a confirmed non-directory working directory before spawn and retain scratch whenever child allocation remains uncertain.

The behavior baseline is `528fdd65`. Research commit `12fa4c89` records the comparison with canary `ba2d93c1`. The main benchmark’s hangup defect occurs on both revisions. The maintainer live check’s default-HUP leak and the runner’s device-cwd scheduling failure are regressions against canary. The process observations cover synthetic POSIX groups on macOS. [Part I plan](plan-2026-11-20-codex-benchmark-lifecycle-corrections.md) · [Part I job record](jobs/2026-11-20-codex-benchmark-lifecycle-corrections.md)

## Implementation Record

Use one [Part II job record](jobs/2026-11-21-codex-benchmark-lifecycle-part-ii.md) for all phases. Add an entry when there is work to report. Link it to the relevant phase checklist and choose a heading that describes what happened. Check off an item once the record contains its evidence.

Record the implementation checkpoint, tested revision and observations that support the result. For reviews, give the exact `base..tip` range and outcome, including the widened range after fixes. Use short Git SHAs for checkpoints, tested revisions and both range endpoints. Generate each abbreviation with `git rev-parse --short=8 <commit>` so Git extends it if eight characters are ambiguous.

## Phase 1. Hangup cleanup in both Node callers

- [x] Turn the hangup probe into four regression cases using the built Node `codex-bench` CLI and the maintainer Node bundle, each with default HUP and the installed exit-42 handler. Before the fix, confirm the default cases leave the leader and worker alive and the handler cases reach `initialize-fallback` and exit 1. [Built Node hangup cases](../../test/codex-benchmark/hangup.app.test.ts)
- [x] Share POSIX HUP cleanup across both callers from detached launch through close. Start bounded shutdown on hangup while initialization is pending, release signal listeners when ownership ends, and preserve default signal termination or the installed handler’s exit policy through startup-error handling. Reuse the existing group shutdown and signal ownership logic where their contracts match. [Signal scope](../../src/adapters/codex/app-server-signals.ts) · [Bounded shutdown](../../src/adapters/codex/app-server-shutdown.ts)
- [x] In all four cases, verify caller and app-server group identities, wait for the resistant leader, worker and pending initialization, then signal the caller’s group. With escalation allowed, require group TERM and KILL, bounded caller exit before the initialization fallback, and zero live members in the parent’s caller-exit snapshot. Assert termination by `SIGHUP` for the default and normal exit code 42 for the handler. Release the fixture after the snapshot and independently verify teardown, including on assertion failure. [Exit observer and teardown](../../test/codex-benchmark/fixtures/shutdown.ts)
- [x] Rerun the doctor and SDK retention signal controls, the denied and undelivered escalation cases, and both benchmark callers’ INT/TERM controls. Verify the benchmark can interrupt a known active turn and emit its partial report, the live check closes immediately, and the initiating signal retains its exit status. [Benchmark cancellation](../../test/codex-benchmark/benchmark-runner.app.test.ts) · [Doctor](../../test/doctor/commands/codex-benchmark.app.test.ts) · [SDK retention](../../test/codex-benchmark/sdk-retention.codex.test.ts)

## Phase 2. Working-directory rejection before spawn

- [x] Add `os.devNull` from `node:os` once to the cases exercised by both the direct and managed shutdown-fixture tests. Confirm the tests expose the pre-fix behavior observed with `/dev/null` on macOS, including two pending receipts, retained scratch and skipped Codex and Pandoc suites in the managed case. [Direct and managed cases](../../test/codex-benchmark/shared-shutdown-cleanup.app.test.ts)
- [x] After successful `statSync(cwd)`, use `!stats.isDirectory()` to reject a confirmed non-directory before public `spawn`. Preserve the pre-spawn rejection type and native-shaped `ENOTDIR` cause, the existing `ENOTDIR` path-component check and native settlement for a missing path. [Launch preflight](../../scripts/testing/execution/process.ts)
- [x] Require direct fixture cleanup and two managed `launch-rejected` completions with `stopped: true`, no PID, group ID or start record. Verify Application still fails, scratch is removed, and the runner schedules Codex and Pandoc. Rerun the existing regular-file, trailing-slash, child-component and missing-cwd controls. [Receipt inspector](../../scripts/testing/fixtures/fixture-process.ts) · [Missing cwd control](../../test/test-runner/process.app.test.ts)
- [x] Exercise the opposite outcome through the managed runner. When public `spawn` allocates a live child and then throws a native-shaped `ENOTDIR`, verify the receipt stays pending, scratch is retained and Codex and Pandoc stay unrun. Use the existing control’s independent child cleanup. [Post-allocation fixture](../../test/test-runner/fixtures/spawn-after-allocation.mjs) · [Ownership assertions](../../test/test-runner/fixture-context.app.test.ts)

## Phase 3. Code validation and review

- [ ] Run the targeted lifecycle and runner tests, `bun run test:all`, the Node-target build and packaged CLI smoke, TypeScript, lint, changed-file formatting and diff checks. Record suite outcomes, cleanup and tested revision in the unified job.
- [ ] Review the full Part II implementation and test range. Resolve findings, rerun affected checks and record the final tested revision and reviewed range before starting Phase 4.

## Phase 4. Documentation validation and closeout

- [ ] Use the Phase 3 results to update the benchmark guide with verified HUP behavior and Part II of the shared research with before/after evidence and platform limits. [Benchmark guide](../guides/codex-benchmark.md)
- [ ] Review the affected documentation against the evidence in the unified job record. Check links, anchors and research diagrams. Resolve documentation findings and record the reviewed range and outcome.
- [ ] Reconcile the plan checklists and the plan, job and research statuses with the verified outcomes.

## Related Research

- [Part II — Detached process ownership and launch evidence](../researches/research-2026-11-20-codex-benchmark-lifecycle-evidence.md#part-ii--detached-process-ownership-and-launch-evidence)
