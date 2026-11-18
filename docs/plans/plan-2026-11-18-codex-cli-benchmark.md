---
title: "Codex CLI Benchmark Implementation"
created-date: 2026-11-18
status: active
agent: codex
---

## Goal and Scope

Implement `cdx-chores codex-bench` for fresh, persisted Codex trials. Compare recorded first-token timing, full turn duration, and output tokens per second for a fixed prompt. Add command-local `--codex-speed` to the existing Codex execution selectors, including the explicit `interactive` startup command. Establish the shared session lifecycle for retention and verify representative one-shot and multi-turn helpers before extending it to the remaining helpers. Leave the interactive benchmark picker for future work.

## Implementation Record

The [research](../researches/research-2026-11-18-codex-cli-benchmark.md) holds the design rationale, examples, and exploratory findings. This plan defines implementation scope, phases, and acceptance checks. Use the [unified job record](jobs/2026-11-18-codex-cli-benchmark.md) to record what shipped, verification commands and results, and the reviewed code ranges.

## Phase 1. Verify Rollout Recovery Offline

Exercise the [live-check spike](../../scripts/spikes/codex-benchmark-live-check.ts) with a fake app-server over stdio and real JSONL files in an isolated custom Codex home. Add a test seam for the executable and for observing the first file read. Keep a single rollout-reading path for these checks and reuse it in the command. Begin the bounded recovery window when the matching `turn/completed` arrives, with app-server still running.

| Fixture | Expected evidence |
| --- | --- |
| Delayed write | Return the rollout path from `thread/start`. Emit completion with the saved terminal line incomplete. Finish that line after the first read. Verify the first read misses, a retry recovers the matching `task_complete`, and the saved timing and usage are returned. |
| Path fallback | Return `path: null` from `thread/start` and the first `thread/read`. Return a path from the next lookup. Verify both lookups use the original thread ID and the first file read uses the exact returned path. Track lookup retries independently of first-read success. |
| Deadline expiry | Withhold the terminal line or keep the path unavailable. Verify recovery stops within the configured budget, preserves the live outcome, and returns unavailable for saved timing and throughput. Preserve the latest safely attributable usage as partial when a snapshot exists. |
| Interrupted turn and attribution | Match `task_started` and `turn_aborted` by turn ID. Cover cumulative snapshots counted once, interruption with partial usage and no terminal line, a later start ending attribution, and a snapshot without a matching start. |
| Session retention | Use synthetic sessions to verify omitted and explicit `keep`, explicit `archive` and `delete`, cleanup only after confirmed completion and readback or deadline, preservation of captured metrics on cleanup failure, and cleanup scoped to the invocation's thread IDs. |

- [x] Add the offline fixture harness with a temporary Codex home and real JSONL.
- [x] Pass the delayed-write and path-fallback fixtures. Gate the write on the first read and assert ordering and recovered values without requiring exact timing.
- [x] Pass the deadline, interruption, and attribution fixtures. Record the retry deadline and interval chosen for the command.
- [x] Pass the retention fixture for all modes and cleanup outcomes in the table.

Phase 1 evidence and the reviewed code range are recorded in the [unified job record](jobs/2026-11-18-codex-cli-benchmark.md#phase-1-offline-rollout-recovery).

## Phase 2. Verify Speed Request Wiring Offline

Capture outbound inference requests at a fixture provider through the SDK and app-server. In the development probes, configure speed through the SDK constructor's existing `config` option and send `serviceTierForTurn` directly to app-server. Use Fast and Standard baselines to check overrides in both directions. Reuse the fixture in Phase 3 to verify the integrated helper and benchmark entry points.

| Configured speed | Selection | Evidence required on both paths |
| --- | --- | --- |
| Fast | Omitted | The request inherits Fast. |
| Fast | `standard` | The request uses Standard. For app-server, exercise `serviceTierForTurn: "default"`. |
| Standard | Omitted | The request inherits Standard as the control for the explicit Fast and Ultrafast cases. |
| Standard | `fast` | The request uses the fixture catalog's Fast tier. |
| Standard | `ultrafast` | The request uses the fixture catalog's Ultrafast tier. |

- [x] Capture outbound requests through the SDK using the fixture configuration and every selection in the table.
- [x] Capture outbound requests through app-server using the same cases and confirm the per-turn Standard override.
- [x] Record the observed mappings in the unified job record, link the live acceptance evidence, and resolve mismatches before exposing the selector.

Phase 2 mappings and the reviewed code range are recorded in the [unified job record](jobs/2026-11-18-codex-cli-benchmark.md#phase-2-offline-speed-request-wiring).

## Phase 3. Wire the CLI and Trial Runner

- [x] Share the command-local `--codex-speed standard|fast|ultrafast` validator. Existing helpers accept one explicit speed and keep it through retries, repairs, and regeneration, including interactive startup. Omitted speed inherits Codex configuration. Preserve existing helper reasoning defaults. For `codex-bench`, omitted model, provider, reasoning effort, and speed all inherit.
- [x] Register `codex-bench` with repeatable model and speed selectors. Build the model × speed workload independent of flag order. Accept a single positive `--runs` value, defaulting to 3 per combination. Load the built-in prompt or read and validate a UTF-8 `--prompt-file` once before inference.
- [x] Use one fresh persisted thread per request. Schedule one warm-up per combination and then sequential measured rounds that rotate the starting speed for each model. Reuse Codex executable resolution and compatible JSON-RPC framing. Handle turn notifications, cancel the active turn on interruption, and stop scheduling new trials. Read each trial's rollout using the Phase 1 behavior.
- [x] Use the shared, command-local `--session-retention archive|keep|delete` option on `codex-bench` and the live-check script. Default to `keep` and require an explicit selection for archive or permanent deletion. Apply the policy to the invocation's trial threads after confirmed completion and rollout readback or deadline, including for warm-ups. Keep metrics and show each cleanup failure or skipped cleanup with the thread ID when known.
- [x] Add a shared lifecycle for SDK helpers that records newly owned thread IDs and applies retention once when each thread is released. Send archive or delete through app-server using the same resolved executable and Codex home used to create the thread. Use Codex CLI 0.170.0 as the verified baseline. Verify the requested RPC on the selected executable, including overrides, and report unsupported requests separately from the helper result. `keep` needs no retention RPC. [Supported versions and rationale](../researches/research-2026-11-18-codex-cli-benchmark.md#session-retention)
- [x] Validate one one-shot SDK helper. Capture its result or error and wait for SDK execution to settle before cleanup. Verify cleanup targets only its newly created thread and that a cleanup error preserves the original result or error.
- [x] Validate two turns on one owned thread through the shared SDK lifecycle, with cleanup once after the final use. Verify thread release in Interactive, where each current regeneration owns a fresh thread.
- [x] Inventory the remaining Codex helpers and adopt the option after verifying each owned-thread and release boundary. Keep cleanup failures and skips visible with the known thread ID, including when a cancellation leaves completion unconfirmed.
- [x] Capture requested selectors, live outcome, saved metrics, and sample eligibility per trial. Require a completed turn with one assistant text message and final-answer phase when supplied. Exclude tool activity and a reported model reroute from speed summaries. Preserve available usage and report rejected speeds as unavailable.
- [x] Test option placement, inheritance, invalid inputs before inference, and explicit speed propagation through existing helper retries using the Phase 2 fixture.
- [x] Test prompt reuse, fresh-thread isolation, failed and cancelled trials, and retention ordering through the CLI. Verify four warm-ups and twelve measured trials for the default two-model/two-speed comparison.
- [x] Run a mixed-support fixture. Report the unavailable model and speed combination as unavailable and verify that the supported combinations still complete at their requested speeds.
- [x] Replay a completed turn with a single commentary message. Assert that it counts as completed, preserves available token usage, and supplies zero eligible performance samples to the results layer.

Phase 3 evidence and the reviewed code range are recorded in the [unified job record](jobs/2026-11-18-codex-cli-benchmark.md#phase-3-cli-and-trial-runner).

## Phase 4. Benchmark Results

- [x] Aggregate each model and requested speed separately. Count completed trials and usable samples per metric. Calculate Turn output tok/s from complete saved output usage, including reasoning, divided by a positive full saved turn duration. Use measured samples only in summaries.
- [x] Emit one unstyled result object on stdout in `--json` mode with stable per-trial and summary fields, unavailable values as `null`, and `servedSpeed: null` per trial. Include the prompt source and resolved selection context when available. Include the prompt text with `--show-prompt`. With `--show-token-usage`, include per-trial counts and invocation totals, including warm-ups and safely attributable partial usage. Mark totals partial when any request has missing or incomplete usage.
- [x] Replay the fixtures to verify sample counts and JSON summaries for zero through three usable samples, including partial trials and incomplete invocation totals.
- [x] Exit with status `1` when a requested archive or delete fails after successful inference. Test both modes and assert that stdout still contains the complete JSON report, the trial stays `completed`, and the separate retention failure includes the affected thread ID.

Phase 4 evidence and the reviewed code range are recorded in the [unified job record](jobs/2026-11-18-codex-cli-benchmark.md#phase-4-benchmark-results).

## Phase 5. CLI Usage and Diagnostics

- [x] Add `codex-bench --help` and update help for adopted commands. Verify flag placement, defaults, repeatable selectors, inheritance, session-retention choices, and terminal and JSON usage examples.
- [x] Render one terminal row per model and requested speed with completed and per-metric usable sample counts. Show `—`, a single value, minimum–maximum, or minimum/median/maximum for zero, one, two, or at least three usable samples. Show partial totals when token usage is requested. Escape terminal control characters in displayed prompt text.
- [x] Send the startup workload, live status, diagnostics, and opt-in running usage to stderr. On a TTY, update one live line and fit it to terminal width, including after a resize during a streaming pause. Clear the active line on completion, failure, and cancellation. On redirected stderr, print one startup line plus diagnostics and opt-in totals.
- [x] Apply shared terminal styling and honor `--no-color`, `NO_COLOR`, and redirected streams. Verify terminal rendering for zero through three samples, partial usage, TTY resize and cleanup, redirected stderr, and clean JSON stdout even while progress or diagnostics are emitted.
- [x] Add a local benchmark prerequisite check to `doctor`. Report prerequisites met when the resolved Codex executable reports version 0.170.0 or later and app-server initialization succeeds. Report an older or unknown version as unverified, and a missing executable or failed initialization as a local failure with actionable guidance. Test each outcome with fixtures. Limit the result to local prerequisites such as version and startup. Run zero benchmark trials and preserve the existing workflow-specific checks.
- [x] Show advertised service tiers in the `codex-info models` summary, `--details`, and `--json`. Include the advertised default when available in `--details` and `--json`. Preserve unknown capability when metadata is absent. Test all three views and label the tiers as catalog data. Provider acceptance remains a live-trial result, and served speed remains unknown.

Phase 5 evidence and the reviewed code range are recorded in the [unified job record](jobs/2026-11-18-codex-cli-benchmark.md#phase-5-cli-usage-and-diagnostics).

## Phase 6. Benchmark Usage Presentation

- [x] With `--show-token-usage`, label each settled request on stderr as `Warm-up` or `Trial N/M`. Identify the model and requested speed for comparisons. After rollout readback, show the request's reported total and the cumulative invocation total, with partial or unavailable usage labeled.
- [x] With `--show-token-usage`, render a compact usage table in the human report. Show the trial label, model, requested speed, input, output, and total. Include separate warm-up and measured subtotals and an invocation total. Use the existing JSON usage fields for detailed counts such as cached input and reasoning output.
- [x] Include attributable usage from failed or interrupted attempts in the appropriate subtotal and invocation total. Exclude catalog skips that never attempted inference. Mark each affected subtotal partial and use the existing missing-count convention. Compute speed statistics from eligible measured samples.
- [x] Verify single- and multi-combination runs, opt-in behavior, partial and missing usage, failed or interrupted trials, and subtotal reconciliation. Check redirected stderr and verify that opt-in progress leaves JSON stdout as one parseable report.

Phase 6 evidence and the reviewed code range are recorded in the [unified job record](jobs/2026-11-18-codex-cli-benchmark.md#phase-6-benchmark-usage-presentation).

### Phase 6 Follow-Up

- [x] Add opt-in `--compact` for human output. Show one row per model and requested speed with completed counts and the median of each available metric. With `--show-token-usage`, show one line with warm-up, measured, and invocation totals, including partial and unavailable labels. On stderr, limit routine compact progress to the startup workload line and resize-aware TTY status.
- [x] At the benchmark report boundary, shorten home-directory prefixes in terminal and JSON path fields to `~/…` on macOS and Unix-like systems or `%USERPROFILE%\…` on Windows. Match the actual home directory and its descendants. Keep the supplied relative prompt path by default and use the existing `--absolute` and `--abs` aliases to return literal absolute paths, resolving a relative prompt path against the invocation directory. Apply this to the reported Codex home and prompt-file path.
- [x] Update `codex-bench --help` with compact output, token usage, and absolute paths. Run the compact example with the built CLI against a fixture provider.
- [x] Verify compact medians and partial or missing usage. With `--compact --show-token-usage`, check for startup only on redirected stderr and startup plus live status on a TTY during a clean run. Cover Unix and Windows paths, a custom Codex home outside the user home, a sibling path with a similar prefix, and both absolute aliases.
- [x] Restore one resize-aware live progress line on TTY stderr in `--json` mode. Clear it before the report or final diagnostics, including on failure and cancellation. Reserve redirected stderr for diagnostics. Write one JSON report to stdout with any requested token usage.
- [x] Style benchmark diagnostic labels on TTY stderr using the shared color rules. Use yellow for `unavailable` and retention `skipped`, and red for trial, retention, and shutdown failures. Use plain text on redirected stderr and honor `--no-color` and `NO_COLOR`.
- [x] Update `codex-bench --help` to explain JSON progress and redirection, `--show-prompt` adding `prompt.text`, and `--prompt-file` reporting a relative path as supplied unless `--abs` or `--absolute` is used to resolve it against the invocation directory.
- [x] Verify resize redraw and cleanup before the report or diagnostics, one parseable JSON object with requested token usage and prompt text, and empty redirected stderr on a clean run. Check relative and absolute prompt paths and run the JSON help example with the built CLI against a fixture provider.
- [x] Verify diagnostics on failure and cancellation when available. In a mixed-speed run, check that the unsupported-speed warning remains visible, the affected trial is `unavailable` with an error in JSON, and supported trials complete. Test the diagnostic colors on a TTY and plain output with redirection, `--no-color`, and `NO_COLOR`.
- [x] Add repeatable `--case MODEL=SPEED` to `codex-bench` for explicit model and speed pairs. Split the value at the last `=` so model IDs can contain `=`. Require a nonempty model and one of `standard`, `fast`, `ultrafast`, or explicit `inherit`. For example, `--case "model=a=inherit"` selects model `model=a` and inherits speed from Codex. Reject invocations that mix `--case` with `--codex-model` or `--codex-speed`.
- [x] Schedule `--runs` measured trials and one warm-up per `--case` occurrence. Preserve input order in each round. Repeated identical pairs add trials to the same model–speed summary. Retain the model × speed matrix for `codex-bench --codex-model` and `--codex-speed`, including inherited speed when the flag is omitted. Keep `--codex-speed` a single override on other Codex helpers.
- [x] Update help and verify explicit pairing, two speeds for one model, model IDs containing `=`, explicit inheritance, malformed values, selector conflicts, and existing matrix behavior. Check progress counts and terminal and JSON results, including one summary with the combined trial counts when the same pair is repeated. Run the paired help example against a fixture provider.

Follow-up evidence and the reviewed code range are recorded in the [unified job record](jobs/2026-11-18-codex-cli-benchmark.md#phase-6-follow-up).

## Phase 7. Documentation and Validation

- [ ] Create a benchmark usage guide with examples for matrix and explicit model–speed comparisons, prompt files, run counts, metrics, compact and detailed terminal views, JSON progress and redirection, token usage, and diagnostic commands. Document home-relative report paths and the absolute-path aliases. Add an output reference if the report schema needs a stable lookup page.
- [ ] Update the shared Codex execution guide with adopted commands and selector inheritance. Document command-local retention, `keep` by default, explicit archive and permanent deletion, and app-server version requirements.
- [ ] Check both guides against the built CLI help, `doctor`, and `codex-info` output. Validate example commands against a fixture provider.
- [ ] Run the focused fixture and CLI suites, TypeScript, lint, formatting, build, and a built Node CLI smoke check.
- [ ] During live progress, resize the terminal narrower and then wider between text chunks. Verify the status clears wrapped rows, restores detail when space returns, and produces the same report metrics from the saved records.
- [ ] Complete the unified job record with the final validation commands and results. Review the final CLI documentation against the shipped behavior.

Record the final validation and documentation review in the [unified job record](jobs/2026-11-18-codex-cli-benchmark.md#phase-7-documentation-and-validation).

## Related Research

- [Codex CLI benchmark and speed selection](../researches/research-2026-11-18-codex-cli-benchmark.md)

## Related Plans

- [Codex execution configuration](plan-2026-09-05-codex-execution-configuration.md)
