import type { ModelReasoningEffort } from "@openai/codex-sdk";

import type { CodexSessionRetention } from "../../../utils/codex-session-retention";
import type { CodexSpeed } from "../../../utils/codex-execution";
import type { CodexSessionRetentionResult } from "../session-retention";
import type { RolloutReadOptions, SavedTokenUsage } from "./rollout";

export interface BenchmarkSelection {
  model: string | null;
  requestedSpeed: CodexSpeed | null;
  provider: string | null;
  reasoningEffort: ModelReasoningEffort | null;
  warmup: boolean;
  round: number;
}

export interface BenchmarkTrial extends BenchmarkSelection {
  status: "completed" | "failed" | "cancelled" | "unavailable";
  error: string | null;
  threadId: string | null;
  turnId: string | null;
  inferenceAttempted: boolean;
  resolvedModel: string | null;
  resolvedProvider: string | null;
  resolvedReasoningEffort: string | null;
  configuredTier: string | null;
  sentTier: string | null;
  servedSpeed: null;
  firstTokenMs: number | null;
  durationMs: number | null;
  outputTokens: number | null;
  usage: SavedTokenUsage | null;
  usagePartial: boolean;
  eligible: boolean;
  sessionRetention: CodexSessionRetentionResult | null;
}

export interface BenchmarkRun {
  codexVersion: string | null;
  codexHome: string | null;
  trials: BenchmarkTrial[];
  interrupted: boolean;
  startupError: string | null;
  transportError: string | null;
  shutdownError: string | null;
}

export interface BenchmarkCase {
  model: string;
  requestedSpeed: CodexSpeed | null;
}

export type BenchmarkWorkloadOptions = (
  | { cases: readonly BenchmarkCase[]; models?: never; speeds?: never }
  | { cases?: never; models: readonly string[]; speeds: readonly CodexSpeed[] }
) & {
  provider?: string;
  reasoningEffort?: ModelReasoningEffort;
  runs: number;
};

export type BenchmarkOptions = BenchmarkWorkloadOptions & {
  cwd: string;
  env?: NodeJS.ProcessEnv;
  signal?: AbortSignal;
  prompt: string;
  sessionRetention?: CodexSessionRetention;
  onTrialStart?: (selection: BenchmarkSelection) => void;
  onFirstText?: () => void;
  onTrial?: (trial: BenchmarkTrial) => void;
  rollout?: RolloutReadOptions;
};

function* benchmarkPairs(
  options: BenchmarkWorkloadOptions,
  round: number,
): Generator<Pick<BenchmarkSelection, "model" | "requestedSpeed">> {
  if (options.cases) {
    yield* options.cases;
    return;
  }
  const models = options.models.length ? options.models : [null];
  const speeds = options.speeds.length ? options.speeds : [null];
  const start = Math.max(0, round - 1) % speeds.length;
  const orderedSpeeds = [...speeds.slice(start), ...speeds.slice(0, start)];
  for (const model of models) {
    for (const requestedSpeed of orderedSpeeds) yield { model, requestedSpeed };
  }
}

export function* benchmarkWorkload(
  options: BenchmarkWorkloadOptions,
): Generator<BenchmarkSelection> {
  for (let round = 0; round <= options.runs; round++) {
    for (const pair of benchmarkPairs(options, round)) {
      yield {
        ...pair,
        provider: options.provider ?? null,
        reasoningEffort: options.reasoningEffort ?? null,
        warmup: round === 0,
        round,
      };
    }
  }
}
