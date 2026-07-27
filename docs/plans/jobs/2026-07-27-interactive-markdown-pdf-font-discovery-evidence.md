---
title: "Interactive Markdown PDF font discovery evidence"
created-date: 2026-07-27
status: in-progress
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

Implementation, live measurements, and full validation are complete.
Commit-range review and phase-owned report cleanup are pending.

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

## Evidence Method

The spike ran `discoverSystemFonts` with explicit fontconfig discovery,
attempt evidence enabled, and one timeout value per series. Each series used 30
serial runs. Total duration used a monotonic clock; adapter duration came from
the shared discovery attempt.

The three series used 1,000 ms, 3,000 ms, and 10,000 ms subprocess ceilings.
The 10,000 ms series provided the generous measurement ceiling. No series
needed a larger diagnostic ceiling.

Reports were redirected to one ignored, phase-owned directory under
`examples/playground/.tmp-tests/`. They remain local through commit-range
review. A privacy scan found no font family, full-name, font-path, raw command,
stderr, or developer-specific absolute-path fields.

## Local Timing Evidence

Environment: macOS on arm64 with Node.js 24.3.0.

All durations are milliseconds. Percentiles use the documented nearest-rank
method.

| Timeout ceiling | First total | First adapter | Subsequent total p50 / p95 / max | Subsequent adapter p50 / p95 / max | Outcomes                        |
| --------------- | ----------: | ------------: | -------------------------------: | ---------------------------------: | ------------------------------- |
| 1,000           |     204.929 |           201 |      177.440 / 186.023 / 213.402 |                    175 / 184 / 210 | 30 success, 0 failed, 0 timeout |
| 3,000           |     190.219 |           187 |      179.620 / 190.292 / 207.111 |                    177 / 188 / 205 | 30 success, 0 failed, 0 timeout |
| 10,000          |     189.684 |           186 |      180.368 / 187.793 / 191.515 |                    178 / 185 / 189 | 30 success, 0 failed, 0 timeout |

No measured run reached one second, three seconds, or ten seconds. The largest
observed total duration was 213.402 ms.

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

The provisional Phase 1 gate is **Proceed with limitation**. It remains
provisional until the exact commit-range review is complete.

## Verification

- `bun test test/fonts-discovery.test.ts test/fonts-discovery-cancellation.test.ts test/fonts-cli-list.test.ts test/fonts-cli-inspect-debug.test.ts test/fonts-cli-check-ttc.test.ts`
  - Passed: 31 tests and 151 assertions.
- `bun test test/markdown-pdf-font-discovery-evidence-spike.test.ts test/fonts-discovery-cancellation.test.ts`
  - Passed: 10 tests and 37 assertions.
- `bunx tsc --noEmit`
  - Passed.
- `bun run lint`
  - Passed.
- `bun run format:check`
  - Passed after targeted formatting.
- `bun run build`
  - Passed.
- `bun test`
  - Passed: 1,762 tests and 9,321 assertions across 223 files.
- `git diff --check`
  - Passed.

## Review Status

The exact range beginning at
`071bdafab69c22a9de4944aa8bf127f3632c08f2` has not yet been reviewed. Phase 1
remains open until all actionable findings are resolved, the range is
re-reviewed as needed, and the retained local reports are cleaned up.
