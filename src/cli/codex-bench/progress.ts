import type {
  BenchmarkSelection,
  BenchmarkTrial,
  BenchmarkWorkloadOptions,
} from "../../adapters/codex/benchmark/types";
import { getCliColors } from "../colors";
import { safeTerminalText } from "../terminal-text";
import { getDisplayWidth, truncateToDisplayWidth } from "../text-display-width";
import { createReflowingTerminalBlock } from "../tui/reflowing-block";
import type { CliRuntime } from "../types";
import { benchmarkSpeedLabel, formatBenchmarkUsage } from "./render";
import { createTokenUsageAccumulator } from "./report";

export function createBenchmarkProgress(
  runtime: CliRuntime,
  workload: BenchmarkWorkloadOptions,
  options: { showTokenUsage?: boolean; now?: () => number } = {},
) {
  const stream = runtime.stderr as NodeJS.WriteStream;
  const tty = Boolean(stream.isTTY);
  const frame = tty ? createReflowingTerminalBlock(stream) : undefined;
  const colors = getCliColors(runtime, stream);
  const now = options.now ?? (() => performance.now());
  const usage = options.showTokenUsage ? createTokenUsageAccumulator() : undefined;
  const combinations = (workload.models.length || 1) * (workload.speeds.length || 1);
  const measuredTrials = combinations * workload.runs;
  const trialCount = measuredTrials + combinations;
  let position = 0;
  let active: { selection: BenchmarkSelection; since: number; streaming: boolean } | undefined;
  let previousLine: string | undefined;
  let stopped = false;

  const plural = combinations === 1 ? "" : "s";
  stream.write(
    `${combinations} combination${plural} · ${measuredTrials} measured trial${measuredTrials === 1 ? "" : "s"} + ${combinations} warm-up${plural}\n`,
  );

  function draw(force = false): void {
    if (!frame || !active) return;
    const width = Math.max(0, frame.columns() - 1);
    const { selection, since, streaming } = active;
    const prefix = `[${position}/${trialCount}]`;
    const model = safeTerminalText(selection.model ?? "Inherited model");
    const speed =
      selection.requestedSpeed === null
        ? "Inherited speed"
        : `${benchmarkSpeedLabel(selection.requestedSpeed)} requested`;
    const trial = selection.warmup ? "Warm-up" : `Trial ${selection.round}/${workload.runs}`;
    const phase = streaming ? "Streaming" : "Waiting for text";
    const seconds = `${(Math.max(0, now() - since) / 1_000).toFixed(1)} s`;
    const essential = `${prefix} ${phase} · ${seconds}`;
    const compact = `${prefix} ${streaming ? "Streaming" : "Waiting"} ${seconds}`;
    const choices = [
      `${prefix} ${model} · ${speed} · ${trial} · ${phase} · ${seconds} elapsed`,
      `${prefix} ${model} · ${speed} · ${phase} · ${seconds}`,
      `${prefix} ${model} · ${phase} · ${seconds}`,
      essential,
      compact,
    ];
    const line =
      choices.find((choice) => getDisplayWidth(choice) <= width) ??
      truncateToDisplayWidth(compact, width);
    if (force || line !== previousLine) frame.render([line], colors.cyan(line));
    previousLine = line;
  }

  function clear(): void {
    active = undefined;
    previousLine = undefined;
    frame?.clear();
  }

  const resize = () => draw(true);
  const timer = tty ? setInterval(draw, 100) : undefined;
  timer?.unref();
  if (tty) stream.on("resize", resize);

  return {
    start(selection: BenchmarkSelection) {
      if (!frame || stopped) return;
      position++;
      active = { selection, since: now(), streaming: false };
      draw(true);
    },
    firstText() {
      if (!active || active.streaming) return;
      active.streaming = true;
      draw(true);
    },
    finish(trial: BenchmarkTrial) {
      clear();
      if (stopped || !usage || !trial.inferenceAttempted) return;
      usage.add(trial);
      const { totals, partial } = usage.snapshot();
      stream.write(`${formatBenchmarkUsage("Running token totals", totals, partial)}\n`);
    },
    stop() {
      if (stopped) return;
      stopped = true;
      if (timer) clearInterval(timer);
      if (tty) stream.off("resize", resize);
      clear();
    },
  };
}
