---
title: "Interactive Markdown PDF font discovery evidence"
created-date: 2026-07-27
status: completed
agent: codex
plan: ../plan-2026-07-26-interactive-markdown-pdf-installed-font-search.md
---

## Scope

Execute Phase 1 of the Interactive Markdown PDF installed-font search plan.

This phase adds explicit shared timeout classification and a public-safe
fontconfig evidence spike. It records local first-run and subsequent-run timing
evidence without changing the Interactive font-selection lifecycle owned by
Phase 4.

## Starting Boundary

- Starting commit:
  `071bdafab69c22a9de4944aa8bf127f3632c08f2`
- The worktree was clean before Phase 1 began.
- The related research remains `in-progress`.
- The implementation plan is `active`.

## Execution Plan

1. Add explicit timeout classification to shared font discovery attempts.
2. Add deterministic regression coverage for success, failure, cancellation,
   and timeout outcomes.
3. Add the serial fontconfig evidence spike with validated run-count and
   timeout inputs.
4. Record first-run, subsequent-run, total, and adapter latency evidence without
   font names, font paths, or raw command errors.
5. Compare available evidence with the one-second, three-second, and ten-second
   policy boundaries.
6. Run the full repository validation stack.
7. Review the exact Phase 1 commit range and resolve all actionable findings.
8. Remove only the phase-owned local evidence directory after successful
   closeout.

## Evidence Status

Implementation, Node.js live measurements, post-review full validation, widened
commit-range review, and phase-owned report cleanup are complete.

Older or slower hardware is unavailable in the current environment. Phase 1
will record that limitation instead of treating local timing as cross-machine
proof.

## Changes

- Added optional `timeout` classification to the shared discovery command
  result without requiring existing injected runners to provide it.
- Added `timeout` to shared discovery-attempt evidence while preserving
  unclassified failures as `failed`.
- Changed shared attempt timing to use a monotonic clock.
- Preserved sanitized font CLI debug output while exposing the distinct timeout
  status.
- Added a serial fontconfig evidence spike with strict positive safe-integer
  validation for `--runs` and `--timeout-ms`.
- Added deterministic coverage for argument validation, nearest-rank
  percentiles, serial execution, first-run separation, outcome counts, and
  privacy.

## Checkpoint Commits

- `2050e26` — shared timeout classification, regression coverage, plan
  activation, and this job record.
- `1c6713f` — evidence spike and deterministic spike tests.
- `9b62847` — initial live evidence and provisional policy interpretation.
- `11d06d7` — accepted review fixes for runtime identity, timeout-input bounds,
  and missing aggregate/debug regression coverage.
- `e9ded09` — corrected Node.js evidence and initial review dispositions.

## Evidence Method

The spike was bundled locally for the Node.js target, then executed with a
supported Node.js runtime. It ran `discoverSystemFonts` with explicit fontconfig
discovery, attempt evidence enabled, and one timeout value per series. Each
series used 30 serial runs. Total duration used a monotonic clock; adapter
duration came from the shared discovery attempt.

The three series used 1,000 ms, 3,000 ms, and 10,000 ms subprocess ceilings.
The 10,000 ms series provided the generous measurement ceiling. No series
needed a larger diagnostic ceiling.

Reports were redirected to the ignored, phase-owned
`examples/playground/.tmp-tests/markdown-pdf-font-discovery-phase1-Ia0xRz/`
directory and retained through commit-range review. The agreed blocked or
failed path would have retained this exact directory for private handoff.
Successful closeout removed only this directory.

An initial Bun-run evidence set was retained locally but superseded after review
found that its Node compatibility version had been mislabeled as the executing
runtime. The table below contains only the replacement Node.js evidence.

A privacy scan found no font family, full-name, font-path, raw command, stderr,
or developer-specific absolute-path fields.

## Local Timing Evidence

Environment: macOS on arm64 with Node.js 26.5.0. The package supports Node.js
22.23.0 and later.

All durations are milliseconds. Percentiles use the documented nearest-rank
method.

| Timeout ceiling | First total | First adapter | Subsequent total p50 / p95 / max | Subsequent adapter p50 / p95 / max | Outcomes                        |
| --------------- | ----------: | ------------: | -------------------------------: | ---------------------------------: | ------------------------------- |
| 1,000           |     187.155 |           183 |      176.753 / 186.165 / 186.331 |                    174 / 183 / 183 | 30 success, 0 failed, 0 timeout |
| 3,000           |     193.507 |           189 |      177.541 / 183.695 / 188.074 |                    175 / 180 / 185 | 30 success, 0 failed, 0 timeout |
| 10,000          |     183.926 |           180 |      176.348 / 189.574 / 216.436 |                    174 / 187 / 214 | 30 success, 0 failed, 0 timeout |

No measured run reached one second, three seconds, or ten seconds. The largest
observed total duration was 216.436 ms.

A separate one-run Node.js classification check used a 1 ms timeout. It
reported one timeout, zero failures, and zero successes, confirming that the
shared Node.js runner exposes timeout separately from generic failure.

The recorded first run is the first run within each spike process. It is not
proof of a cold operating-system or fontconfig cache because an earlier
entry-point smoke and the preceding series could have warmed shared caches.

## Policy Interpretation

Available evidence supports retaining the selected three-second automatic-wait
threshold and ten-second total hard safety ceiling:

- three seconds remains a user-decision threshold, not a timeout
- ten seconds remains a safety bound measured from the original discovery
  start, not a performance guarantee
- local results provide a regression baseline for this environment
- local results do not prove behavior on older, slower, differently configured,
  or heavily loaded machines

The final Phase 1 gate is **Proceed with limitation**. Available evidence and
timeout classification are usable, while unavailable older-hardware coverage
remains an explicit environment limitation.

## Verification

- `bun test test/fonts-discovery.test.ts test/fonts-discovery-cancellation.test.ts test/fonts-cli-list.test.ts test/fonts-cli-inspect-debug.test.ts test/fonts-cli-check-ttc.test.ts`
  - Passed: 31 tests and 151 assertions.
- `bun test test/markdown-pdf-font-discovery-evidence-spike.test.ts test/fonts-discovery-cancellation.test.ts`
  - Passed: 10 tests and 37 assertions.
- `bun test test/markdown-pdf-font-discovery-evidence-spike.test.ts test/fonts-discovery-cancellation.test.ts test/fonts-cli-list.test.ts`
  - Passed after review fixes: 18 tests and 96 assertions.
- `bunx tsc --noEmit`
  - Passed.
- `bun run lint`
  - Passed.
- `bun run format:check`
  - Passed after targeted formatting.
- `bun run build`
  - Passed.
- Initial `bun test`
  - Passed: 1,762 tests and 9,321 assertions across 223 files.
- Post-review `bun test`
  - Passed: 1,763 tests and 9,333 assertions across 223 files.
- `git diff --check`
  - Passed.

## Review Status

The initial review covered
`071bdafab69c22a9de4944aa8bf127f3632c08f2..9b62847`.

Accepted findings:

- Correct the runtime identity and replace Bun-executed timing evidence with
  supported Node.js runtime evidence.
- Reject `--timeout-ms` values above the Node.js timer maximum of
  2,147,483,647 ms.
- Cover timeout text debug output, empty successful discoveries, all-run and
  threshold aggregates, and small-sample nearest-rank boundaries.
- Record the exact phase-owned report directory and the exact reviewed range.

Rejected findings:

- Replacing the additive timeout discriminator and derived attempt status with
  a broader canonical outcome refactor would expand the shared public contract
  beyond the one new Phase 1 outcome.
- Splitting the evidence spike into more production modules would add structure
  without changing its single-purpose, phase-owned lifecycle. Its normalized
  per-run record already feeds each derived summary, and explicit fontconfig
  discovery intentionally has one adapter attempt.

The widened implementation and evidence review covered
`071bdafab69c22a9de4944aa8bf127f3632c08f2..e9ded09`.
Correctness, test, and maintainability re-review found no remaining actionable
issues. Documentation re-review found one stale pending-validation statement;
this closeout reconciles it with the completed post-review validation.

## Later Complete-Plan Correction

Status: completed.

The Phase 5 complete-plan review later found that the spike's latency summaries
included failed and timed-out attempts, contrary to this research contract:
outcome and threshold counts cover every attempt, while latency percentiles
cover successful calls only.

The accepted correction:

- filters total and adapter latency summaries to successful calls
- keeps failed and timed-out attempts in outcome and threshold counts
- names the successful-run report groups explicitly and bumps the local report
  schema version
- records a public-safe aggregate face-count range across successful calls
- covers mixed success, failure, and timeout outcomes in one regression fixture

The original recorded timing values do not change because all calls in those
live evidence series succeeded. Targeted validation, the full repository suite,
typecheck, lint, formatting, build, and diff checks pass after the correction:

- the correction-focused slice passed 20 tests and 107 assertions across 3
  files
- the complete repository suite passed 1,797 tests and 9,448 assertions across
  226 files
- `bunx tsc --noEmit`, `bun run lint`, `bun run format:check`,
  `bun run build`, and `git diff --check` passed

Correction commits:

- `3058a67` — filter latency summaries to successful calls and reopen premature
  closeout status
- `aed6e75` — make successful-run report groups explicit, use schema version 2,
  and add this durable follow-up record
- `64deca8` — add the public-safe aggregate face-count range and unsuccessful
  first-run regression coverage

Final widened correctness, test, and maintainability review approved
`071bdafab69c22a9de4944aa8bf127f3632c08f2..64deca8` with no remaining
actionable implementation or evidence findings. Documentation review requested
only the final status and exact-range bookkeeping recorded here and in the
implementation plan and Phase 5 job.

## Artifact Cleanup

After the widened review passed, only
`examples/playground/.tmp-tests/markdown-pdf-font-discovery-phase1-Ia0xRz/`
was removed. It contained the phase-owned timing reports, superseded Bun
diagnostics, Node-target spike bundle, and local full-test logs. No other
`.tmp-tests` content was targeted or removed.
