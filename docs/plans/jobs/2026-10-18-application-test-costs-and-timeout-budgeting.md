---
title: "Application Test Costs and Timeout Budget Implementation"
created-date: 2026-10-18
status: in-progress
agent: codex
---

## Scope and Related Documents

This is the unified execution record for all eight phases of the [implementation plan](../plan-2026-10-18-application-test-costs-and-timeout-budgeting.md), informed by the [research](../../researches/research-2026-10-17-application-test-costs-and-timeout-budgeting.md). Reuse this record for later authorized phases. Phase 1 is complete; current execution covers Phase 2 and stops before Phase 3.

## Phase Status

| Phase | State |
| --- | --- |
| 1 — Execution allowance and baseline | Complete; implementation, baseline validation, and implementation range review passed |
| 2 — CLI registration matrix | Coverage, measurements, and managed validation passed; commit-range review pending |
| 3 — Cancellation grace | Not started |
| 4 — DOCX review corpus | Not started |
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

The coverage, measured-cost, and managed-lifecycle gates pass. The complete Phase 2 range starts at `0299df92a7bdfc9ba9acb76d7b204020c0bbd7a9`; its commit-range review remains pending before phase closeout. Phase 3 has not started.
