---
title: "Codex CLI Benchmark Implementation"
created-date: 2026-11-18
modified-date: 2026-11-19
status: completed
agent: codex
---

This record tracks implementation outcomes, test results, and reviewed ranges for the [benchmark implementation plan](../plan-2026-11-18-codex-cli-benchmark.md). The [research](../../researches/research-2026-11-18-codex-cli-benchmark.md) records the design and exploratory findings.

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

The CLI and runner introduced the model × speed workload with warm-ups, speed rotation in measured rounds, and one fresh persisted thread per request. The runner captured timing, usage, eligibility, and retention outcomes. The CLI reported completed trial counts and diagnostics.

The shared command-local options include `--codex-speed` and `--session-retention`. Helpers retain the `low` reasoning default, and benchmark omissions delegate all selectors to Codex. Retention defaults to `keep`. Explicit archive or delete uses the same executable and Codex home as the request and targets the owned thread ID. Deleting that thread also removes its descendants. Codex CLI 0.170.0 is the verified baseline. Benchmark cleanup follows confirmed turn completion and rollout readback or its deadline. SDK cleanup runs at thread release after confirmed completion. If the SDK returns an error without completion evidence, the lifecycle reports a skip and preserves the original outcome.

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

`codex-bench --json` emits one object with `run`, `prompt`, `trials`, and `summaries`. Inherited selections, unavailable metrics, and served speed use `null`. Requested settings and reported resolved settings remain visible. `--show-prompt` adds `prompt.text`, and `--show-token-usage` adds usage to each trial and totals to the report.

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

With `--show-token-usage`, stderr identifies each settled warm-up or measured request and shows its reported total alongside the cumulative invocation total. The human report shows input, output, and total by request, with independent warm-up and measured subtotals and an invocation total. JSON retains the detailed usage fields.

- Each column sums reported values, including attributable usage from failed and interrupted attempts. Missing counts display as `—` in the terminal and `null` in JSON. An attempted request with incomplete usage or a missing input, output, or total count marks its affected subtotal and the invocation total partial. Catalog skips contribute no usage. Speed statistics still use eligible measured samples.
- `bun test --path-ignore-patterns='**/fixtures/**' test/codex-benchmark` passed 83 cases. Fixtures verified opt-in behavior, single and multiple combinations, partial and missing counts, failed and interrupted attempts, skipped catalog entries, and subtotal reconciliation. `bun run test:unit` passed 2,107 cases and `bun run test:integration:codex` passed 26.
- TypeScript, lint, formatting, build, and `git diff --check` passed. A built Node CLI smoke check verified per-request stderr and reconciled the table and JSON totals against a loopback provider.
- Code and test review covered `9355bc92..10d4dbd3`. The review fix marks usage partial even when input and output are available but the reported total is missing. The fixtures verify the partial label in stderr, terminal subtotals, and JSON, and confirm that an eligible saved output count can still provide a speed sample.

### Phase 6 Follow-Up

The initial follow-up added `--compact` with median metrics, completed counts, and one-line usage. It made JSON quiet on stderr except for diagnostics and updated help for those behaviors. The following evidence covers that implementation.

- The benchmark abbreviates the home prefix in report paths as `~` on Unix-like systems and `%USERPROFILE%` on Windows. Relative prompt paths display as supplied by default. The `--absolute` and `--abs` aliases show literal paths and resolve relative prompts from the invocation directory. Fixtures covered similar-prefix siblings and custom Codex homes outside the user home. Windows path handling was exercised with Windows-format unit fixtures.
- `bun test --path-ignore-patterns='**/fixtures/**' test/codex-benchmark test/data-conversion/commands/output-paths.app.test.ts` passed 103 cases. `bun run test:unit` passed 2,122 cases and `bun run test:integration:codex` passed 26. TypeScript, lint, formatting, build, and `git diff --check` passed.
- The built Node CLI smoke test checked help and ran the compact and JSON examples against a loopback provider. It verified one-line usage totals, quiet JSON, home abbreviation, and the absolute path override. Code and test review covered `e4d542d5..9f235d56` with no outstanding findings. [Follow-up checklist](../plan-2026-11-18-codex-cli-benchmark.md#phase-6-follow-up)

#### JSON progress and diagnostics

Completed the reopened work. JSON mode displays a resize-aware status on TTY stderr and clears it before the report or final diagnostics. Redirected stderr carries diagnostics. On a color-enabled TTY, `unavailable` and retention `skipped` labels are yellow, and failure labels are red. Help covers temporary progress, `prompt.text`, relative paths, and the absolute-path aliases.

- `bun test --path-ignore-patterns='**/fixtures/**' test/codex-benchmark` passed 109 cases. Fixtures checked resize cleanup, output order, interruption, mixed speeds, retention and shutdown diagnostics, TTY and redirected output, and `--no-color` and `NO_COLOR`. The presentation suite passed all 12 cases on the final assertions.
- `bun run test:unit` passed 2,123 cases and `bun run test:integration:codex` passed 26. TypeScript, lint, formatting, build, and `git diff --check` passed. The built Node CLI help example used shell redirection against a loopback provider and verified a single JSON report with prompt text, usage, and the supplied relative path. A second run verified `--abs`.
- Code and test review covered `262083ec..c2aabec3` with no outstanding findings.

#### Explicit model–speed pairs

- `bun test --path-ignore-patterns='**/fixtures/**' test/codex-benchmark` passed 112 cases. Fixtures verified ordered pairs, model IDs containing `=`, inherited speed, invalid and conflicting selectors, mixed availability, progress counts, duplicate summary counts, compact and JSON output, and matrix compatibility. [Follow-up checklist](../plan-2026-11-18-codex-cli-benchmark.md#phase-6-follow-up)
- `bun run test:unit` passed 2,123 cases and `bun run test:integration:codex` passed 27. `tsc --noEmit`, `bun run lint`, `bun run format:check`, `bun run build`, and `git diff --check` passed. Loopback requests confirmed the configured Fast tier was inherited and explicit Standard overrode it.
- The built Node CLI ran the paired help example in compact and JSON modes against a loopback provider. Each invocation sent four requests for two ordered pairs, with two warm-ups and two measured trials. JSON recorded the supplied pairs in `run.requested.cases`.
- Code and test review covered `c46fbe13..52c7755c` with no actionable findings.

### Phase 6.1. Inherited Speed and Reasoning Effort

- `bun test --path-ignore-patterns='**/fixtures/**' test/codex-benchmark` passed 118 cases. Fixtures covered known, missing, partial, and mixed inherited settings in both terminal views, excluded warm-up and failed-trial metadata from the summary, and verified matrix omission, paired inheritance, explicit overrides, and per-trial JSON values. [Inherited-settings checklist](../plan-2026-11-18-codex-cli-benchmark.md#phase-61-inherited-speed-and-reasoning-effort)
- `bun run test:unit` passed 2,123 cases and `bun run test:integration:codex` passed 27. TypeScript, lint, formatting, build, and `git diff --check` passed.
- The bundled Codex 0.170.0 reported `priority` for configured Fast and `default` for configured Standard, and reported `low` with Low set in the isolated Codex home. The built Node CLI showed Fast and Low in detailed and compact reports against the loopback provider. The JSON run preserved inherited request values as `null` and reported the configured tier and reasoning effort per trial, with `servedSpeed: null`.
- Code and test review covered `14adfc97..eef48ebe`. The added failed-trial fixture resolved the review finding. No actionable findings remained.

## Phase 7. Documentation and Validation

- Added the [benchmark guide](../../guides/codex-benchmark.md), updated the [shared Codex execution guide](../../guides/codex-execution-configuration.md), and linked the benchmark from the README. Built Node CLI checks covered benchmark and helper help, `doctor --details` and `doctor --json`, and all nine `codex-info` views in an isolated Codex 0.170.0 configuration. The loopback provider verified the default, matrix, paired, and prompt-file examples, case order across rounds, invocation-wide effort, JSON redirection, token totals, and both absolute-path aliases.
- With the built CLI's stderr on a real macOS pseudo-terminal, resized from 110 to 24 and back to 110 columns during a single measured turn's pause between fixture text chunks. In detailed, compact, and JSON modes, the probe confirmed wrapped-row cleanup, restored status detail, and a final clear. Each report matched its saved measured turn's first token of 200 ms, duration of 800 ms, and rate of 100 output tok/s. The [progress test](../../../test/codex-benchmark/progress.unit.test.ts) also checks detail restoration in human and transient modes.
- `bun test --path-ignore-patterns='**/fixtures/**' test/codex-benchmark test/codex-info test/doctor` passed 414 cases. `bun run test:unit` passed 2,123 and `bun run test:integration:codex` passed 27. `tsc --noEmit`, `bun run lint`, `bun run format:check`, `bun run build`, local Markdown link checks, and `git diff --check` passed.
- Guide and test review covered `214823fe..3a558372`. The guide review clarified that helper selectors are single-use while the benchmark supports repeated model and speed flags. The re-review found no material issues. [Completed checklist](../plan-2026-11-18-codex-cli-benchmark.md#phase-7-documentation-and-validation)

## Follow-up on benchmark failure reporting

- `9a899c7c` records an expired turn deadline as a failed trial. The CLI exits 1 and preserves partial usage. A confirmed interruption allows retention and the next trial. An unconfirmed interruption skips retention and stops scheduling.
- `b8b96ac6` returns an interrupted report and exit 130 when Ctrl-C arrives during initialization. If the transport fails during a trial, the runner preserves completed results, sets `run.transportError`, and exits 1. `7c393e1f` records `sentTier` when issuing `turn/start`. The tests check rejected thread starts and rejected turn requests against the protocol trace. [CLI regression tests](../../../test/codex-benchmark/benchmark-runner.app.test.ts)
- The first code and test review covered `08fdaa01..7c393e1f`. It found that loss during the final trial’s readback could still exit 0. `600e56f1` fixed that case. `3685c9b7` limited the shortened fixture deadline to the stalled turn and added coverage for an unconfirmed interrupt. The full re-review of `08fdaa01..3685c9b7` found no outstanding issues.
- The built Node CLI passed seven isolated app-server scenarios covering confirmed and unconfirmed turn interruption, transport loss in intermediate and final readback, SIGINT during initialization, and rejection of each start request. The checks verified exit codes, JSON results, and diagnostics. [Benchmark guide](../../guides/codex-benchmark.md#manage-benchmark-sessions)
- On the reviewed tip, `bun test --path-ignore-patterns='**/fixtures/**' ./test/codex-benchmark` passed 125 cases, `bun run test:unit` passed 2,123, and `bun run test:integration:codex` passed 27. TypeScript (`tsc --noEmit`), lint, formatting, build, the new documentation links, and `git diff --check` passed.
- The first full application run had one failure in the unchanged process-runner termination-budget test. It passed three consecutive isolated reruns. The serial `bun run test:integration:app` rerun at `3685c9b7` passed all 2,460 cases.
- The `dev` review against `canary` found that stdout EOF could stall an active trial and that Ctrl-C could leave tier discovery running. `58b231b2` detects stdout EOF as transport loss. `bc5ed4be` cancels pending `model/list` and `config/read` requests, stops pagination, and returns exit 130 without starting inference.
- Review of `b06c1275..bc5ed4be` found that the EOF grace period could hide transport loss during final readback. `09b647df` stops the transport immediately at EOF and reports the child exit status when available. Test review found a fixture ordering race, which `86664bd5` fixed by waiting for the parent to observe EOF. Code and test re-review of `b06c1275..86664bd5` found no outstanding issues. [Regression tests](../../../test/codex-benchmark/benchmark-runner.app.test.ts)
- Managed suites on the final production code at `09b647df` passed 2,123 unit, 2,464 application, and 27 Codex integration tests. The final reviewed tip passed 425 focused tests. The synchronized EOF fixture passed 12 repeated runs and reproduced exit 0 on `bc5ed4be`. Five isolated Node CLI checks covered both EOF cases, exit code 17, and SIGINT during both tier lookups. Type checking, lint, formatting, build, and `git diff --check` passed.

### Thread startup and server-interrupted trials

- At `dbdd45a7`, the built Node CLI waited 15 seconds after Ctrl-C when app-server withheld the `thread/start` reply. With `b4023cc9`, one Ctrl-C cancels the pending request, returns exit 130, and preserves the JSON report. The protocol trace confirms that inference never started.
- At the same baseline, an app-server interruption after one completed measurement returned exit 0, and redirected stderr was empty when the server supplied no reason. With `413c0c1c`, both the supplied-reason and missing-reason cases exit 1 and print a diagnostic. JSON retains the completed measurement, the cancelled trial, and its partial usage. [Benchmark guide](../../guides/codex-benchmark.md#manage-benchmark-sessions)
- Code and test review covered `dbdd45a7..413c0c1c`. The review raised the case where app-server creates a thread before the CLI receives its ID. `5dec2637` documents that limitation and tests that requesting archive sends no cleanup request for an unidentified thread. Re-review of the full `dbdd45a7..5dec2637` range found no outstanding issues. [CLI regression tests](../../../test/codex-benchmark/benchmark-runner.app.test.ts)
- Three built Node CLI checks verified startup cancellation and both server-interruption diagnostics. The benchmark suite passed 132 tests. Type checking, lint, formatting, build, relative link checks, and `git diff --check` passed.
- The first managed run had one failure in the unchanged wrapped path-completion test. It passed three isolated reruns. A full `bun run test:all` rerun at `5dec2637` passed all 4,622 cases (2,123 unit, 2,467 application, 27 Codex, and 5 Pandoc).

### Pending turn IDs, initialization failures, and tier rejections

- `5bb9d2a6` covers the interval after `turn/start` is sent. Previously Ctrl-C waited for the 15-second RPC deadline if no ID arrived. The built Node CLI exited 130 after 1.01 seconds in that fixture, retained the known thread ID, and skipped archive. When the turn ID arrived during the one-second grace period, the CLI interrupted that turn and archived the thread after confirmation.
- The same commit handles app-server startup failure before the first trial. A rejected `initialize` previously left stdout empty. The built CLI now exits 1, writes the reason to stderr, and emits a zero-trial JSON report with `run.startupError`. [Benchmark guide](../../guides/codex-benchmark.md#manage-benchmark-sessions)
- `d20359c2` recognizes “does not support the priority service tier” as a speed rejection. With Standard succeeding, both tested rejection phrasings marked Fast unavailable and returned exit 0. A rejection of image input that also mentioned the tier remained a failed trial with exit 1.
- Code and test review covered `cef9f737..d20359c2`. Test review found that the subprocess timeout allowed excessive cancellation latency to pass. `3367360a` requires exit within three seconds of SIGINT, allowing for scheduling and shutdown. The missing-ID and late-ID fixtures each passed three consecutive runs. Re-review of the full `cef9f737..3367360a` range found no outstanding issues. [CLI regression tests](../../../test/codex-benchmark/benchmark-runner.app.test.ts)
- Six built Node CLI checks passed. On the final production code, `bun run test:all` passed 4,627 cases (2,123 unit, 2,472 application, 27 Codex, and 5 Pandoc). The final reviewed tip passed all 137 benchmark tests, type checking, lint, formatting, and diff checks. The build and relative documentation link checks passed.

### Provider errors and missing turn-start replies

- At `5235c60d`, “Image input is not supported by this model at the priority service tier” made a mixed Fast/Standard run exit 0. `93cf7887` requires the rejection to describe the tier. The same fixture now reports Fast as failed, preserves the provider message and the completed Standard measurement, and exits 1.
- At the same baseline, the built Node CLI received matching start and completion notifications for its warm-up, waited 15 seconds for the missing `turn/start` reply, then reported failure and skipped archive. With `c09b0d34`, matching notifications on the owned thread let the runner use the recorded outcome. The built CLI completed and archived the warm-up and measured turn in under a second. Wrong-thread and wrong-turn completion fixtures verified that neither authorized archive.
- Code and test review of `5235c60d..c09b0d34` found that narrowing the classifier also dropped explicit tier-eligibility errors. `a108f242` restored those replies and explicit invalid tier values. Eight mixed-speed CLI cases checked statuses, exit codes, partial usage, and the provider reason in JSON and stderr. Re-review of `5235c60d..a108f242` found no outstanding issues. [CLI regression tests](../../../test/codex-benchmark/benchmark-runner.app.test.ts)
- On the reviewed tip, nine built Node CLI checks and all 145 benchmark tests passed. `bun run test:all` passed 4,635 cases (2,123 unit, 2,480 application, 27 Codex, and 5 Pandoc). Type checking, lint, formatting, build, and `git diff --check` passed.

### Transient tier discovery failures

- At `f7e4999d`, a single rejected `model/list` or `config/read` caused both the Fast warm-up and the measured Fast trial to fail before inference. `874698e5` caches each lookup after it succeeds. The measured Fast trial can recover while the report retains the original warm-up failure and exit 1.
- Four built Node CLI checks used one measured round of Fast and Standard with an inherited model. After a rejected `model/list`, the trace showed two catalog requests and one configuration request. After a rejected `config/read`, it showed one catalog request and two configuration requests. Both measurements completed in each case. The two successful controls, with a configured model and with `null` selecting the catalog default, each made one request of each kind and exited 0.
- The existing SIGINT cases passed during each lookup. Code and test review of `f7e4999d..874698e5` found no outstanding issues. [CLI regression tests](../../../test/codex-benchmark/benchmark-runner.app.test.ts)
- At `874698e5`, all 149 benchmark tests passed. `bun run test:all` passed all 4,639 cases (2,123 unit, 2,484 application, 27 Codex, and 5 Pandoc). Type checking, lint, formatting, build, and `git diff --check` passed.
