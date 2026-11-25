---
title: "Codex Benchmark"
created-date: 2026-11-18
modified-date: 2026-11-22
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

`--runs 1` schedules one warm-up and one measured trial for each model and speed combination. The first request can take longer, so only the second counts toward the timing results. Each request starts a fresh Codex session with no conversation history.

`doctor` checks that the app-server starts, reports a Codex version of at least 0.170.0, and shuts down. If shutdown fails, the check reports `failed` and keeps any version it read. `codex-info models --details` lists the tiers and defaults Codex advertises.

### Compare A Model And Speed Matrix

`--codex-model` and `--codex-speed` are repeatable. The benchmark tests every selected speed for each model, in the order you list the models. Replace `model-a` and `model-b` with model IDs available in your Codex configuration.

```sh
cdx-chores codex-bench --codex-model model-a --codex-model model-b \
  --codex-speed standard --codex-speed fast --runs 1
```

The warm-up and first measured round use the speeds in the order you list them. Each later round starts with the next speed in that list, wrapping around as needed. Omit model, speed, provider, or reasoning effort to use Codex settings. Use `standard` to request Standard explicitly.

### Compare Specific Pairs

`--case MODEL=SPEED` is repeatable. Use one flag per pair you want to test. This example schedules six requests, including two measured trials per pair.

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

Choose either `--case` or the matrix flags for each command. `SPEED` accepts `standard`, `fast`, `ultrafast`, or `inherit`. The value splits at the last `=`, so `--case "model=a=inherit"` selects the model ID `model=a` and inherits its speed. Repeating an identical case adds trials to the same summary row.

Pass `--codex-reasoning-effort` at most once. It applies to every trial regardless of where you put it. Omit it to let Codex choose the effort for each trial. In `--case MODEL=inherit`, `inherit` applies only to speed. To compare Low and High effort, run the same workload once per effort.

### Set The Workload

Pass `--runs` once with a positive integer. It defaults to three measured trials per matrix combination or per `--case` flag, plus one warm-up for each. Only measured trials count toward completion and timing statistics. Warm-ups use tokens. `--show-token-usage` includes them in the total and shows a warm-up subtotal in detailed terminal output.

The built-in prompt asks Codex to explain an LRU cache. Use `--prompt-file` to supply your own UTF-8 text. Markdown (`.md`), plain text (`.txt`), and files without an extension all work. The file must contain at least one non-whitespace character. Codex receives Markdown as written. Add `--show-prompt` to include the prompt in the report.

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

The benchmark marks a trial completed when Codex confirms completion for its thread and turn. The report shows the requested speed. Codex does not report which speed served the request.

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

`--show-prompt` adds `prompt.text`. `--show-token-usage` adds detailed token counts and totals for the run.

`--json` overrides `--compact`. Once the benchmark starts, it writes one report to stdout, even if the app-server fails to initialize. On POSIX, default `SIGHUP` handling can end the run before it writes the report, leaving stdout empty.

If the prompt file is unreadable or invalid, the CLI exits with status 2 before the benchmark starts. It writes an error to stderr and leaves stdout empty.

Terminal stderr shows a temporary status that clears as the run finishes. Redirected stderr carries diagnostics only in JSON mode. In human mode, stderr also carries the startup workload and, in detailed mode with usage enabled, per-request token totals. Use the global `--no-color` option or set `NO_COLOR` for plain terminal output.

JSON request fields use `null` for inherited selections.

| Field in `trials[]` | What it shows |
| --- | --- |
| `configuredTier`, `resolvedReasoningEffort` | The configured tier and resolved reasoning effort, when available. |
| `inferenceAttempted` | `true` once app-server stdin accepts `turn/start`, including when it buffers the write. |
| `sentTier` | The explicit tier in the accepted write, or `null` if none was sent. |
| `servedSpeed` | Always `null`. Codex does not report which speed served the request. |

If the write fails before acceptance, such as with an immediate closed-pipe error, `inferenceAttempted` stays `false`, `sentTier` stays `null`, and earlier complete usage stays complete. A later RPC or connection failure preserves the recorded attempt and tier. Missing usage for an attempted trial makes the total partial.

JSON timing values use milliseconds. If conflicting start evidence invalidates a turn ID, the benchmark clears the ID, first-token and duration fields, excludes that trial from timing summaries, and reports null throughput. It keeps attributable token counts as partial.

Both report formats preserve a relative prompt path as supplied and abbreviate paths inside the user's home as `~` on macOS and Unix-like systems or `%USERPROFILE%` on Windows. Use the global `--absolute` or `--abs` option before `codex-bench` to show literal absolute paths, resolving a relative prompt path from the invocation directory.

## Manage Benchmark Sessions

The benchmark keeps its sessions by default, including warm-ups. Use `--session-retention archive` to move them out of active history while preserving the rollout. `--session-retention delete` permanently removes them. Both options require a nonempty thread ID that is fresh for the invocation and a live `turn/completed` event matching that thread and its known turn. The benchmark applies retention after rollout readback or its deadline and after resolving any pending `turn/start` reply. A matching live terminal event can authorize retention even when the saved `task_complete` needed for timing is missing. A cleanup failure preserves the report and ordinarily returns exit status 1. If Ctrl-C also interrupted the invocation, the CLI reports the cleanup error and exits with status 130. See the [shared retention guidance](codex-execution-configuration.md#retain-codex-sessions) for compatibility.

## Failures and exit codes

| What happened | Exit status and report |
| --- | --- |
| Ctrl-C (`SIGINT`) or `SIGTERM` | Partial report and exit `130` or `143`, respectively. The first signal determines the outcome. |
| Default POSIX `SIGHUP` | Attempts bounded shutdown of the detached app-server group, then terminates by `SIGHUP`. Stdout may be empty. |
| App-server startup or initialization failed | Exit `1`. Stderr gives the reason. JSON sets `run.startupError` and returns an empty `trials` array. |
| App-server connection lost or shutdown failed | Exit `1`. JSON keeps recorded trials and sets `run.transportError` or `run.shutdownError`, respectively. |
| A trial or session retention failed, Codex interrupted a turn, or no measured trial completed | Exit `1`. A failed warm-up counts even when measurements succeed. A turn Codex interrupts on its own is reported as `cancelled`. |

The exit-`1` rows apply without local cancellation. On POSIX, `SIGHUP` starts shutdown even during initialization. If an installed hangup handler sets an exit code and allows cleanup to finish, the benchmark preserves that code.

### When another trial can start

| What happened | What the benchmark does |
| --- | --- |
| Requested speed is unavailable | Reports it and continues with supported combinations. |
| Local write refusal, or structured input-too-large rejection with no turn evidence | Skips archive and delete. Can start the next trial on a healthy, uncancelled run. |
| A known turn times out | Sends an interrupt and keeps the failed trial and any attributable usage. A matching terminal event permits requested retention and another trial on a healthy, uncancelled run. |
| An accepted start remains unsettled, or start IDs conflict | Stops scheduling and skips archive and delete. If a conflicting start notification arrives during a retention request, the report records that request’s outcome. |

An input-too-large rejection marks the trial failed. To continue, it must have RPC code `-32602` and `data.input_error_code: "input_too_large"`. On that thread, any start or terminal event, or an item event with a turn ID, blocks the exception.

A matching terminal notification can start rollout readback while the `turn/start` reply is pending. Before applying retention or scheduling another trial, the benchmark waits for the reply to match the announced turn or for the 15-second start deadline to expire. A matching terminal notification already received at that deadline can stand in for the missing reply. A conflicting or rejected reply fails the trial and stops scheduling. The completion deadline is 120 seconds. An interrupt acknowledgement alone leaves completion unconfirmed.

If Ctrl-C cancels a pending `thread/start`, Codex may already have created a session. The trial reports `threadId: null` and `sessionRetention: null`. If Ctrl-C arrives after `turn/start` is sent, the benchmark allows one second for the turn ID so it can interrupt the turn. Cancellation skips archive and delete if completion remains unconfirmed or the start reply is still pending after readback.

## Standard/Fast live check

The [maintainer live check](../../scripts/spikes/codex-benchmark-live-check.ts) uses the same local-acceptance rule for `sentTier` and the same thread identity, scheduling and retention rules. It stops an unsettled trial at its start or completion deadline without issuing a turn interrupt. On `SIGINT` or `SIGTERM` it starts app-server shutdown and preserves the first signal's exit status. It follows the same POSIX hangup policy as the benchmark. If HUP arrives during an active trial, the live check stops scheduling. If shutdown causes the trial to fail, the caller still exits with the code its installed HUP handler set.

Both callers require child close for successful shutdown. For a separately owned POSIX process group, they also require a signal-zero probe to return `ESRCH`. A signal permission error leaves these checks running within the shutdown deadline. If verification fails, the shutdown error preserves the signal denial. The live check reports shutdown failure on stderr and exits with status 1 in the absence of local cancellation, with any completed Standard/Fast results still in JSON.

## Related Guides

- [Codex execution configuration](codex-execution-configuration.md)
- [CLI output and color](cli-output-and-color.md)

## Related Research

- [Evidence for Codex benchmark lifecycle decisions](../researches/research-2026-11-20-codex-benchmark-lifecycle-evidence.md)
