import type { SavedTokenUsage } from "../../adapters/codex/benchmark/rollout";
import type { BenchmarkTrial } from "../../adapters/codex/benchmark/types";

export interface BenchmarkTokenUsage {
  counts: SavedTokenUsage | null;
  partial: boolean;
}

export function benchmarkTrialTokenUsage(trial: BenchmarkTrial): BenchmarkTokenUsage {
  const counts = trial.usage;
  return {
    counts,
    partial:
      trial.inferenceAttempted &&
      (trial.usagePartial ||
        counts?.inputTokens == null ||
        counts.outputTokens === null ||
        counts.totalTokens === null),
  };
}

export function createTokenUsageAccumulator() {
  const totals: SavedTokenUsage = {
    inputTokens: null,
    outputTokens: null,
    cachedInputTokens: null,
    cacheWriteInputTokens: null,
    reasoningOutputTokens: null,
    totalTokens: null,
  };
  const fields = Object.keys(totals) as (keyof SavedTokenUsage)[];
  let partial = false;
  return {
    add(usage: BenchmarkTokenUsage) {
      partial ||= usage.partial;
      for (const field of fields) {
        const count = usage.counts?.[field];
        if (count != null) totals[field] = (totals[field] ?? 0) + count;
      }
    },
    snapshot: () => ({ totals: { ...totals }, partial }),
  };
}
