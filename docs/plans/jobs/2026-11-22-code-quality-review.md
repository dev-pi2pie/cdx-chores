---
title: "Code Quality Review Implementation Record"
created-date: 2026-11-22
modified-date: 2026-11-22
status: in-progress
agent: codex
---

[Implementation plan](../plan-2026-11-22-code-quality-review.md) · [Code Quality Review research](../../researches/research-2026-11-22-code-quality-review.md)

## Phase 1. Markdown fenced-code signals

Phase 1 completed through `d2ee7658`. Document signals and direct PDF title detection share top-level fence recognition. Structure signals skip matched blocks. Code signals retain language and unlabeled counts for code fences. [Shared scanner](../../../src/cli/markdown-pdf/profile/fence-signals.ts) · [Phase 1 checklist](../plan-2026-11-22-code-quality-review.md#phase-1-markdown-fenced-code-signals)

| Checkpoint | Evidence |
| --- | --- |
| Baseline `6b83f5a6` | The initial regression run produced seven expected failures, including metadata title suppression and promotion of a fenced table example to a `strong` signal. |
| Implementation `e5ca3059` | Added the shared scanner and regressions for signal counts, title rendering, and table layout. |
| Review `6b83f5a6..e5ca3059` | Found gaps for tilde fences after HTML comments, Pandoc raw-format fences, and quoted attributes with escapes. Correction `1f16a2fa` added coverage for those cases. |
| Review `6b83f5a6..1f16a2fa` | Found a gap after a standalone HTML block. Correction `d2ee7658` covered that boundary and simple definition-list boundaries. |
| Verification at `d2ee7658` | 2,167 unit tests and 65 focused signal and consumer tests passed. The focused run includes 26 signal unit tests and both consumer regressions. Pandoc comparisons agreed on 34 cases. TypeScript, lint, changed-file formatting, and diff checks passed. |
| Final review `6b83f5a6..d2ee7658` | Test and maintainability reviews found no remaining actionable issues in the agreed scope. |

## Phase 2. CSV path containment

Phase 2 completed through `ac268997`. CSV replay resolves its working directory once and validates both endpoint parents before staging moves. The working directory and endpoint parents must stay stable through replay. [Replay checklist](../plan-2026-11-22-code-quality-review.md#phase-2-csv-path-containment) · [Replay contract](../../guides/rename-plan-csv-schema.md#strict-replay-contract)

| Checkpoint | Evidence |
| --- | --- |
| Implementation `59c36b53` | Shared segment-aware lexical containment, validated existing non-symlinked parents against canonical cwd, and rejected invalid source files and directory destinations during preflight. |
| Review `93ee3735..59c36b53` | Security review approved the stable-parent boundary. Test review requested coverage for missing and symlinked source files. Checkpoint `ac268997` added both cases. |
| Verification at `ac268997` | 2,171 unit tests, 125 rename action tests, and 36 focused path, replay, and writer tests passed. Isolated fixtures verified `..draft` replay and rejection before file or CSV changes. `path.win32` checks covered drive and UNC roots and ambiguous path components. TypeScript, lint, changed-file formatting, and diff checks passed. |
| Final review `93ee3735..ac268997` | Security and test reviewers approved the exact widened range for the stable-parent contract. |

## Phase 3. Application test cost and coverage

Implementation started from `888c3b01`. Measure fixture costs and assess coverage before optimizing the Application suite under its 360-second limit. [Phase 3 checklist](../plan-2026-11-22-code-quality-review.md#phase-3-application-test-cost-and-coverage)

| Baseline check | Evidence |
| --- | --- |
| Managed Application suite | The suite reached its 360-second cutoff during video sequence tests after 2,690 reported passes and no assertion failures. JUnit was unavailable and cleanup was withheld because a fixture handoff was incomplete. |
| Summed case times | Benchmark runner 39.171 s, turn recovery 36.612 s, shutdown cleanup 20.675 s, and shared shutdown 14.837 s. |
| Focused video run | All 40 controller, menu, raw-byte, and workflow cases passed, including the fragmented-arrow case. Controller cases summed to 6.290 s. |

| Checkpoint | Evidence |
| --- | --- |
| `0391dd26` and `229383c0` | Shortened selected benchmark waits, used cooperative leaders where shutdown controls observe resistant workers, ran independent refusal cases concurrently, and used decoded Escape for picker state checks. Kept default deadline, raw-byte, signal, and shutdown coverage. Removed a repeated turn-count assertion and retained the final trace check. |
| First managed attempt at `229383c0` | Reached the 360-second cutoff after 2,732 reported passes and no assertion failures. The fragmented-arrow case passed. Process shutdown and cleanup completed. |
| `9e6f5f9b` | Shared immutable Node bundles across independent export cases. Each case kept its own process and fixture directory and now asserts its expected completion outcome. |
| Focused verification | 208 benchmark and 40 interactive video cases passed. Controller case time fell from 6.290 s to 2.235 s. The same 32 export and sequence cases passed in 16.61 s at the baseline and 4.77–4.83 s across three runs after the change. TypeScript, lint, changed-file formatting, and diff checks passed. |
| Managed verification at `9e6f5f9b` | Three sequential `bun run test:integration:app` runs passed all 2,738 cases across 316 files with zero failures, errors, or skips, valid reports, and verified cleanup. Execution took 350.939 s, 345.052 s, and 345.064 s. The slowest run left 9.061 s under the 360-second limit. |
| Exact range review | Test and maintainability reviewers approved `888c3b01..229383c0` and re-reviewed the widened `888c3b01..9e6f5f9b` range with no actionable findings. |
