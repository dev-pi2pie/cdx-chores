import type { SavedTokenUsage } from "../../adapters/codex/benchmark/rollout";
import type { CodexSpeed } from "../../utils/codex-execution";
import { getCliColors } from "../colors";
import { safeTerminalText } from "../terminal-text";
import { getDisplayWidth, padToDisplayWidth } from "../text-display-width";
import type { CliRuntime } from "../types";
import type { buildBenchmarkReport } from "./report";

type Report = ReturnType<typeof buildBenchmarkReport>;
type Metric = Report["summaries"][number]["codexFirstTokenMs"];

const speedLabels = { standard: "Standard", fast: "Fast", ultrafast: "Ultrafast" } as const;
const unavailable = "—";
const tokenCountFormat = new Intl.NumberFormat("en-US");

export function benchmarkSpeedLabel(speed: CodexSpeed | null): string {
  return speed === null ? "Inherited" : speedLabels[speed];
}

export function benchmarkTrialLabel(
  trial: { warmup: boolean; round: number },
  runs: number,
): string {
  return trial.warmup ? "Warm-up" : `Trial ${trial.round}/${runs}`;
}

export function formatBenchmarkTokenCount(count: number | null | undefined): string {
  return count == null ? unavailable : tokenCountFormat.format(count);
}

function metricCell(metric: Metric, completed: number, divisor: number, decimals: number): string {
  if (metric.min === null || metric.max === null || metric.median === null) {
    return completed === 0 ? unavailable : `${unavailable} (0 samples)`;
  }
  const format = (value: number) => (value / divisor).toFixed(decimals);
  const min = format(metric.min);
  const max = format(metric.max);
  const value =
    metric.sampleCount === 1
      ? min
      : metric.sampleCount === 2
        ? `${min}–${max}`
        : `${min} / ${format(metric.median)} / ${max}`;
  const sampleLabel = metric.sampleCount === 1 ? "sample" : "samples";
  return metric.sampleCount === completed
    ? value
    : `${value} (${metric.sampleCount} ${sampleLabel})`;
}

export function formatBenchmarkUsage(
  label: string,
  counts: SavedTokenUsage | null,
  partial: boolean,
): string {
  const fields = [
    `input ${counts?.inputTokens ?? unavailable}`,
    `output ${counts?.outputTokens ?? unavailable}`,
    `cached input ${counts?.cachedInputTokens ?? unavailable}`,
    `cache writes ${counts?.cacheWriteInputTokens ?? unavailable}`,
    `reasoning output ${counts?.reasoningOutputTokens ?? unavailable}`,
    `total ${counts?.totalTokens ?? unavailable}`,
  ];
  return `${label}${partial ? " (partial)" : ""} · ${fields.join(" · ")}`;
}

export function renderBenchmarkReport(runtime: CliRuntime, report: Report): void {
  const { stdout } = runtime;
  const colors = getCliColors(runtime, stdout);
  const { completedMeasuredTrials, measuredTrials, warmupTrials } = report.run;
  const header = [
    "Model",
    "Requested speed",
    "Completed",
    "Codex first token (s)",
    "Turn output tok/s",
    "Turn time (s)",
  ];
  const rows = report.summaries.map((group) => [
    group.model === null ? "Inherited" : safeTerminalText(group.model),
    benchmarkSpeedLabel(group.requestedSpeed),
    `${group.completedMeasuredTrials}/${group.plannedMeasuredTrials}`,
    metricCell(group.codexFirstTokenMs, group.completedMeasuredTrials, 1_000, 2),
    metricCell(group.turnOutputTokensPerSecond, group.completedMeasuredTrials, 1, 1),
    metricCell(group.turnDurationMs, group.completedMeasuredTrials, 1_000, 2),
  ]);
  const widths = header.map((label, column) =>
    rows.reduce(
      (width, row) => Math.max(width, getDisplayWidth(row[column]!)),
      getDisplayWidth(label),
    ),
  );
  const rowText = (row: string[]) =>
    row
      .map((cell, index) =>
        index === row.length - 1 ? cell : padToDisplayWidth(cell, widths[index]!),
      )
      .join("  ");

  stdout.write(
    `Codex benchmark completed ${completedMeasuredTrials}/${measuredTrials} measured trials (${warmupTrials} warm-ups).\n\n`,
  );
  stdout.write(`${colors.bold(rowText(header))}\n`);
  for (const row of rows) stdout.write(`${rowText(row)}\n`);
  stdout.write(
    "\nServed speed is unknown. Codex first token can precede visible text.\n" +
      "Turn output tok/s includes reasoning tokens and uses the full turn duration.\n",
  );

  const { prompt, tokenUsage } = report;
  const source =
    prompt.source === "file" ? safeTerminalText(prompt.path ?? unavailable) : "built-in sample";
  stdout.write(`Prompt source · ${source}\n`);
  if (prompt.text !== undefined) {
    const text = prompt.text.replaceAll("\r\n", "\n").split("\n").map(safeTerminalText).join("\n");
    stdout.write(`\n${colors.bold("Prompt")}\n${text}${text.endsWith("\n") ? "" : "\n"}`);
  }
  if (tokenUsage) {
    stdout.write(`\n${colors.bold("Reported token usage")}\n`);
    for (const trial of report.trials) {
      if (!trial.inferenceAttempted || !trial.tokenUsage) continue;
      const model = safeTerminalText(trial.model ?? trial.resolvedModel ?? "Inherited");
      const kind = trial.warmup ? "Warm-up" : `Trial ${trial.round}`;
      const label = `${model} · ${benchmarkSpeedLabel(trial.requestedSpeed)} · ${kind}`;
      stdout.write(
        `${formatBenchmarkUsage(label, trial.tokenUsage.counts, trial.tokenUsage.partial)}\n`,
      );
    }
    stdout.write(
      `${formatBenchmarkUsage("Token totals", tokenUsage.totals, tokenUsage.partial)}\n`,
    );
  }
}
