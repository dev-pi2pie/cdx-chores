import type { SavedTokenUsage } from "../../adapters/codex/benchmark/rollout";
import type { CodexSpeed } from "../../utils/codex-execution";
import { getCliColors } from "../colors";
import { safeTerminalText } from "../terminal-text";
import { getDisplayWidth, padToDisplayWidth } from "../text-display-width";
import type { CliRuntime } from "../types";
import { benchmarkGroupKey, type buildBenchmarkReport } from "./report";
import { createTokenUsageAccumulator } from "./usage";

type Report = ReturnType<typeof buildBenchmarkReport>;
type Metric = Report["summaries"][number]["codexFirstTokenMs"];

const speedLabels = { standard: "Standard", fast: "Fast", ultrafast: "Ultrafast" } as const;
const configuredTierLabels = new Map([
  ["default", speedLabels.standard],
  ["priority", speedLabels.fast],
  ["ultrafast", speedLabels.ultrafast],
]);
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

function measuredSettings(trials: Report["trials"]) {
  const settings = new Map<string, { tiers: Set<string | null>; efforts: Set<string | null> }>();
  for (const trial of trials) {
    if (trial.warmup || trial.status !== "completed") continue;
    const key = benchmarkGroupKey(trial);
    const group = settings.get(key) ?? { tiers: new Set(), efforts: new Set() };
    group.tiers.add(trial.configuredTier);
    group.efforts.add(trial.resolvedReasoningEffort);
    settings.set(key, group);
  }
  return settings;
}

function inheritedLabel(
  values: ReadonlySet<string | null> | undefined,
  format: (value: string) => string,
): string {
  const known = [...(values ?? [])].filter((value) => value !== null);
  if (known.length === 0) return "Inherited";
  if (known.length > 1) return "Inherited (Mixed)";
  const coverage = values?.has(null) ? ", partial" : "";
  return `Inherited (${format(known[0]!)}${coverage})`;
}

function effortLabel(value: string): string {
  return safeTerminalText(value.charAt(0).toUpperCase() + value.slice(1));
}

function metricCell(
  metric: Metric,
  completed: number,
  divisor: number,
  decimals: number,
  compact: boolean,
): string {
  if (metric.min === null || metric.max === null || metric.median === null) {
    return completed === 0 ? unavailable : `${unavailable} (0 samples)`;
  }
  const format = (value: number) => (value / divisor).toFixed(decimals);
  const min = format(metric.min);
  const max = format(metric.max);
  const value = compact
    ? format(metric.median)
    : metric.sampleCount === 1
      ? min
      : metric.sampleCount === 2
        ? `${min}–${max}`
        : `${min} / ${format(metric.median)} / ${max}`;
  const sampleLabel = metric.sampleCount === 1 ? "sample" : "samples";
  return metric.sampleCount === completed
    ? value
    : `${value} (${metric.sampleCount} ${sampleLabel})`;
}

function renderTable(
  runtime: CliRuntime,
  header: string[],
  rows: string[][],
  numericFrom = header.length,
): void {
  const widths = header.map((label, column) =>
    rows.reduce(
      (width, row) => Math.max(width, getDisplayWidth(row[column]!)),
      getDisplayWidth(label),
    ),
  );
  const rowText = (row: string[]) =>
    row
      .map((cell, index) => {
        const width = widths[index]!;
        if (index >= numericFrom) return `${" ".repeat(width - getDisplayWidth(cell))}${cell}`;
        return index === row.length - 1 ? cell : padToDisplayWidth(cell, width);
      })
      .join("  ");
  const colors = getCliColors(runtime, runtime.stdout);
  runtime.stdout.write(`${colors.bold(rowText(header))}\n`);
  for (const row of rows) runtime.stdout.write(`${rowText(row)}\n`);
}

function usageCells(counts: SavedTokenUsage | null): string[] {
  return [counts?.inputTokens, counts?.outputTokens, counts?.totalTokens].map(
    formatBenchmarkTokenCount,
  );
}

function usageLabel(label: string, partial: boolean): string {
  return partial ? `${label} (partial)` : label;
}

function renderTokenUsage(runtime: CliRuntime, report: Report, compact: boolean): void {
  if (!report.tokenUsage) return;
  const warmups = createTokenUsageAccumulator();
  const measured = createTokenUsageAccumulator();
  const rows: string[][] = [];
  for (const trial of report.trials) {
    if (!trial.inferenceAttempted || !trial.tokenUsage) continue;
    const subtotal = trial.warmup ? warmups : measured;
    subtotal.add(trial.tokenUsage);
    if (compact) continue;
    rows.push([
      usageLabel(
        benchmarkTrialLabel(trial, report.run.runsPerCombination),
        trial.tokenUsage.partial,
      ),
      safeTerminalText(trial.model ?? trial.resolvedModel ?? "Inherited"),
      benchmarkSpeedLabel(trial.requestedSpeed),
      ...usageCells(trial.tokenUsage.counts),
    ]);
  }
  const warmupUsage = warmups.snapshot();
  const measuredUsage = measured.snapshot();
  if (compact) {
    const fields = [
      ["warm-up", warmupUsage],
      ["measured", measuredUsage],
      ["total", report.tokenUsage],
    ] as const;
    runtime.stdout.write(
      `Tokens · ${fields
        .map(([label, usage]) =>
          usageLabel(
            `${formatBenchmarkTokenCount(usage.totals.totalTokens)} ${label}`,
            usage.partial,
          ),
        )
        .join(" · ")}\n`,
    );
    return;
  }
  for (const [label, usage] of [
    ["Warm-up subtotal", warmupUsage],
    ["Measured subtotal", measuredUsage],
    ["Invocation total", report.tokenUsage],
  ] as const) {
    rows.push([usageLabel(label, usage.partial), "", "", ...usageCells(usage.totals)]);
  }
  const colors = getCliColors(runtime, runtime.stdout);
  runtime.stdout.write(`\n${colors.bold("Reported token usage")}\n`);
  renderTable(
    runtime,
    ["Request", "Model", "Requested speed", "Input", "Output", "Total"],
    rows,
    3,
  );
}

export function renderBenchmarkReport(
  runtime: CliRuntime,
  report: Report,
  { compact = false }: { compact?: boolean } = {},
): void {
  const { stdout } = runtime;
  const colors = getCliColors(runtime, stdout);
  const { completedMeasuredTrials, measuredTrials, requested, warmupTrials } = report.run;
  const settings = measuredSettings(report.trials);
  const header = [
    "Model",
    compact ? "Requested" : "Requested speed",
    compact ? "Effort" : "Reasoning effort",
    compact ? "Done" : "Completed",
    compact ? "First token (s)" : "Codex first token (s)",
    compact ? "Output tok/s" : "Turn output tok/s",
    compact ? "Turn (s)" : "Turn time (s)",
  ];
  const rows = report.summaries.map((group) => {
    const inherited = settings.get(benchmarkGroupKey(group));
    const speed =
      group.requestedSpeed === null
        ? inheritedLabel(
            inherited?.tiers,
            (tier) => `configured ${safeTerminalText(configuredTierLabels.get(tier) ?? tier)}`,
          )
        : benchmarkSpeedLabel(group.requestedSpeed);
    const effort =
      requested.reasoningEffort === null
        ? inheritedLabel(inherited?.efforts, effortLabel)
        : effortLabel(requested.reasoningEffort);
    return [
      group.model === null ? "Inherited" : safeTerminalText(group.model),
      speed,
      effort,
      `${group.completedMeasuredTrials}/${group.plannedMeasuredTrials}`,
      metricCell(group.codexFirstTokenMs, group.completedMeasuredTrials, 1_000, 2, compact),
      metricCell(group.turnOutputTokensPerSecond, group.completedMeasuredTrials, 1, 1, compact),
      metricCell(group.turnDurationMs, group.completedMeasuredTrials, 1_000, 2, compact),
    ];
  });
  if (!compact) {
    stdout.write(
      `Codex benchmark completed ${completedMeasuredTrials}/${measuredTrials} measured trials (${warmupTrials} warm-ups).\n\n`,
    );
  }
  renderTable(runtime, header, rows, compact ? 4 : header.length);
  stdout.write(
    compact
      ? "\nMedians · served speed unknown\n"
      : "\nServed speed is unknown. Codex first token can precede visible text.\n" +
          "Turn output tok/s includes reasoning tokens and uses the full turn duration.\n",
  );

  const { prompt } = report;
  const source =
    prompt.source === "file" ? safeTerminalText(prompt.path ?? unavailable) : "built-in sample";
  if (!compact || prompt.source === "file" || prompt.text !== undefined)
    stdout.write(`Prompt source · ${source}\n`);
  if (prompt.text !== undefined) {
    const text = prompt.text.replaceAll("\r\n", "\n").split("\n").map(safeTerminalText).join("\n");
    stdout.write(`\n${colors.bold("Prompt")}\n${text}${text.endsWith("\n") ? "" : "\n"}`);
  }
  renderTokenUsage(runtime, report, compact);
}
