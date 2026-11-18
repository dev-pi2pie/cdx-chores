import { expect, test } from "bun:test";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { BenchmarkOptions } from "../../src/adapters/codex/benchmark/types";
import type { buildBenchmarkReport } from "../../src/cli/codex-bench/report";
import { startCliBenchmark, traceMethod, withRunnerFixture } from "./fixtures/runner";

async function jsonBenchmark(options: BenchmarkOptions, args: string[] = []) {
  const result = await startCliBenchmark(options, ["--json", ...args]).completion;
  expect(result.stopped).toBe(true);
  expect(result.issues).toEqual([]);
  const report = JSON.parse(result.stdout) as ReturnType<typeof buildBenchmarkReport>;
  return { ...result, report };
}

test.each([0, 1, 2, 3])(
  "emits the same JSON summary fields for %i usable samples",
  async (count) => {
    await withRunnerFixture(
      { phase: count === 0 ? "commentary" : "final_answer" },
      async ({ options }) => {
        const runs = Math.max(count, 1);
        const { report, stderr, exitCode } = await jsonBenchmark({ ...options, runs });
        expect(exitCode).toBe(0);
        expect(stderr).toBe(
          `1 combination · ${runs} measured trial${runs === 1 ? "" : "s"} + 1 warm-up\n`,
        );
        expect(report.prompt).toEqual({ source: "built-in", path: null });
        expect(report.tokenUsage).toBeUndefined();
        expect(report.run.requested).toEqual({
          models: [null],
          speeds: [null],
          provider: null,
          reasoningEffort: null,
        });
        expect(report.trials).toHaveLength(runs + 1);
        for (const trial of report.trials) {
          expect(trial).toMatchObject({
            status: "completed",
            resolvedModel: "model-a",
            resolvedProvider: "fixture-provider",
            servedSpeed: null,
            turnOutputTokensPerSecond: 100,
          });
          expect(trial).not.toHaveProperty("tokenUsage");
          expect(trial).not.toHaveProperty("outputTokens");
        }
        const stats = (value: number) => ({
          sampleCount: count,
          min: count ? value : null,
          median: count ? value : null,
          max: count ? value : null,
        });
        expect(report.summaries).toEqual([
          {
            model: null,
            requestedSpeed: null,
            plannedMeasuredTrials: runs,
            measuredTrials: runs,
            completedMeasuredTrials: runs,
            codexFirstTokenMs: stats(200),
            turnOutputTokensPerSecond: stats(100),
            turnDurationMs: stats(800),
          },
        ]);
      },
    );
  },
);

test("preserves the opted-in UTF-8 prompt as a JSON value and escapes terminal controls", async () => {
  await withRunnerFixture({}, async ({ options }) => {
    const prompt = "Fixture prompt β\n\u001b[31m\u009b0m\u200f\n";
    await writeFile(join(options.cwd, "prompt.txt"), prompt);
    const { report, stdout, exitCode } = await jsonBenchmark(options, [
      "--prompt-file",
      "prompt.txt",
      "--show-prompt",
    ]);
    expect(exitCode).toBe(0);
    expect(report.prompt).toEqual({ source: "file", path: "prompt.txt", text: prompt });
    for (const control of ["\u001b", "\u009b", "\u200f"]) {
      expect(stdout).not.toContain(control);
    }
    expect(report.tokenUsage).toBeUndefined();
  });
});

test("adds attributable usage from an incomplete warm-up and marks missing trial usage", async () => {
  await withRunnerFixture(
    { failFirst: true, usageSnapshots: [{ input_tokens: 45 }, null] },
    async ({ options }) => {
      const { report, stderr, exitCode } = await jsonBenchmark({ ...options, runs: 2 }, [
        "--show-token-usage",
      ]);
      expect(exitCode).toBe(1);
      expect(stderr).toContain("fixture inference failed");
      expect(stderr).toContain("Trial 1/2 · model-a · Inherited · reported — (partial)");
      expect(report.prompt).not.toHaveProperty("text");
      expect(report.tokenUsage).toEqual({
        partial: true,
        totals: {
          inputTokens: 195,
          outputTokens: 80,
          cachedInputTokens: 25,
          cacheWriteInputTokens: 18,
          reasoningOutputTokens: 20,
          totalTokens: 230,
        },
      });
      expect(report.trials[0]).toMatchObject({
        status: "failed",
        warmup: true,
        tokenUsage: { partial: true, counts: { inputTokens: 45, outputTokens: null } },
        turnOutputTokensPerSecond: null,
      });
      expect(report.trials[1]).toMatchObject({
        status: "completed",
        tokenUsage: { partial: true, counts: null },
        turnOutputTokensPerSecond: null,
      });
      expect(report.summaries[0]).toMatchObject({
        completedMeasuredTrials: 2,
        codexFirstTokenMs: { sampleCount: 2 },
        turnOutputTokensPerSecond: { sampleCount: 1, median: 100 },
        turnDurationMs: { sampleCount: 2 },
      });
    },
  );
});

test("catalog-rejected speed still has a row and leaves usage totals complete for actual trials", async () => {
  await withRunnerFixture({}, async ({ options, trace }) => {
    const { report, stderr, exitCode } = await jsonBenchmark(options, [
      "--codex-model",
      "model-b",
      "--codex-speed",
      "ultrafast",
      "--codex-speed",
      "standard",
      "--show-token-usage",
    ]);
    expect(exitCode).toBe(0);
    expect(stderr).toContain("does not advertise ultrafast");
    expect(stderr).toContain(
      "Warm-up · model-b · Standard · reported 230 tokens · cumulative 230 tokens",
    );
    expect(stderr).toContain(
      "Trial 1/1 · model-b · Standard · reported 230 tokens · cumulative 460 tokens",
    );
    expect(stderr).not.toContain("· Ultrafast · reported");
    expect(traceMethod(await trace(), "turn/start")).toHaveLength(2);
    expect(report.tokenUsage).toMatchObject({
      partial: false,
      totals: { inputTokens: 300, outputTokens: 160 },
    });
    expect(report.trials[0]).toMatchObject({
      status: "unavailable",
      inferenceAttempted: false,
      tokenUsage: { partial: false, counts: null },
    });
    expect(report.summaries[0]).toMatchObject({
      model: "model-b",
      requestedSpeed: "ultrafast",
      completedMeasuredTrials: 0,
      turnOutputTokensPerSecond: { sampleCount: 0, median: null },
    });
  });
});

test.each(["archive", "delete"] as const)(
  "keeps the full JSON result when requested %s fails after inference",
  async (mode) => {
    await withRunnerFixture({ retentionError: true }, async ({ options, trace }) => {
      const { report, stderr, exitCode } = await jsonBenchmark(options, [
        "--session-retention",
        mode,
        "--show-token-usage",
      ]);
      expect(exitCode).toBe(1);
      expect(stderr).toContain("Session retention failed (thread-2)");
      expect(traceMethod(await trace(), `thread/${mode}`)).toHaveLength(2);
      expect(report.run.sessionRetention).toBe(mode);
      expect(report.trials).toHaveLength(2);
      expect(report.trials[1]).toMatchObject({
        status: "completed",
        threadId: "thread-2",
        codexFirstTokenMs: 200,
        turnOutputTokensPerSecond: 100,
        turnDurationMs: 800,
        tokenUsage: { partial: false, counts: { outputTokens: 80 } },
        sessionRetention: {
          status: "failed",
          threadId: "thread-2",
          error: expect.stringContaining("fixture cleanup failed"),
        },
      });
      expect(report.summaries[0]?.completedMeasuredTrials).toBe(1);
      expect(report.tokenUsage).toMatchObject({ partial: false, totals: { outputTokens: 160 } });
    });
  },
);
