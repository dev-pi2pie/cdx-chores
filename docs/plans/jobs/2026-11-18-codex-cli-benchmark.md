---
title: "Codex CLI Benchmark Implementation"
created-date: 2026-11-18
status: in-progress
agent: codex
---

This record tracks all seven phases of the [benchmark implementation plan](../plan-2026-11-18-codex-cli-benchmark.md). The [research](../../researches/research-2026-11-18-codex-cli-benchmark.md) records the design and live-check evidence.

## Phase 1. Offline Rollout Recovery

Completed offline rollout recovery verification. The spike, benchmark, and fixtures use the [same rollout reader](../../../src/adapters/codex/benchmark/rollout.ts). The [application fixtures](../../../test/codex-benchmark/rollout-recovery.app.test.ts) use real JSONL in an isolated Codex home and wait for the fake app-server process group to stop before removing it.

- The reader starts its 2 s recovery window when the matching turn completes and retries every 50 ms. The deadline fixtures use a 300 ms budget. The delayed-write fixture finishes the record only after the first read. The fallback fixture asserts two lookups for the original thread ID and a read of the returned path.
- Deadline and interruption fixtures preserve only attributable cumulative usage, flag incomplete usage, and leave unavailable saved metrics empty. Retention fixtures cover omitted and explicit keep, archive and delete after readback, archive after expiry, cleanup failures, and skipped cleanup without confirmed completion. An unrelated synthetic rollout stays untouched.
- `bun test --path-ignore-patterns='**/fixtures/**' --rerun-each=3 ./test/codex-benchmark/rollout-recovery.app.test.ts` passed all 14 cases in each run. TypeScript, lint, format check, `git diff --check`, and the Node `--help` smoke check passed.
- `bun run test:integration:app` passed 2,388 cases at checkpoint `9f92d1b3` after rerunning with process observation available. The focused fixtures were rerun after the review fixes.
- Code and test review covered `9d79cc5e..d6f70562`. The re-review confirmed that the fixtures use the production file reader and confirm process shutdown before scratch cleanup. No material findings remained.

## Phase 2. Offline Speed Request Wiring

The [loopback provider](../../../test/codex-benchmark/fixtures/speed-provider.ts) captured real Responses requests from both TypeScript SDK 0.170.0 and Codex app-server 0.170.0. Each case used an isolated Codex home, a synthetic catalog that advertised Fast and Ultrafast, and enabled speed features. The fixture recorded the outbound field independently of the [live provider acceptance checks](../../researches/research-2026-11-18-codex-cli-benchmark.md#first-live-check).

| Baseline | SDK `config.service_tier` | App-server `serviceTierForTurn` | Outbound `service_tier` on both paths |
| --- | --- | --- | --- |
| Fast | Omitted | Omitted | `priority` |
| Fast | `default` | `default` | Omitted |
| Standard | Omitted | Omitted | Omitted |
| Standard | `fast` | `priority` | `priority` |
| Standard | `ultrafast` | `ultrafast` | `ultrafast` |

- The Standard omission control confirms that ignoring explicit Fast would fail the assertion. The synthetic catalog supplies both tiers so the fixture does not depend on the bundled fallback catalog or account access.
- `bun run test:integration:codex` passed 12 cases, including the ten mapping probes, under Bun 1.4.4 and Node 26.13.1. TypeScript, lint, formatting, and `git diff --check` passed.
- Code and test review covered `9c2369d7..d5a65cd0`. The re-review confirmed the SDK probe uses Node, matching the supported runtime. No material findings remained.

## Phase 3. CLI and Trial Runner

`codex-bench` builds a model × speed workload, warms up each combination, and rotates speed order in measured rounds. Each request has a fresh persisted thread and uses the validated prompt. The runner records saved timing, usage, eligibility, and a separate retention outcome. The CLI reports completed trial counts and diagnostics. Aggregation and the JSON report are Phase 4 work.

The shared command-local options include `--codex-speed` and `--session-retention`. Helpers retain the `low` reasoning default, and benchmark omissions delegate all selectors to Codex. Retention defaults to `keep`. Explicit archive or delete uses the same executable and Codex home as the request and affects only the owned thread. Codex CLI 0.170.0 is the verified baseline. Benchmark cleanup follows confirmed turn completion and rollout readback or its deadline. SDK cleanup runs at thread release after confirmed completion. If the SDK returns an error without completion evidence, the lifecycle reports a skip and preserves the original outcome.

| Helper entry points | Thread release verified |
| --- | --- |
| File and batch rename, including image and document analyzers and Interactive cleanup suggestions | Each request owns a thread and releases it after that attempt settles. |
| Markdown PDF profile, template, and project, including Interactive authoring | Each request, repair, or regeneration owns a thread. The template repair fixture verified two Fast requests and two archived threads. |
| Data query and stack, plus Interactive DuckDB header and source-shape suggestions | Each request owns one thread. The one-shot query test deleted its thread and preserved a separate active session. Interactive SQL regeneration verified two Fast requests and two archived threads. |
| Shared SDK scope | Two real SDK turns reused one thread. The fixture verified the same ID on both turns and one archive at final release. |

- The loopback provider observed all five benchmark CLI speed selections. A two-model Standard/Fast invocation reused the same UTF-8 prompt and saved 4 warm-ups and 12 measured trials in 16 distinct archived rollouts.
- A separate SDK loopback check verified archive with a relative `CODEX_HOME` and a distinct helper working directory.
- The synthetic app-server fixtures covered delayed and missing rollout records, path fallback, unsupported speed isolation, commentary-only completion with usage, interruption with and without completion confirmation, and retention errors that preserve the trial outcome.
- `bun run test:unit` passed 2,090 cases. `bun run test:integration:app` passed 2,410 cases. `bun run test:integration:codex` passed 26 cases with Codex 0.170.0 and Node 26.13.1.
- TypeScript, lint, formatting, build, and `git diff --check` passed. The built Node CLI sent Standard under a Fast baseline and archived its warm-up and measured rollouts in an isolated home.
- A focused `bun test` run passed 57 cases across the [trial runner](../../../test/codex-benchmark/benchmark-runner.app.test.ts), [rollout recovery](../../../test/codex-benchmark/rollout-recovery.app.test.ts), and [rename flag order](../../../test/rename/commands/codex-timeout.app.test.ts) fixtures.
- Code and test review covered `e1eda20f..e77b37e2`. Re-review verified process-group shutdown before runner return and confirmed that an unresolved shutdown preserves completed trials, reports a diagnostic, and exits nonzero. Documentation review confirmed the lifecycle evidence, checklist, and Phase 4 boundary.

## Phase 4. Benchmark Results

`codex-bench --json` emits one object with `run`, `prompt`, `trials`, and `summaries`. Inherited selections, unavailable metrics, and served speed use `null`. Requested settings and reported resolved settings remain visible. `--show-prompt` adds `prompt.text`, and `--show-token-usage` adds usage to each trial and totals to the report. Phase 5 consumes the same report for terminal presentation.

- Each requested model and speed combination gets completed and planned measured counts. The summary shape is `sampleCount`, `min`, `median`, and `max` per metric, with the two middle values averaged for even sample counts. Eligible measured trials contribute each available metric independently. Turn output tok/s uses saved output tokens, including reasoning, and a positive full turn duration.
- Token totals include warm-ups and attributable partial usage. The reader retains input-only snapshots. Missing input or output counts and unconfirmed usage boundaries mark attempted requests partial. Catalog skips contribute an unavailable result row and leave usage completeness unchanged. Unreported counts use `null`.
- CLI fixtures verified zero through three usable samples, prompt round-tripping, incomplete and missing usage, and mixed speed support. Both archive and delete rejection returned exit `1` with a parseable report, a completed trial and its metrics, and a separate cleanup error carrying the thread ID.
- `bun test --path-ignore-patterns='**/fixtures/**' ./test/codex-benchmark ./test/codex-info` passed 197 cases. `bun run test:unit` passed 2,097 cases and `bun run test:integration:codex` passed 26. TypeScript, lint, formatting, build, and `git diff --check` passed. A built Node CLI loopback smoke check verified JSON, warm-up-inclusive usage, and archive results.
- Code and test review covered `f65bdf37..fd35d1bd`. Documentation review confirmed the checklist, evidence, and Phase 5 boundary.

## Phase 5. CLI Usage and Diagnostics

`codex-bench --help` describes selector placement, inheritance, the built-in prompt, shared run counts, retention, and color controls. The terminal table uses the same report as JSON, with one row per model and requested speed. It changes the metric display with the usable sample count and prints that count when it differs from completed trials. Opt-in prompt text escapes terminal controls, and opt-in token totals mark incomplete usage as partial.

- Progress uses stderr. A TTY redraws one active line and changes from Waiting for text to Streaming on the first nonempty text event for the active turn. The fixtures cover a resize during a pause, wide-character wrapping, and cleanup on completion, failure, and SIGINT. Redirected stderr prints the startup workload once, plus diagnostics and opt-in running totals. JSON stays parseable during progress.
- `doctor` adds `codexBenchmark` in JSON and a local prerequisite line in both human views. Its fixtures cover Codex 0.170.0 and newer, older and unknown versions, a missing executable, and failed initialization. The protocol trace contains only initialization traffic. Existing workflow checks still run.
- `codex-info models` shows catalog service tiers in the summary, details, and JSON. Details and JSON include the catalog default ID. A missing tier list stays unknown, and an explicit empty list reports that no tiers were advertised. Provider acceptance comes from live trials. Served speed remains unknown.
- `bun test --path-ignore-patterns='**/fixtures/**' test/codex-benchmark test/codex-info test/doctor` passed 377 cases on the final code. A 28-case follow-up run also covered the shared video progress renderer and display-width helpers. `bun run test:unit` passed 2,107 cases. The managed app and Codex runs started before the review fixes and passed 2,433 and 26 cases, respectively.
- TypeScript, lint, formatting, build, and `git diff --check` passed. The built Node CLI smoke check exercised benchmark help, terminal and JSON output, archive retention, `doctor`, and catalog tiers with an isolated loopback provider.
- Code and test review covered `258af074..8644dd54`. The re-review covered the fixes for wide-character reflow and help, with added failed-trial and SIGINT cleanup assertions. No material findings remained.

## Phase 6. Benchmark Usage Presentation

Planned. A live run showed how cumulative token lines make it hard to tell what each request used. The opt-in usage output will distinguish warm-up requests from measured attempts in progress and show separate subtotals in the final table. Record fixture results and the reviewed range here as the [Phase 6 checklist](../plan-2026-11-18-codex-cli-benchmark.md#phase-6-benchmark-usage-presentation) is completed.

## Phase 7. Documentation and Validation

Planned. Write the guide once the usage presentation is ready so the examples match the built CLI. Record guide review and final verification here as the [Phase 7 checklist](../plan-2026-11-18-codex-cli-benchmark.md#phase-7-documentation-and-validation) is completed.
