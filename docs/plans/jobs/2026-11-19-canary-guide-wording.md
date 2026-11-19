---
title: "Canary benchmark help and guide wording"
created-date: 2026-11-19
status: completed
agent: codex
---

Shortened `codex-bench --help` to the scheduling rules and two selection examples. After the `--runs 1` example, the [benchmark guide](../../guides/codex-benchmark.md) explains how a first-request delay could skew a speed comparison and why both requests use fresh sessions. It also covers warm-up token usage and illustrates two explicit cases across three rounds. The [execution options table](../../guides/codex-execution-configuration.md) gives the reasoning default for helpers and benchmarks.

The [DuckDB guide](../../guides/data-duckdb-usage.md#duckdb-2-migration) puts extension setup and saved-query checks first and names the file compatibility verified with 1.5.6 and 2.0.0. Updated the extract and contributor guides to clarify extension setup and the purpose of the migration probes.

Built the CLI with `bun run build` and inspected the Node CLI's rendered help. Both focused application tests passed with `bun test --config=/dev/null ./test/codex-benchmark/help.app.test.ts`.

Added three [sample prompts](../../../examples/playground/codex-bench-prompt/) for a museum exhibit announcement, JSON extraction, and LRU cache tracing. The benchmark guide links each sample, explains the UTF-8 input requirement, and gives a command to run the museum prompt from the repository root.

Updated [Read The Results](../../guides/codex-benchmark.md#read-the-results) to explain how task complexity and answer length affect timing comparisons and why the benchmark reports input token counts but omits Input tok/s. Checked the compact median of per-trial output rates and the token usage totals against the report and terminal renderer.
