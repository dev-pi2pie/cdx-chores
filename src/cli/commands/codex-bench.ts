import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { TextDecoder } from "node:util";
import { InvalidArgumentError, Option, type Command } from "commander";

import type { BenchmarkCase, BenchmarkWorkloadOptions } from "../../adapters/codex/benchmark/types";
import { resolveCodexSpeed, type CodexSpeed } from "../../utils/codex-execution";
import { resolveCodexSessionRetention } from "../../utils/codex-session-retention";
import { formatBenchmarkReportPath } from "../codex-bench/paths";
import { buildBenchmarkReport, type BenchmarkPrompt } from "../codex-bench/report";
import { renderBenchmarkReport } from "../codex-bench/render";
import { createBenchmarkProgress } from "../codex-bench/progress";
import { getCliColors } from "../colors";
import { CliError } from "../errors";
import { serializeCliJson } from "../json";
import { safeTerminalText } from "../terminal-text";
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
  case?: BenchmarkCase[];
  promptFile?: string;
  runs?: number;
  json?: boolean;
  compact?: boolean;
  showPrompt?: boolean;
  showTokenUsage?: boolean;
}

function parseCase(value: string, previous: BenchmarkCase[] = []): BenchmarkCase[] {
  const separator = value.lastIndexOf("=");
  const model = separator < 0 ? "" : value.slice(0, separator).trim();
  if (!model) throw new InvalidArgumentError("Use MODEL=SPEED with a nonempty model.");

  const speed = value.slice(separator + 1);
  let requestedSpeed: BenchmarkCase["requestedSpeed"] = null;
  if (speed !== "inherit") {
    try {
      requestedSpeed = resolveCodexSpeed(speed);
    } catch (error) {
      if (!(error instanceof TypeError)) throw error;
      throw new InvalidArgumentError("SPEED must be standard, fast, ultrafast, or inherit.");
    }
  }
  return [...previous, { model, requestedSpeed }];
}

function parseRuns(value: string, previous: number | undefined): number {
  if (previous !== undefined) throw new InvalidArgumentError("--runs may only be specified once.");
  const count = Number(value);
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(count) || count <= 0) {
    throw new InvalidArgumentError("--runs must be a positive integer.");
  }
  return count;
}

async function loadPrompt(cwd: string, path?: string): Promise<BenchmarkPrompt> {
  if (path === undefined) return { source: "built-in", path: null, text: SAMPLE_PROMPT };
  try {
    const bytes = await readFile(resolve(cwd, path));
    const prompt = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    if (!prompt.trim()) throw new Error("Prompt file is empty.");
    return { source: "file", path, text: prompt };
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
  let signalExitCode: number | undefined;
  const cancel = (exitCode: number) => {
    signalExitCode ??= exitCode;
    cancellation.abort();
  };
  const interrupt = () => cancel(130);
  const terminate = () => cancel(143);
  const workload: BenchmarkWorkloadOptions = {
    ...(options.case
      ? { cases: options.case }
      : { models: options.codexModel ?? [], speeds: options.codexSpeed ?? [] }),
    provider: options.codexProvider,
    reasoningEffort: options.codexReasoningEffort,
    runs: options.runs ?? 3,
  };
  const sessionRetention = resolveCodexSessionRetention(options.sessionRetention);
  const progress =
    options.json && !(runtime.stderr as NodeJS.WriteStream).isTTY
      ? undefined
      : createBenchmarkProgress(runtime, workload, {
          transient: options.json,
          showTokenUsage: options.showTokenUsage && !options.compact,
        });
  process.on("SIGINT", interrupt);
  process.on("SIGTERM", terminate);
  try {
    const result = await runCodexBenchmark({
      ...workload,
      cwd: runtime.cwd,
      signal: cancellation.signal,
      prompt: prompt.text,
      sessionRetention,
      onTrialStart: progress?.start,
      onFirstText: progress?.firstText,
      onTrial: progress?.finish,
    });
    progress?.stop();
    const report = buildBenchmarkReport(result, {
      workload,
      prompt,
      sessionRetention,
      showPrompt: options.showPrompt,
      showTokenUsage: options.showTokenUsage,
    });
    report.run.codexHome = formatBenchmarkReportPath(runtime, report.run.codexHome);
    report.prompt.path = formatBenchmarkReportPath(runtime, report.prompt.path);
    const { completedMeasuredTrials } = report.run;
    const colors = getCliColors(runtime, runtime.stderr);
    let failed = false;
    for (const trial of result.trials) {
      if (trial.error) {
        const label = `${trial.model ?? "inherited model"}/${trial.requestedSpeed ?? "inherited speed"}`;
        const status =
          trial.status === "unavailable"
            ? colors.yellow(trial.status)
            : trial.status === "failed"
              ? colors.red(trial.status)
              : trial.status;
        runtime.stderr.write(
          `${status} (${safeTerminalText(label)}): ${safeTerminalText(trial.error)}\n`,
        );
      }
      const retention = trial.sessionRetention;
      if (retention?.status === "failed" || retention?.status === "skipped") {
        const thread = trial.threadId ?? "unknown thread";
        const status =
          retention.status === "failed"
            ? colors.red(retention.status)
            : colors.yellow(retention.status);
        runtime.stderr.write(
          `Session retention ${status} (${safeTerminalText(thread)}): ${safeTerminalText(retention.error)}\n`,
        );
      }
      failed ||=
        trial.status === "failed" || trial.status === "cancelled" || retention?.status === "failed";
    }
    if (options.json) {
      runtime.stdout.write(`${serializeCliJson(report)}\n`);
    } else {
      renderBenchmarkReport(runtime, report, { compact: options.compact });
    }
    if (result.startupError) {
      runtime.stderr.write(
        `${colors.red("Startup failed")}: ${safeTerminalText(result.startupError)}\n`,
      );
    }
    if (result.transportError) {
      runtime.stderr.write(
        `${colors.red("Transport failed")}: ${safeTerminalText(result.transportError)}\n`,
      );
      failed = true;
    }
    if (result.shutdownError) {
      runtime.stderr.write(
        `${colors.red("Shutdown failed")}: ${safeTerminalText(result.shutdownError)}\n`,
      );
    }
    if (signalExitCode !== undefined) process.exitCode = signalExitCode;
    else if (failed || completedMeasuredTrials === 0 || result.shutdownError) process.exitCode = 1;
  } finally {
    try {
      progress?.stop();
    } finally {
      process.off("SIGINT", interrupt);
      process.off("SIGTERM", terminate);
    }
  }
}

export function registerCodexBenchCommand(program: Command, runtime: CliRuntime): void {
  applyCodexExecutionOptions(
    program.command("codex-bench").description("Run fresh Codex trials to compare model speeds"),
    true,
  )
    .addOption(
      new Option("--case <MODEL=SPEED>", "Model/speed pair (repeatable, speed may be inherit)")
        .argParser(parseCase)
        .conflicts(["codexModel", "codexSpeed"]),
    )
    .option(
      "--runs <count>",
      "Measured trials per combination or case occurrence (default: 3)",
      parseRuns,
    )
    .option("--prompt-file <path>", "UTF-8 prompt file (default: built-in sample)")
    .option("--compact", "Show medians and optional token totals")
    .option("--json", "Write one JSON report to stdout")
    .option("--show-prompt", "Include the submitted prompt")
    .option("--show-token-usage", "Include token usage and warm-up totals")
    .addHelpText(
      "after",
      "\nChoose either a model/speed matrix or explicit --case pairs. Omitted Codex settings are inherited.\n" +
        "Each combination or case occurrence gets one warm-up before its measured trials.\n" +
        "Cases run in input order each round. Repeated pairs share a summary row.\n\n" +
        "Examples\n" +
        "  cdx-chores codex-bench --codex-model MODEL --codex-speed standard --codex-speed fast\n" +
        "  cdx-chores codex-bench --case MODEL=fast --case OTHER_MODEL=ultrafast --runs 1\n",
    )
    .action(async (options: BenchmarkCommandOptions) => actionCodexBenchmark(runtime, options));
}
