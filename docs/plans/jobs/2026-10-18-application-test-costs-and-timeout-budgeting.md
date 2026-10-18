---
title: "Application Test Costs and Timeout Budget Implementation"
created-date: 2026-10-18
status: in-progress
agent: codex
---

## Scope and Related Documents

This is the unified execution record for all eight phases of the [implementation plan](../plan-2026-10-18-application-test-costs-and-timeout-budgeting.md), informed by the [research](../../researches/research-2026-10-17-application-test-costs-and-timeout-budgeting.md). Reuse this record for later authorized phases. Phases 1–3 are complete; current execution covers Phase 4 and stops before Phase 5.

## Phase Status

| Phase | State |
| --- | --- |
| 1 — Execution allowance and baseline | Complete; implementation, baseline validation, and implementation range review passed |
| 2 — CLI registration matrix | Complete; coverage, measured savings, managed validation, and implementation range review passed |
| 3 — Cancellation grace | Complete; coverage, measured savings, managed validation, and implementation range review passed |
| 4 — DOCX review corpus | Coverage, measurements, and managed validation passed; commit-range review pending |
| 5 — Video menu Escape handling | Not started |
| 6 — Managed runner blocked output | Not started |
| 7 — Final validation and reassessment | Not started |
| 8 — Documentation validation | Not started |

## Phase 1: Execution Allowance and Baseline

### Starting Point and Changes

Execution began from clean revision `f0ecf2885a20ee3bf7e79f5d1137613806298ea5` on 2026-10-18. Changes since the planning checkout `e1b9ab15` affect only the research and plan. These are local measurements and do not establish CI or cross-machine timing guarantees.

The implementation changes only application `execution.timeoutMs` from `240_000` to `300_000` and its stale workload rationale in `scripts/testing/suites/suite-policy.ts`. Application preflight, grace/cleanup budgets, other suites, output limits, per-test limits, and one attempt per suite remain unchanged. No optimization or test migration is included.

### Validation

Discovery refreshed the suite inventory: 191 unit files, 299 application files, one Codex file, and three Pandoc files. No test files or assertion owners changed. A runtime comparison against the base policy confirmed that only application execution timeout changed; every other policy value is identical.

| Check | Outcome |
| --- | --- |
| `bun test ./test/test-runner/prerequisites.unit.test.ts` | Passed: 12 tests, 37 assertions, zero failures |
| `bun run lint` | Passed |
| `bun run format:check` | Passed |
| `bunx tsc --noEmit` | Passed |
| `git diff --check` | Passed before the managed baseline |
| `bun run test:integration:app` — first invocation | Failed before test launch because required process observation was unavailable; application state was `not-run`, no results retained, and no new run directory remained |
| `bun run test:integration:app` — invocation after restoring process-observation access | Passed, exit 0: 2,331 cases across 299 files, 14,447 assertions, zero failures/errors/skips; no execution override or retry inside the runner |

The first invocation did not run application tests and is excluded from successful timing samples. After restoring process-observation access, the same normal command passed prerequisite checks and established the baseline on the starting revision plus the policy change. It used the checked-in 300-second allowance, redirected output, and default cleanup, without a diagnostic override. Counts match the historical full-suite inventory. This is one successful baseline sample before optimizations, not evidence of a cost reduction.

| Baseline observation | Result |
| --- | --- |
| Test-process execution | 241.621 seconds; 58.379 seconds below the 300-second allowance |
| Whole managed command | 243.230 seconds, measured externally with a monotonic clock |
| Bun/JUnit reported test duration | 241.581443 seconds; not substituted for process elapsed time |
| Preflight process | Completed in 1.412 seconds; exit 0, `stopped=true`, no signal or escalation |
| Test process | Completed; exit 0, `stopped=true`, no signal or escalation; output drain 24 ms |
| Reports and fixture outputs | Managed validation passed for the complete selected suite |
| Default cleanup | Passed; no retained results or unresolved owned path, no new run directory remained, and pre-existing run directories were preserved |

The changed runner policy is outside the built package; no packaged API or CLI behavior changed, so no separate package build/smoke was required for this phase. Full managed unit validation and the final three application measurements remain Phase 7 work.

### Documentation

The plan is active, the research is in-progress, and this unified job remains in-progress for later phases. Phase 1 task and acceptance checkboxes now reference the verified evidence; Phases 2–8 remain unchecked. The research preserves its historical baseline and links to this current execution record. The testing guide contains no obsolete numeric application allowance, and test ownership/path mappings are unchanged, so the guide and catalogs require no Phase 1 edits. Local Markdown links, footnotes, phase numbering, and whitespace checks passed.

### Review and Gate

The phase base is `f0ecf2885a20ee3bf7e79f5d1137613806298ea5`. The original Phase 1 checkpoints were consolidated after simplifying this record's environment details; the validated runtime change is unchanged.

Before consolidation, code and documentation reviews covered the complete Phase 1 range `f0ecf2885a20ee3bf7e79f5d1137613806298ea5..fe79b3ce493357e58c189cf099045def9cf738c4`. One stale sentence describing the already-passed baseline gate as pending was corrected; final review found no remaining actionable issues. This range identifies the original review history, not the replacement commit. No runtime or test changes followed the verified baseline, so the documentation revisions do not require another application run.

The normal-command baseline gate is satisfied and Phase 1 is complete. The research, plan, and unified record remain open for later phases. Execution stopped before Phase 2; none of its optimization work or later-phase validation was performed.

## Phase 2: CLI Registration Matrix

### Starting Point and Coverage

Phase 2 began from clean revision `0299df92a7bdfc9ba9acb76d7b204020c0bbd7a9` on 2026-10-18. The change is confined to `test/cli-foundations/options/codex-execution-scope.app.test.ts` and its documentation; production registration, shared helpers, test paths, and the 300-second application allowance are unchanged.

All original scenario arrays remain: nine adopted-command help cases, eleven excluded-command help cases, and five rejected invocations. Each uses a fresh Commander program, captured runtime, and real command registration. Expected Commander help/unknown-option outcomes are checked explicitly. A pre-action guard records and throws before real action work; every scenario requires zero action entries.

Four additional cases retain actual source-CLI process boundaries: root help, nested adopted help, root rejection, and excluded-leaf rejection. They check actual output routing and exit behavior; the excluded leaf also verifies an empty owned fixture directory before cleanup. These are Bun source-entrypoint checks, not packaged Node verification. The matrix changes from 25 subprocess cases to 25 in-process cases plus four subprocess cases: 29 tests, with assertions increasing from 90 to 158 through explicit parser outcomes, action guards, and retained boundary checks.

### Measurements and Validation

The complete file was measured three times before editing and three times after, sequentially with comparable runtime and output conditions. Each sample used the same command below and an external monotonic clock; all runs passed, and replacement measurements include every in-process and subprocess case. No substantial concurrent verification work ran during these focused measurements.

```sh
bun test ./test/cli-foundations/options/codex-execution-scope.app.test.ts --path-ignore-patterns '**/fixtures/**'
```

| Whole-file invocation | Run 1 | Run 2 | Run 3 | Median | Observed range |
| --- | --- | --- | --- | --- | --- |
| Original 25-process matrix | 4.165s | 3.994s | 4.007s | 4.007s | 3.994–4.165s |
| Complete replacement | 0.833s | 0.834s | 0.816s | 0.833s | 0.816–0.834s |

The median fell by 3.174 seconds (79.2%) with non-overlapping observed ranges. This demonstrates a local whole-file saving, not a guaranteed full-suite reduction or cross-machine performance result. No failed focused measurements occurred, and no new fixture directory remained after the replacement runs.

| Check | Outcome |
| --- | --- |
| Three baseline and three replacement measurements | All passed; before: 25 tests/90 assertions, after: 29 tests/158 assertions |
| Combined CLI scope, execution-option, and Codex information checks | Passed: 80 tests across three files, 252 assertions, zero failures |
| `bun run lint` | Passed |
| `bun run format:check` | Passed |
| `bunx tsc --noEmit` | Passed |
| `git diff --check` | Passed before managed validation |
| `bun run test:integration:app` | Passed, exit 0: 2,335 cases across 299 files, 14,515 assertions, zero failures/errors/skips |

The combined check used `bun test ./test/cli-foundations/options/codex-execution-scope.app.test.ts ./test/cli-foundations/options/codex-execution.app.test.ts ./test/codex-info/commands.app.test.ts --path-ignore-patterns '**/fixtures/**'`. No production or packaged-code change requires a separate build or package smoke check.

The normal managed command used the checked-in 300-second policy without overrides. Test-process execution took 234.516 seconds; whole-command duration was 235.959 seconds. Preflight and test processes completed with exit 0, confirmed settlement, and no escalation. Report and fixture-output validation passed; default cleanup retained no results, left no new run directory or unresolved owned path, and preserved pre-existing directories. No Phase 2 verification attempt failed.

Compared with Phase 1, the four additional cases account for 2,331 → 2,335 tests, and the matrix's 68 additional assertions account for 14,447 → 14,515 assertions. File inventory remains 299. The full-suite run validates integration and lifecycle behavior; its timing difference from Phase 1 is not attributed entirely to this change. The final three-run suite reassessment remains Phase 7 work.

### Documentation

The plan's Phase 2 tasks and acceptance checks now refer to verified coverage, measurements, and managed results. Research records the observed local saving while preserving the historical baseline. The ownership catalog describes the in-process registration and retained source-CLI boundaries. No files moved and public commands are unchanged, so the path-correspondence catalog and testing guide require no Phase 2 edits. Markdown links, footnotes, phase structure, and whitespace were checked; Phases 3–8 remain unchecked.

### Review and Gate

Phase 2 is accepted. Implementation and validation evidence landed in `b6b138ab88e3e272153af553774edc7a754384bd` (`perf(cli): reduce command registration test process overhead`). Code and documentation reviews covered the full implementation range `0299df92a7bdfc9ba9acb76d7b204020c0bbd7a9..b6b138ab88e3e272153af553774edc7a754384bd` and found no actionable issues. A pre-commit documentation finding was resolved by distinguishing the earlier exploratory timing from the Phase 2 three-run baseline.

Coverage, measured-cost, and managed-lifecycle gates passed. Only documentation closeout followed validation; no test or production code changed afterward. The plan, research, and unified record remain open for later phases. Execution stopped before Phase 3; no cancellation-grace or other later-phase implementation was performed.

## Phase 3: Cancellation Grace

### Starting Point and Coverage

Phase 3 began from clean revision `85b477ac61d6abce9f7bfd0dd23af20e99f6148d` on 2026-10-18. Only the streaming fixtures, their application assertions, and related documentation change. The local `fixtures/cancellation-observer.ts` helper serves the two cancellation scenarios; production code, shared helpers, ownership unit tests, and suite policy are unchanged.

`input-cancel` now passes a fixture-only 250 ms grace. `cancel` omits a grace override, preserving the production two-second default and its existing 1,900–6,500 ms elapsed check. The five-second force budget, 15-second owned-driver timeout, 500 ms outer grace, four-second outer cleanup, 20-second test deadline, and output limits remain unchanged.

| Coverage | Verified observation |
| --- | --- |
| Readiness | Complete `ready` lines; both distinct children in `cancel`; split readiness emission in `input-cancel` |
| Outstanding input | A real write remains pending across an event-loop turn; exactly one write is outstanding and the producer has not settled when cancellation starts |
| Input settlement | Input abort follows cancellation; the producer settles afterward, every started write settles, and no pending write remains |
| Graceful termination | Real spawn wrapper records successful SIGTERM attempts; a separate fixture pipe confirms child-handler execution after ordinary stdout consumption stops |
| Escalation | Resistant children handle SIGTERM before SIGKILL; elapsed time from SIGTERM to escalation must be at least configured grace minus 25 ms scheduling tolerance |
| Closure and disposal | Cooperative child closes with code 0 and no signal; resistant children close with SIGKILL; closure remains confirmed, observation pipes drain, and the application receipt is emitted only after disposal succeeds |
| Failure ownership | Existing unit cases retain unconfirmed closure, unsettled consumers/input, blocked reuse, and immediate-force platform-transition coverage |

The application file still has eleven cases. Its Bun assertion count increases from 44 to 46 through structured cancellation receipts; additional Node assertions inside the driver/observer check ordering and settlement and are not counted by Bun's assertion total.

### Measurements and Validation

Three complete-file runs were collected before editing and three after, sequentially with comparable runtime and output conditions and no competing verification work. An external monotonic clock measured the entire invocation, including build/setup, both cancellation cases, observation overhead, and cleanup.

```sh
bun test ./test/cli-foundations/process/streaming.app.test.ts --path-ignore-patterns '**/fixtures/**'
```

| Whole-file invocation | Run 1 | Run 2 | Run 3 | Median | Observed range |
| --- | --- | --- | --- | --- | --- |
| Original streaming family | 5.086s | 4.890s | 4.870s | 4.890s | 4.870–5.086s |
| Complete replacement | 3.163s | 3.150s | 3.153s | 3.153s | 3.150–3.163s |

The median fell by 1.737 seconds (35.5%), with non-overlapping observed ranges. The unchanged default-grace case still took about 2.06–2.07 seconds; `input-cancel` took about 0.31–0.32 seconds. All six measurements passed, and no new fixture directory remained after replacement runs. These are local observations, not cross-machine timing guarantees; 250 ms requires reassessment if later evidence shows instability.

| Check | Outcome |
| --- | --- |
| Three baseline and three replacement measurements | All passed: eleven cases each; Bun assertions 44 before, 46 after |
| `bun test ./test/cli-foundations/process/ownership.unit.test.ts` | Passed: seven tests, 21 assertions |
| `bun run lint` | Passed |
| `bun run format:check` | Passed |
| `bunx tsc --noEmit` | Passed |
| `git diff --check` | Passed before managed validation |
| `bun run test:integration:app` | Passed, exit 0: 2,335 cases across 299 files, 14,517 assertions, zero failures/errors/skips |

The compiled Node fixture exercises the changed test code through the existing application harness. No packaged-code change requires a separate package build or smoke check.

An initial ad hoc limit comparison also matched the new receipt fields and failed. Restricting that comparison to the owned-process configuration confirmed unchanged outer limits; all eleven modes and the original default timing check were also preserved. This was a checker-scope error, not a failed shorter-grace experiment or a runtime failure.

The normal managed command used the unchanged 300-second policy without overrides. Test-process execution took 236.169 seconds; whole-command duration was 237.664 seconds. Preflight and test processes exited successfully with confirmed settlement and no escalation. Report and fixture-output validation passed; default cleanup retained no results, left no new run directory or unresolved owned path, and preserved pre-existing directories. No Phase 3 runtime verification attempt failed.

Test and file counts match Phase 2; the two new cancellation-receipt assertions account for the increase from 14,515 to 14,517 Bun assertions. The single managed duration does not isolate this optimization's effect on total suite time. The three before/after whole-file samples establish the local saving, and the final three-run suite reassessment remains Phase 7 work.

### Documentation

The plan's Phase 3 tasks and acceptance checks now reference verified lifecycle observations, measurements, and managed results. Research distinguishes the earlier exploratory timing from the measured local saving. The ownership catalog explains default-grace coverage and the shorter input-cancellation fixture. The new observer remains local fixture support; no test files moved, so the path-correspondence catalog is unchanged. Public commands and usage are unchanged, so the testing guide requires no Phase 3 edit. Markdown links, footnotes, phase structure, and whitespace were checked; Phases 4–8 remain unchecked.

### Review and Gate

Phase 3 is accepted. Implementation and validation evidence landed in `1e89255e11a6c9fff8498c443493dd7ebc0106ba` (`perf(testing): shorten streaming input cancellation fixture`). Code, maintainability, and documentation reviews covered the full implementation range `85b477ac61d6abce9f7bfd0dd23af20e99f6148d..1e89255e11a6c9fff8498c443493dd7ebc0106ba` and found no actionable issues.

Coverage, measured-cost, and managed-lifecycle gates passed with the 250 ms fixture grace. Only documentation closeout followed validation; no test or production code changed afterward. The plan, research, and unified record remain open for later phases. Execution stopped before Phase 4; no DOCX corpus or other later-phase implementation was performed.

## Phase 4: DOCX Review Corpus

### Starting Point and Fixture Foundation

Phase 4 began from clean revision `e0ac7761e36af7d7a4b0ca450a7dd986fddd0c32` on 2026-10-18. The inventory audit confirmed 302 cases across nine groups and all 39 proposed supervised IDs, covering all four reader diagnostic classes in this corpus. No additional containment-specific case was identified. Production parsing, runtime supervision, frozen captures, and the 300-second suite allowance remain unchanged.

The first checkpoint adds real compiled direct parsing while retaining the full supervised review corpus. Both observation modes use the existing batch execution/output bounds. Fixture tracking includes input preparation, owned driver completion, and result parsing; closing blocks subsequent launches. Teardown waits for tracked work within a 12-second settlement deadline inside its 15-second hook and retains the directory after unconfirmed settlement or a deadline failure.

A permanent controlled fixture exceeds a 500 ms execution allowance under the unchanged 250 ms grace and three-second termination budget. Its regression starts cleanup while the driver is active, requires the explicit timeout result and confirmed group settlement, observes the directory before removal, and checks removal afterward. This expected timeout is a passing lifecycle test, not a failed optimization attempt.

### Baseline and Checkpoint Validation

Three baseline whole-file measurements ran sequentially before edits with comparable runtime and redirected-output conditions. An external monotonic clock included build/setup, all nine supervised batches, assertions, and cleanup.

```sh
bun test ./test/document-rename/adapters/docx-review.app.test.ts --path-ignore-patterns '**/fixtures/**'
```

| Whole-file invocation | Run 1 | Run 2 | Run 3 | Median | Observed range |
| --- | --- | --- | --- | --- | --- |
| Original supervised review family | 23.318s | 22.988s | 23.387s | 23.318s | 22.988–23.387s |

All three baseline runs passed: one test and 1,364 Bun assertions each. The fixture-foundation check passed all five shared-fixture consumers (`docx-review`, `docx-baseline`, `docx-baseline-contract`, `docx-product`, and `title-evidence`): 121 tests, 1,636 assertions, zero failures. Lint, formatting, TypeScript checking, and whitespace checks passed. A read-only fixture review found no material lifecycle or maintainability issues.

The foundation landed in `94f825205be68d066d7160987f60735d248c7491` (`test(docx): add bounded direct observation fixture path`). Code review of `e0ac7761e36af7d7a4b0ca450a7dd986fddd0c32..94f825205be68d066d7160987f60735d248c7491` found no actionable issues. This checkpoint retained the full supervised corpus and did not establish Phase 4 acceptance.

### Corpus Redistribution and Coverage

The shared matrix now constructs all nine groups, checks global ID uniqueness, resolves every selected supervised ID exactly once, and checks representation of every group and reader diagnostic class. Nine sequential direct tests retain all 302 actual compiled-reader observations. One subsequent supervised test reuses the exact selected input objects and bytes for 39 cases, applies the same complete semantic assertions, and compares the complete observations after JSON transport. Missing direct observations or incomplete/reordered results fail explicitly.

Both modes retain the original exact reader diagnostics or raw text/headings, complete evidence objects, complete prompt comparisons, and failure-reason/null-prompt checks. Independent frozen captures and their baseline/contract assertions are unchanged. Detailed content/drawing checks and dedicated runtime isolation, protocol, limits, cancellation, and recovery coverage retain their existing owners.

Each observation test owns one driver invocation with the planned 45-second enclosing limit and 38-second launch reserve after input preparation. Setup compiles once under 45 seconds; no observations run in setup. The permanent timeout regression follows the ten observation tests and confirms settlement before cleanup. Other shared-fixture callers remain supervised by default.

### Replacement Measurements and Validation

The same whole-file command and measurement method produced these replacement samples, including compilation, all direct and supervised batches, the timeout regression, assertions, and teardown. No competing verification ran during either three-run set.

| Whole-file invocation | Run 1 | Run 2 | Run 3 | Median | Observed range |
| --- | --- | --- | --- | --- | --- |
| Complete replacement | 5.545s | 5.303s | 5.314s | 5.314s | 5.303–5.545s |

All three runs passed: eleven tests, 1,591 Bun assertions, zero failures, and no new fixture directory after each invocation. The median fell by 18.004 seconds (77.2%), with non-overlapping observed ranges. These local whole-file measurements do not establish a CI or whole-suite timing guarantee.

The final review file retains the original 1,364 Bun semantic assertions for all direct inputs. The additional 227 assertions comprise 181 repeated semantic assertions for supervised inputs, 39 complete-observation parity checks, one ordered-corpus completeness check, and six timeout/cleanup assertions. The original single review test becomes ten observation tests plus one timeout regression; the foundation-only one-case parity smoke is replaced by the complete matrix.

| Check | Outcome |
| --- | --- |
| Three replacement measurements | Passed: eleven tests and 1,591 assertions each |
| Affected DOCX and ownership selection | Passed: 555 tests across twelve files, 3,610 assertions, zero failures |
| `bun run lint`, `bun run format:check`, `bunx tsc --noEmit` | Passed |
| `git diff --check` and unchanged production/frozen-capture audit | Passed |
| `bun run test:integration:app` | Passed, exit 0: 2,345 tests across 299 files, 14,744 assertions, zero failures/errors/skips |

The twelve-file selection comprised all five shared-fixture consumers listed above, `docx-runtime.app.test.ts`, the `docx-runtime`, `docx-evidence`, `docx-content`, and `docx-drawing` unit files, plus `test/test-runner/process.app.test.ts` and `test/test-runner/runner-lifecycle.app.test.ts`. It includes existing unconfirmed-ownership and retain-scratch coverage. The application tests compile and execute the changed fixture under Node; no packaged-code change requires a separate package smoke test. No Phase 4 runtime verification attempt has failed. An ad hoc documentation-link check initially misread a footnote label as a path; the corrected checker passed all local links, anchors, and footnote references.

The normal managed command used the unchanged 300-second allowance without hooks or diagnostic overrides. Test-process execution took 214.021 seconds; whole-command duration was 215.475 seconds. Preflight and test processes exited successfully with confirmed settlement and no escalation. Report and fixture-output validation passed; default cleanup left no new run or fixture path and preserved pre-existing paths.

Compared with Phase 3, the managed test count increases by ten and the assertion count by 227, exactly matching the review-file redistribution and added checks; the file count remains 299. The repeated whole-file samples establish this family's saving. This single managed observation does not replace Phase 7's final three-run reassessment.

### Documentation and Gate

The ownership catalog now distinguishes complete direct compiled observations from the named supervised parity matrix. Research records the measured local saving; the plan marks only evidenced tasks and checks. No existing test path moved, so the path-correspondence catalog is unchanged. Public commands and guidance are unchanged, so the testing guide needs no Phase 4 edit.

Coverage, focused-cost, and managed-lifecycle gates pass. Pre-commit code, maintainability, and documentation reviews found no actionable issues. The complete Phase 4 range begins at `e0ac7761e36af7d7a4b0ca450a7dd986fddd0c32`; its commit-range review remains pending before closeout. Phase 5 has not started.
