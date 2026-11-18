import {
  benchmarkWorkload,
  type BenchmarkRun,
  type BenchmarkSelection,
  type BenchmarkTrial,
  type BenchmarkWorkloadOptions,
} from "../../adapters/codex/benchmark/types";
import type { CodexSessionRetention } from "../../utils/codex-session-retention";
import { benchmarkTrialTokenUsage, createTokenUsageAccumulator } from "./usage";

export interface BenchmarkPrompt {
  source: "built-in" | "file";
  path: string | null;
  text: string;
}

interface ReportOptions {
  workload: BenchmarkWorkloadOptions;
  prompt: BenchmarkPrompt;
  sessionRetention: CodexSessionRetention;
  showPrompt?: boolean;
  showTokenUsage?: boolean;
}

function trialMetrics(trial: BenchmarkTrial) {
  const { durationMs, outputTokens } = trial;
  const turnOutputTokensPerSecond =
    trial.status === "completed" &&
    !trial.usagePartial &&
    outputTokens !== null &&
    durationMs !== null &&
    durationMs > 0
      ? outputTokens / (durationMs / 1_000)
      : null;
  return {
    codexFirstTokenMs: trial.firstTokenMs,
    turnOutputTokensPerSecond,
    turnDurationMs: durationMs,
  };
}

function statistics(values: number[]) {
  values.sort((a, b) => a - b);
  const sampleCount = values.length;
  const min = values[0] ?? null;
  const max = values.at(-1) ?? null;
  const middle = Math.floor(sampleCount / 2);
  const median =
    sampleCount === 0
      ? null
      : sampleCount % 2 === 0
        ? (values[middle - 1]! + values[middle]!) / 2
        : values[middle]!;
  return { sampleCount, min, median, max };
}

function groupKey({ model, requestedSpeed }: BenchmarkSelection): string {
  return JSON.stringify([model, requestedSpeed]);
}

function trialGroup(selection: BenchmarkSelection) {
  return {
    model: selection.model,
    requestedSpeed: selection.requestedSpeed,
    plannedMeasuredTrials: 0,
    measuredTrials: 0,
    completedMeasuredTrials: 0,
    firstTokens: [] as number[],
    outputRates: [] as number[],
    durations: [] as number[],
  };
}

export function buildBenchmarkReport(run: BenchmarkRun, options: ReportOptions) {
  const { workload, prompt, sessionRetention, showPrompt, showTokenUsage } = options;
  const groups = new Map<string, ReturnType<typeof trialGroup>>();
  for (const selection of benchmarkWorkload({ ...workload, runs: 0 })) {
    const key = groupKey(selection);
    const group = groups.get(key) ?? trialGroup(selection);
    group.plannedMeasuredTrials += workload.runs;
    groups.set(key, group);
  }

  let completedMeasuredTrials = 0;
  let measuredTrials = 0;
  let warmupTrials = 0;
  const tokenUsage = showTokenUsage ? createTokenUsageAccumulator() : undefined;
  const trials = run.trials.map((trial) => {
    const trialUsage = tokenUsage && benchmarkTrialTokenUsage(trial);
    if (trial.inferenceAttempted && trialUsage) tokenUsage?.add(trialUsage);
    const metrics = trialMetrics(trial);
    if (trial.warmup) {
      warmupTrials++;
    } else {
      const group = groups.get(groupKey(trial))!;
      measuredTrials++;
      group.measuredTrials++;
      if (trial.status === "completed") {
        completedMeasuredTrials++;
        group.completedMeasuredTrials++;
        if (trial.eligible) {
          if (metrics.codexFirstTokenMs !== null) group.firstTokens.push(metrics.codexFirstTokenMs);
          if (metrics.turnOutputTokensPerSecond !== null)
            group.outputRates.push(metrics.turnOutputTokensPerSecond);
          if (metrics.turnDurationMs !== null) group.durations.push(metrics.turnDurationMs);
        }
      }
    }
    return {
      model: trial.model,
      requestedSpeed: trial.requestedSpeed,
      provider: trial.provider,
      reasoningEffort: trial.reasoningEffort,
      resolvedModel: trial.resolvedModel,
      resolvedProvider: trial.resolvedProvider,
      resolvedReasoningEffort: trial.resolvedReasoningEffort,
      configuredTier: trial.configuredTier,
      sentTier: trial.sentTier,
      servedSpeed: trial.servedSpeed,
      warmup: trial.warmup,
      round: trial.round,
      status: trial.status,
      error: trial.error,
      threadId: trial.threadId,
      turnId: trial.turnId,
      inferenceAttempted: trial.inferenceAttempted,
      eligible: trial.eligible,
      sessionRetention: trial.sessionRetention,
      ...metrics,
      ...(trialUsage ? { tokenUsage: trialUsage } : {}),
    };
  });

  const summaries = [...groups.values()].map(
    ({ firstTokens, outputRates, durations, ...group }) => ({
      ...group,
      codexFirstTokenMs: statistics(firstTokens),
      turnOutputTokensPerSecond: statistics(outputRates),
      turnDurationMs: statistics(durations),
    }),
  );

  return {
    run: {
      codexVersion: run.codexVersion,
      codexHome: run.codexHome,
      interrupted: run.interrupted,
      shutdownError: run.shutdownError,
      requested: {
        models: workload.models.length ? workload.models : [null],
        speeds: workload.speeds.length ? workload.speeds : [null],
        provider: workload.provider ?? null,
        reasoningEffort: workload.reasoningEffort ?? null,
      },
      runsPerCombination: workload.runs,
      sessionRetention,
      completedMeasuredTrials,
      measuredTrials,
      warmupTrials,
    },
    prompt: {
      source: prompt.source,
      path: prompt.path,
      ...(showPrompt ? { text: prompt.text } : {}),
    },
    trials,
    summaries,
    ...(tokenUsage ? { tokenUsage: tokenUsage.snapshot() } : {}),
  };
}
