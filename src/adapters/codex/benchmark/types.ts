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
  shutdownError: string | null;
}

export interface BenchmarkOptions {
  cwd: string;
  env?: NodeJS.ProcessEnv;
  signal?: AbortSignal;
  models: readonly string[];
  speeds: readonly CodexSpeed[];
  provider?: string;
  reasoningEffort?: ModelReasoningEffort;
  runs: number;
  prompt: string;
  sessionRetention?: CodexSessionRetention;
  onTrial?: (trial: BenchmarkTrial) => void;
  rollout?: RolloutReadOptions;
}

export function* benchmarkWorkload(options: BenchmarkOptions): Generator<BenchmarkSelection> {
  const models = options.models.length ? options.models : [null];
  const speeds = options.speeds.length ? options.speeds : [null];
  for (let round = 0; round <= options.runs; round++) {
    const start = Math.max(0, round - 1) % speeds.length;
    const orderedSpeeds = [...speeds.slice(start), ...speeds.slice(0, start)];
    for (const model of models) {
      for (const requestedSpeed of orderedSpeeds) {
        yield {
          model,
          requestedSpeed,
          provider: options.provider ?? null,
          reasoningEffort: options.reasoningEffort ?? null,
          warmup: round === 0,
          round,
        };
      }
    }
  }
}
