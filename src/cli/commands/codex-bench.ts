import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { TextDecoder } from "node:util";
import { InvalidArgumentError, type Command } from "commander";

import type { CodexSpeed } from "../../utils/codex-execution";
import { CliError } from "../errors";
import {
  applyCodexExecutionOptions,
  type CodexExecutionCommandOptions,
} from "../options/codex-execution-option";
import type { CliRuntime } from "../types";

const SAMPLE_PROMPT =
  "Explain how an LRU cache works to a junior developer. Cover a cache hit, a cache miss, and an eviction. Walk through a short example with a capacity of three. Write about 250 words and answer directly without using tools.";

interface BenchmarkCommandOptions extends Omit<
  CodexExecutionCommandOptions,
  "codexModel" | "codexSpeed"
> {
  codexModel?: string[];
  codexSpeed?: CodexSpeed[];
  promptFile?: string;
  runs?: number;
}

function parseRuns(value: string, previous: number | undefined): number {
  if (previous !== undefined) throw new InvalidArgumentError("--runs may only be specified once.");
  const count = Number(value);
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(count) || count <= 0) {
    throw new InvalidArgumentError("--runs must be a positive integer.");
  }
  return count;
}

async function loadPrompt(cwd: string, path?: string): Promise<string> {
  if (path === undefined) return SAMPLE_PROMPT;
  try {
    const bytes = await readFile(resolve(cwd, path));
    const prompt = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    if (!prompt.trim()) throw new Error("Prompt file is empty.");
    return prompt;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new CliError(`Unable to load --prompt-file ${JSON.stringify(path)}. ${detail}`, {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }
}

async function actionCodexBenchmark(runtime: CliRuntime, options: BenchmarkCommandOptions) {
  const prompt = await loadPrompt(runtime.cwd, options.promptFile);
  const { runCodexBenchmark } = await import("../../adapters/codex/benchmark");
  const cancellation = new AbortController();
  const cancel = () => cancellation.abort();
  process.on("SIGINT", cancel);
  process.on("SIGTERM", cancel);
  try {
    const result = await runCodexBenchmark({
      cwd: runtime.cwd,
      signal: cancellation.signal,
      models: options.codexModel ?? [],
      speeds: options.codexSpeed ?? [],
      provider: options.codexProvider,
      reasoningEffort: options.codexReasoningEffort,
      runs: options.runs ?? 3,
      prompt,
      sessionRetention: options.sessionRetention,
    });
    let completed = 0;
    let measured = 0;
    let warmups = 0;
    let failed = false;
    for (const trial of result.trials) {
      if (trial.warmup) warmups++;
      else {
        measured++;
        if (trial.status === "completed") completed++;
      }
      if (trial.error) {
        const label = `${trial.model ?? "inherited model"}/${trial.requestedSpeed ?? "inherited speed"}`;
        runtime.stderr.write(`${trial.status} (${label}): ${trial.error}\n`);
      }
      const retention = trial.sessionRetention;
      if (retention?.status === "failed" || retention?.status === "skipped") {
        const thread = trial.threadId ?? "unknown thread";
        runtime.stderr.write(
          `Session retention ${retention.status} (${thread}): ${retention.error}\n`,
        );
      }
      failed ||= trial.status === "failed" || retention?.status === "failed";
    }
    runtime.stdout.write(
      `Codex benchmark completed ${completed}/${measured} measured trials (${warmups} warm-ups).\n`,
    );
    if (result.interrupted) process.exitCode = 130;
    else if (failed || completed === 0) process.exitCode = 1;
  } finally {
    process.off("SIGINT", cancel);
    process.off("SIGTERM", cancel);
  }
}

export function registerCodexBenchCommand(program: Command, runtime: CliRuntime): void {
  applyCodexExecutionOptions(
    program.command("codex-bench").description("Run fresh Codex trials to compare model speeds"),
    true,
  )
    .option(
      "--runs <count>",
      "Measured trials per model and speed combination (default: 3)",
      parseRuns,
    )
    .option("--prompt-file <path>", "Use a UTF-8 prompt file for every trial")
    .action(async (options: BenchmarkCommandOptions) => actionCodexBenchmark(runtime, options));
}
