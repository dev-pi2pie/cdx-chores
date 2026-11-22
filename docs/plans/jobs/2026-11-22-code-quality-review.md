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

## Phase 4. Markdown PDF remote assets

Implementation started from `d900e875`. Use WeasyPrint 70.0 or newer with protocol allowlist support for default-off rendering. The CLI option exists on earlier releases, and 70.0 carries the selected fetcher through to user-supplied stylesheets. Require this capability only when the existing remote-asset opt-in is off. [Phase 4 checklist](../plan-2026-11-22-code-quality-review.md#phase-4-markdown-pdf-remote-assets) · [WeasyPrint 70.0 release notes](https://doc.courtbouillon.org/weasyprint/v70.0/changelog.html#version-70-0)

The WeasyPrint 70.0 capability check used a synthetic transport. HTML-linked and CLI-supplied stylesheets each made zero transport calls under the allowlist and one in the unrestricted control.

| Checkpoint | Evidence |
| --- | --- |
| `27ee5daa` | Added the shared renderer version and option gate and applied the `file,data` restriction when remote assets are disabled. Preserved preflight diagnostics and explicit opt-in. Kept legacy page-number evidence renders on the explicit fixture opt-in path. |
| Review corrections `b9ebdc8d` and `d7fa1a61` | Added a failed-probe regression that preserves existing PDF and HTML outputs. Aligned Doctor’s default readiness with the renderer and exposed basic opt-in readiness separately. |
| Renderer verification | Source and built CLI runs with WeasyPrint 70.0 blocked synthetic transport by default, fetched once with explicit opt-in, and rendered ordinary local and embedded assets. Renderer-denied loads surfaced a warning. An older renderer rejected default mode and rendered benign local input with opt-in. Version fixtures also covered newer stable releases and unverified capabilities. |
| Verification at `d7fa1a61` | 2,171 unit tests and 1,730 focused Markdown PDF and Doctor cases passed. Managed Application (2,749 cases) and Pandoc (5 cases) passed with valid reports and verified cleanup. Build, TypeScript, lint, changed-file formatting, and diff checks passed. |
| Exact range review | Security and test reviewers approved `d900e875..d7fa1a61` after the review corrections. |

### WeasyPrint compatibility follow-up

WeasyPrint’s `URLFetcher.allowed_protocols` filters schemes at load time. Version 69.0 exposes the CLI option. Version 70.0 passes the HTML document’s configured fetcher to CSS supplied through `--stylesheet`, so the same `file,data` restriction covers those stylesheet loads and their imports. [URLFetcher API](https://doc.courtbouillon.org/weasyprint/v70.0/api_reference.html#weasyprint.urls.URLFetcher) · [70.0 stylesheet handling](https://github.com/Kozea/WeasyPrint/blob/v70.0/weasyprint/document.py#L146-L152) · [70.0 release notes](https://doc.courtbouillon.org/weasyprint/v70.0/changelog.html#version-70-0)

| Evidence | Result |
| --- | --- |
| WeasyPrint 65.1 and 69.0 | The built CLI reported `limited` in Doctor Summary and Details. JSON reported default readiness false and opt-in readiness true. Default direct and Interactive export stopped before writing a PDF. Explicit opt-in rendered a PDF with an advanced Profile. |
| WeasyPrint 70.0 | Summary reported `ready`, Details reported `available`, and JSON reported both modes ready. Default direct and Interactive export produced PDFs from local and embedded assets. Supplied CSS made zero synthetic transport requests when restricted and one in the unrestricted control. |
| Opt-in feedback | All three versions emitted one stderr info line with color on a color-enabled terminal and plain text when color was disabled or stderr was redirected. |
| Automated verification | 801 focused Doctor and Markdown PDF tests and 2,171 managed unit tests passed. Build, type check, lint, changed-code formatting, and diff checks passed. |
| Exact code review | Maintainability and test reviewers approved `0154c81b..3f686692` with no actionable findings. |

## Phase 5. Codex cancellation coverage

Implementation started from `2725722b`. The discovery transport tests now cancel after observing the pending request and check that every fixture process exits. [Phase 5 checklist](../plan-2026-11-22-code-quality-review.md#phase-5-codex-cancellation-coverage)

| Checkpoint | Evidence |
| --- | --- |
| `e9b6ce22` | Wait for `config/read` or the second `model/list` request before aborting. Append one PID per launch, require both launches in the repeated-invocation case, and verify every exit with `ESRCH`. |
| `0a1eeeda` | When a child is still running, preserve the failure and request bounded fixture-scoped shutdown. Retain diagnostics when exit or launch count is unverified. |
| Verification | All 40 discovery transport cases passed. Five lifecycle cases passed five repetitions each. An injected scenario failure confirmed the fallback stopped a pending child and preserved both the scenario and exit failures. TypeScript, lint, formatting, and diff checks passed. |
| Exact range review | The test reviewer approved `2725722b..0a1eeeda` after the teardown correction. |

## Phase 6. Inline prompt lifecycle

Implementation started from `25866e74`. Path and text prompts share raw-session setup, key parsing, cancellation, and one-time teardown. Each prompt owns its completion and validation. [Phase 6 checklist](../plan-2026-11-22-code-quality-review.md#phase-6-inline-prompt-lifecycle)

| Checkpoint | Evidence |
| --- | --- |
| `ede53e55` | Shared session restores terminal mode, detaches listeners, and clears prompt rows on settlement. Cancellation attempts a final draft notification and preserves the cancellation error if the callback throws. Path Tab cycling deduplicates with `Set` in first-seen order, and pending completion stays silent after exit. |
| Verification | 94 prompt, TUI, and renderer tests passed, including Tab order and wraparound, cancellation during a pending lookup, and a throwing draft observer. All 10 Node terminal-input cases passed, including raw and decoded Escape handoff and fragmented arrows. Build, TypeScript, lint, formatting, and diff checks passed. |
| Exact range review | Maintainability and test reviewers approved `25866e74..ede53e55` with no actionable findings. |

## Phase 7. Image framing modules

Implementation started from `e8f504ce`. PNG, WebP, and JPEG each have a parser module behind the existing `imageFramer` factory. The factory validates profiles and selects a parser. The parsers share header accumulation and the framing error. [Phase 7 checklist](../plan-2026-11-22-code-quality-review.md#phase-7-image-framing-modules)

| Checkpoint | Evidence |
| --- | --- |
| `6136d81d` | Extracted the three parsers with the same buffer ownership, profile handling, error behavior, and awaited sink calls. |
| Verification | 482 before-and-after cases matched output bytes, sink call order, and error results for plain and profiled streams. All 18 deferred `begin`, `write`, and `complete` checks passed. The 30 framing and staging tests and 45 Node publication and export tests passed, including slow publication and byte backpressure. Build, TypeScript, lint, formatting, and diff checks passed. |
| Exact range review | Maintainability and test reviewers approved `e8f504ce..6136d81d` with no actionable findings. |

## Phase 8. Markdown PDF mock registrations

Implementation started from `9c3b3e98`. The existing harness installer delegates to font discovery, session, Codex authoring, deterministic authoring, and rendering installers in that order. [Phase 8 checklist](../plan-2026-11-22-code-quality-review.md#phase-8-markdown-pdf-mock-registrations)

| Checkpoint | Evidence |
| --- | --- |
| `a439ebd9` | Moved registrations and per-install counters to their owning services. Shared authoring and rendering defaults through one module and kept the existing harness contract and module URLs. |
| Verification | All 473 Interactive Markdown PDF cases passed before and after the split. All seven registration bodies matched in order, and complete harness results matched for render retry, session retention, cleanup, and saved Project handoff. Two adjacent routing cases, TypeScript, lint, formatting, and diff checks passed. |
| Exact range review | Maintainability and test reviewers approved `9c3b3e98..a439ebd9` with no actionable findings. |

## Phase 9. Test-runner launch preflight

Implementation started from `93135ac0`. Launch validation and its error class now live in a dedicated module. The process runner still exposes the same entry point and error constructor. [Phase 9 checklist](../plan-2026-11-22-code-quality-review.md#phase-9-test-runner-launch-preflight)

| Checkpoint | Evidence |
| --- | --- |
| `c0c42ae5` | Validation wraps failures before the requested spawn. Native synchronous throws propagate with fixture ownership unresolved, and asynchronous launch errors still produce `launch-failed`. Source comparison confirmed the launch checks, public type declarations, and runner body match the baseline. |
| Verification | All 70 focused process, output, fixture, capability, and observation tests passed before and after extraction. Coverage includes throws after allocation, relative-path probe fallback, missing executable and working directory, output draining, and group shutdown. The managed Unit suite passed 2,171 cases with verified cleanup. TypeScript, lint, formatting, and diff checks passed. |
| Exact range review | Maintainability and test reviewers approved `93135ac0..c0c42ae5` with no actionable findings. |
