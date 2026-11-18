import { expect, test } from "bun:test";

import type { BenchmarkTrial } from "../../src/adapters/codex/benchmark/types";
import { buildBenchmarkReport } from "../../src/cli/codex-bench/report";

const tokenCounts = {
  inputTokens: 20,
  outputTokens: 10,
  cachedInputTokens: 5,
  cacheWriteInputTokens: null,
  reasoningOutputTokens: 4,
  totalTokens: 30,
};

function trial(fields: Partial<BenchmarkTrial> = {}): BenchmarkTrial {
  return {
    model: null,
    provider: null,
    requestedSpeed: null,
    reasoningEffort: null,
    warmup: false,
    round: 1,
    status: "completed",
    error: null,
    threadId: "fixture-thread",
    turnId: "fixture-turn",
    inferenceAttempted: true,
    resolvedModel: "fixture-model",
    resolvedProvider: "fixture-provider",
    resolvedReasoningEffort: null,
    configuredTier: null,
    sentTier: null,
    servedSpeed: null,
    firstTokenMs: 50,
    durationMs: 500,
    outputTokens: tokenCounts.outputTokens,
    usage: tokenCounts,
    usagePartial: false,
    eligible: true,
    sessionRetention: null,
    ...fields,
  };
}

function report(
  trials: BenchmarkTrial[],
  options?: Partial<Parameters<typeof buildBenchmarkReport>[1]>,
) {
  return buildBenchmarkReport(
    {
      trials,
      codexVersion: "0.170.0",
      codexHome: null,
      interrupted: false,
      transportError: null,
      shutdownError: null,
    },
    {
      workload: { models: [], speeds: [], runs: 3 },
      prompt: { source: "built-in", path: null, text: "Fixture prompt" },
      sessionRetention: "keep",
      ...options,
    },
  );
}

test.each([
  { samples: [], min: null, median: null, max: null },
  { samples: [50], min: 50, median: 50, max: 50 },
  { samples: [90, 50], min: 50, median: 70, max: 90 },
  { samples: [90, 30, 50], min: 30, median: 50, max: 90 },
])("keeps the same summary fields for first-token samples $samples", ({ samples, ...expected }) => {
  const result = report(samples.map((firstTokenMs) => trial({ firstTokenMs })));
  expect(result.summaries[0]?.codexFirstTokenMs).toEqual({
    sampleCount: samples.length,
    ...expected,
  });
});

test("groups requested selections and counts completed trials and usable metrics separately", () => {
  const result = report(
    [
      trial({ model: "a", requestedSpeed: "standard", warmup: true, firstTokenMs: 1_000 }),
      trial({ model: "a", requestedSpeed: "standard", firstTokenMs: null }),
      trial({ model: "a", requestedSpeed: "standard", durationMs: 0 }),
      trial({ model: "a", requestedSpeed: "standard", eligible: false }),
      trial({ model: "a", requestedSpeed: "fast", outputTokens: 0 }),
      trial({ model: "b", requestedSpeed: "standard", resolvedModel: "a", usagePartial: true }),
    ],
    { workload: { models: ["a", "b"], speeds: ["standard", "fast"], runs: 3 } },
  );
  expect(result.summaries.map((group) => [group.model, group.requestedSpeed])).toEqual([
    ["a", "standard"],
    ["a", "fast"],
    ["b", "standard"],
    ["b", "fast"],
  ]);
  expect(result.run).toMatchObject({
    measuredTrials: 5,
    completedMeasuredTrials: 5,
    warmupTrials: 1,
  });
  expect(result.summaries[0]).toMatchObject({
    plannedMeasuredTrials: 3,
    completedMeasuredTrials: 3,
    codexFirstTokenMs: { sampleCount: 1, median: 50 },
    turnOutputTokensPerSecond: { sampleCount: 1, median: 20 },
    turnDurationMs: { sampleCount: 2, median: 250 },
  });
  expect(result.summaries[1]?.turnOutputTokensPerSecond).toMatchObject({
    sampleCount: 1,
    median: 0,
  });
  expect(result.summaries[2]?.turnOutputTokensPerSecond.sampleCount).toBe(0);
  expect(result.summaries[3]).toMatchObject({ measuredTrials: 0, completedMeasuredTrials: 0 });
});

test("includes available warm-up and partial usage without counting it in performance summaries", () => {
  const result = report(
    [
      trial({ warmup: true }),
      trial({ usage: null, outputTokens: null }),
      trial({
        status: "cancelled",
        eligible: false,
        usagePartial: true,
        usage: { ...tokenCounts, outputTokens: null, totalTokens: null },
        outputTokens: null,
      }),
    ],
    { showTokenUsage: true },
  );
  expect(result.tokenUsage).toEqual({
    totals: {
      inputTokens: 40,
      outputTokens: 10,
      cachedInputTokens: 10,
      cacheWriteInputTokens: null,
      reasoningOutputTokens: 8,
      totalTokens: 30,
    },
    partial: true,
  });
  expect(result.trials[1]?.tokenUsage).toEqual({ counts: null, partial: true });
  expect(result.trials[2]?.tokenUsage).toMatchObject({
    counts: { inputTokens: 20, outputTokens: null },
    partial: true,
  });
  expect(result.summaries[0]?.turnOutputTokensPerSecond.sampleCount).toBe(0);
});

test("leaves totals complete when the catalog skips an unattempted combination", () => {
  const result = report(
    [
      trial(),
      trial({
        status: "unavailable",
        eligible: false,
        inferenceAttempted: false,
        threadId: null,
        turnId: null,
        usage: null,
        outputTokens: null,
      }),
    ],
    { showTokenUsage: true },
  );
  expect(result.tokenUsage).toEqual({ totals: tokenCounts, partial: false });
  expect(result.trials[1]?.tokenUsage).toEqual({ counts: null, partial: false });
});
