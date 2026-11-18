---
title: "Codex Benchmark"
created-date: 2026-11-18
status: completed
agent: codex
---

## Run A Comparison

`cdx-chores codex-bench` runs the same prompt in fresh Codex sessions and reports the timing and token counts Codex saved for each turn. Use a working Codex configuration and select models and tiers your provider supports.

```sh
cdx-chores doctor --details
cdx-chores codex-info models --details
cdx-chores codex-bench --runs 1
```

The benchmark check in `doctor` verifies app-server startup and the Codex CLI version. Use Codex 0.170.0 or newer for the verified baseline. `codex-info models --details` lists advertised tiers and catalog defaults when available. A completed trial confirms the provider accepted its request. The report identifies the requested speed and keeps served speed unknown.

### Compare A Model And Speed Matrix

Repeat `--codex-model` and `--codex-speed` to try every model at every selected speed. This example runs Standard and Fast for each model. Replace the illustrative model IDs with selections available in your Codex configuration.

```sh
cdx-chores codex-bench --codex-model model-a --codex-model model-b \
  --codex-speed standard --codex-speed fast --runs 1
```

Flag placement does not pair a model with a speed. The benchmark rotates the starting speed across measured rounds. When omitted, model, speed, provider, and reasoning effort inherit from Codex. Use `standard` to request Standard explicitly.

### Compare Specific Pairs

Use repeatable `--case MODEL=SPEED` to choose the exact pairs. This example schedules two pairs. The cases run in input order during the warm-up round and in every measured round.

```sh
cdx-chores codex-bench --case model-a=fast --case model-b=ultrafast \
  --codex-reasoning-effort low --runs 1 --compact
```

`SPEED` accepts `standard`, `fast`, `ultrafast`, or `inherit`. The value splits at the last `=`, so `--case "model=a=inherit"` selects the model ID `model=a` and inherits its speed. Use either `--case` or the matrix selectors in an invocation. Repeating an identical case adds trials to the same summary row.

One `--codex-reasoning-effort` value applies to the entire invocation regardless of flag order. With `--case MODEL=inherit`, inheritance in the case refers to speed. Omit the effort flag to let Codex resolve it for each trial. To compare Low and High, run the same workload twice with a different explicit effort on each run.

### Set The Workload

`--runs` takes one positive integer and defaults to 3 measured trials per matrix combination or `--case` occurrence. Each also gets one warm-up in its own fresh session using the same prompt and settings. A warm-up stays out of measured metrics and completed-trial counts. With `--show-token-usage`, its reported tokens contribute to the warm-up subtotal in terminal output and to the invocation total. For one pair, `--runs 3` sends four requests.

The default prompt asks for an explanation of an LRU cache. Pass `--prompt-file` to use one nonempty UTF-8 prompt for all requests. Use `--show-prompt` to include the submitted text in the report.

## Read The Results

The report groups trials by model and requested speed. The speed and reasoning columns show inherited values when available from completed measured trials. For example, `Inherited (configured Fast)` describes the configured thread tier and `Inherited (Low)` describes the reported effort. Unavailable values show as `Inherited`. A `partial` label means only some completed measured trials supplied the same reported value. `Mixed` means the reported values differ.

| Metric | What it measures |
| --- | --- |
| Codex first token | Time Codex recorded to its first token. This can include time to a reasoning token before visible text. |
| Turn output tok/s | Reported output tokens, including reasoning tokens, divided by the full recorded turn duration in seconds. |
| Turn time | Full duration Codex recorded for the turn. |

The detailed table shows a single value for one usable sample, minimum–maximum for two, and minimum / median / maximum for three or more. `--compact` shows medians. Each metric can have fewer usable samples than completed trials. A usable sample comes from a completed prompt-only response with one assistant text message in the final-answer phase when Codex supplies it, without a model reroute or tool activity. The table uses `—` for unavailable metrics.

`--show-token-usage` adds reported usage. The detailed terminal view includes per-request counts and separate warm-up, measured, and invocation totals. The compact view shows one totals line. Attributable usage from failed or interrupted attempts contributes to totals, and incomplete coverage is marked partial.

### Write A JSON Report

```sh
cdx-chores codex-bench --prompt-file ./task.txt --runs 1 \
  --json --show-prompt --show-token-usage > report.json
```

`--json` takes precedence over `--compact`. Stdout contains one JSON report. Terminal stderr shows a temporary status that clears as the run finishes. Redirected stderr carries diagnostics only in JSON mode. In human mode, stderr also carries the startup workload and, in detailed mode with usage enabled, per-request token totals. Use the global `--no-color` option or set `NO_COLOR` for plain terminal output.

JSON request fields keep `null` for inherited selections. Check `trials[].configuredTier` and `trials[].resolvedReasoningEffort` for the available per-trial values, and `sentTier` for any explicit tier override sent to app-server. `servedSpeed` remains `null`. JSON timing values use milliseconds. `--show-prompt` adds `prompt.text`, and `--show-token-usage` adds detailed usage counts and invocation totals.

Both report formats preserve a relative prompt path as supplied and abbreviate paths inside the user's home as `~` on macOS and Unix-like systems or `%USERPROFILE%` on Windows. Use the global `--absolute` or `--abs` option before `codex-bench` to show literal absolute paths, resolving a relative prompt path from the invocation directory.

## Manage Benchmark Sessions

The benchmark keeps its sessions by default, including warm-ups. Use `--session-retention archive` to move them out of active history while preserving the rollout. `--session-retention delete` permanently removes the sessions after confirmed turn completion and rollout readback or its deadline. Retention applies to sessions created by the invocation. A cleanup failure preserves the report and returns exit status 1. See the [shared retention guidance](codex-execution-configuration.md#retain-codex-sessions) for compatibility.

An unavailable speed produces a diagnostic while supported combinations continue. A failed trial, a failed shutdown, or zero completed measured trials returns exit status 1. An interrupted run returns 130.

## Related Guides

- [Codex execution configuration](codex-execution-configuration.md)
- [CLI output and color](cli-output-and-color.md)
