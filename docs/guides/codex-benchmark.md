---
title: "Codex Benchmark"
created-date: 2026-11-18
modified-date: 2026-11-20
status: completed
agent: codex
---

## Run A Comparison

`cdx-chores codex-bench` runs the same prompt in fresh Codex sessions and reports timing for each model and speed. Add `--show-token-usage` for reported token counts. Use a working Codex configuration and select models and tiers your provider supports.

```sh
cdx-chores doctor --details
cdx-chores codex-info models --details
cdx-chores codex-bench --runs 1
```

**Why send the prompt twice?** `codex-bench` compares repeated requests. A model’s first request can take longer than later ones. With only one measured trial, that extra time could make one model or speed look slower simply because of its first request. The benchmark gives each case one warm-up, then counts the next request as its first measurement. Both requests start in fresh sessions so each receives the same prompt with no prior conversation history.

The benchmark check in `doctor` initializes the app-server, reads its version, and closes it. If shutdown fails, the check reports `failed` and keeps any version it read. Use Codex 0.170.0 or newer for the verified baseline. `codex-info models --details` lists advertised tiers and catalog defaults when available. A completed trial confirms the provider accepted its request. The report shows the requested speed. Codex does not report which speed served the request.

### Compare A Model And Speed Matrix

Repeat `--codex-model` and `--codex-speed` to try every model at every selected speed. This example runs Standard and Fast for each model. Replace the illustrative model IDs with selections available in your Codex configuration.

```sh
cdx-chores codex-bench --codex-model model-a --codex-model model-b \
  --codex-speed standard --codex-speed fast --runs 1
```

Flag placement does not pair a model with a speed. The benchmark rotates the starting speed across measured rounds. When omitted, model, speed, provider, and reasoning effort inherit from Codex. Use `standard` to request Standard explicitly.

### Compare Specific Pairs

Use repeatable `--case MODEL=SPEED` to choose the exact pairs. The example below sends six requests, with two measured trials per pair.

```sh
cdx-chores codex-bench --case model-a=fast --case model-b=ultrafast \
  --codex-reasoning-effort low --runs 2 --compact
```

Each round follows the order of the `--case` flags.

```text
Warm-up round      model-a=fast -> model-b=ultrafast
Measured round 1   model-a=fast -> model-b=ultrafast
Measured round 2   model-a=fast -> model-b=ultrafast
```

`SPEED` accepts `standard`, `fast`, `ultrafast`, or `inherit`. The value splits at the last `=`, so `--case "model=a=inherit"` selects the model ID `model=a` and inherits its speed. Use either `--case` or the matrix selectors in an invocation. Repeating an identical case adds trials to the same summary row.

One `--codex-reasoning-effort` value applies to the entire invocation regardless of flag order. With `--case MODEL=inherit`, inheritance in the case refers to speed. Omit the effort flag to let Codex resolve it for each trial. To compare Low and High, run the same workload twice with a different explicit effort on each run.

### Set The Workload

`--runs` takes one positive integer and defaults to 3 measured trials per matrix combination or `--case` occurrence. Each gets one additional warm-up. Only measured trials count toward completion and timing statistics. Warm-ups also use tokens. `--show-token-usage` includes their reported usage in the invocation total and shows a warm-up subtotal in detailed terminal output.

The built-in prompt asks Codex to explain an LRU cache. Use `--prompt-file` to supply your own. Markdown (`.md`), plain text (`.txt`), and extensionless files all work. The CLI reads the contents as UTF-8 text and requires at least one non-whitespace character. Markdown is sent as written. Use `--show-prompt` to include the submitted text in the report.

Choose one sample per comparison so every model and speed receives the same workload.

| Sample prompt | Requested response |
| --- | --- |
| [summarize-exhibit.txt](../../examples/playground/codex-bench-prompt/summarize-exhibit.txt) | A two-sentence newsletter announcement for a museum exhibit. |
| [extract-records.md](../../examples/playground/codex-bench-prompt/extract-records.md) | A JSON array of failed job names in table order. |
| [trace-cache.md](../../examples/playground/codex-bench-prompt/trace-cache.md) | Eight hit/miss outcomes and the final LRU cache order. |

From the repository root, run one warm-up and one measured trial with the museum exhibit prompt.

```sh
cdx-chores codex-bench --prompt-file examples/playground/codex-bench-prompt/summarize-exhibit.txt --runs 1
```

## Read The Results

The report groups trials by model and requested speed. The speed and reasoning columns show inherited values when available from completed measured trials. For example, `Inherited (configured Fast)` describes the configured thread tier and `Inherited (Low)` describes the reported effort. Unavailable values show as `Inherited`. A `partial` label means only some completed measured trials supplied the same reported value. `Mixed` means the reported values differ.

| Metric | What it measures |
| --- | --- |
| Codex first token | Time Codex recorded to its first token. This can include time to a reasoning token before visible text. |
| Turn output tok/s | Reported output tokens, including reasoning tokens, divided by the full recorded turn duration in seconds. |
| Turn time | Full duration Codex recorded for the turn. |

Read **Turn time** alongside **Output tok/s**. A task can require several reasoning steps even when it asks for a short answer. A simpler prompt can ask for a much longer response. A short answer can finish sooner yet show a lower token rate because the time before the first token accounts for a larger share of the turn. To compare models or speeds, keep the prompt and its output instructions the same.

The detailed table shows a single value for one usable sample, minimum–maximum for two, and minimum / median / maximum for three or more. `--compact` shows medians. Each metric can have fewer usable samples than completed trials. A usable sample comes from a completed prompt-only response with one assistant text message in the final-answer phase when Codex supplies it, without a model reroute or tool activity. The table uses `—` for unavailable metrics.

In compact mode, **Output tok/s** is the median of the usable measured trials’ individual output rates. With `--show-token-usage`, the **Tokens** line sums reported usage across requests, including input and output tokens. It shows warm-up, measured, and invocation totals. To reproduce a trial’s rate, divide that trial’s output tokens by its own turn time in seconds. The detailed terminal view shows per-request counts as well as totals. Totals include attributable usage from failed or interrupted attempts, with incomplete coverage marked partial.

Input token counts show how much input Codex reported for each turn. The benchmark omits **Input tok/s** because the recorded timings do not isolate the time spent processing that input.

### Write A JSON Report

```sh
cdx-chores codex-bench --prompt-file ./task.txt --runs 1 \
  --json --show-prompt --show-token-usage > report.json
```

`--json` takes precedence over `--compact`. Once benchmark execution begins, stdout contains one JSON report, including when app-server initialization fails. An unreadable or invalid prompt file fails validation before the benchmark starts. The CLI exits with status 2, writes the diagnostic to stderr, and leaves stdout empty.

Terminal stderr shows a temporary status that clears as the run finishes. Redirected stderr carries diagnostics only in JSON mode. In human mode, stderr also carries the startup workload and, in detailed mode with usage enabled, per-request token totals. Use the global `--no-color` option or set `NO_COLOR` for plain terminal output.

JSON request fields keep `null` for inherited selections. Check `trials[].configuredTier` and `trials[].resolvedReasoningEffort` for the available per-trial values, and `sentTier` for any explicit tier override on a queued request. A trial sets `inferenceAttempted` when the transport queues `turn/start`, even under backpressure or if the server later rejects it. A local write refusal leaves `inferenceAttempted: false` and `sentTier: null` and preserves the completeness of earlier usage totals. An attempted trial with missing usage makes the total partial. `servedSpeed` remains `null`. JSON timing values use milliseconds. `--show-prompt` adds `prompt.text`, and `--show-token-usage` adds detailed usage counts and invocation totals.

Both report formats preserve a relative prompt path as supplied and abbreviate paths inside the user's home as `~` on macOS and Unix-like systems or `%USERPROFILE%` on Windows. Use the global `--absolute` or `--abs` option before `codex-bench` to show literal absolute paths, resolving a relative prompt path from the invocation directory.

## Manage Benchmark Sessions

The benchmark keeps its sessions by default, including warm-ups. Use `--session-retention archive` to move them out of active history while preserving the rollout. `--session-retention delete` permanently removes the sessions after confirmed turn completion and rollout readback or its deadline. Retention applies to sessions created by the invocation. A cleanup failure preserves the report and ordinarily returns exit status 1. If Ctrl-C also interrupted the invocation, the CLI reports the cleanup error and exits with status 130. See the [shared retention guidance](codex-execution-configuration.md#retain-codex-sessions) for compatibility.

## Failures and exit codes

An unavailable speed produces a diagnostic while supported combinations continue. On an invocation that runs without local cancellation, a failed trial, transport loss, a failed shutdown, or zero completed measured trials returns exit status 1. If the app-server connection is lost during the workload, JSON retains completed results and records the reason in `run.transportError`. If shutdown fails, `--json` still writes one report with the recorded trials and the reason in `run.shutdownError`.

While the `turn/start` reply is pending, a terminal event matching the announced thread and turn IDs lets the benchmark recover the result immediately. If the 15-second start deadline expires with a known turn ID and completion remains unconfirmed, the benchmark interrupts that turn. It also interrupts a known turn that exceeds its 120-second completion deadline. The timed-out trial stays failed and keeps any attributable usage. Only a matching terminal event permits requested retention and another trial. If the turn ID is missing at the start timeout or the interrupt receives only an acknowledgement by the confirmation deadline, the benchmark skips retention and stops scheduling.

A transient tier lookup failure can leave a failed warm-up alongside successful measurements. For example, if discovery fails during the Fast warm-up in a Fast/Standard comparison, the measured Fast trial can try the failed lookup again. Even if both measured trials complete, the report retains the warm-up failure and the CLI exits with status 1.

If app-server interrupts a turn on its own, the trial is reported as `cancelled`. The CLI prints a diagnostic and exits with status 1 even when other measurements succeeded. Ctrl-C returns status 130, including during app-server initialization, tier discovery, and thread startup.

If Ctrl-C interrupts a pending `thread/start` request, app-server may already have created the session. The cancelled trial shows `threadId: null` and `sessionRetention: null` because the CLI can only archive or delete a session whose ID it has received.

If Ctrl-C arrives after `turn/start` is sent, the CLI allows one second for a pending turn ID to arrive so it can interrupt that turn. If the ID remains unknown, the CLI stops scheduling trials, skips requested cleanup, and returns status 130 with the partial report.

If app-server startup or initialization fails, the CLI returns status 1 and prints the reason on stderr. JSON includes the reason in `run.startupError`, the requested workload, and an empty `trials` array.

## Related Guides

- [Codex execution configuration](codex-execution-configuration.md)
- [CLI output and color](cli-output-and-color.md)
