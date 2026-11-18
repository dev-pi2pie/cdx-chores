import { expect, test } from "bun:test";

import { renderBenchmarkReport } from "../../src/cli/codex-bench/render";
import { buildBenchmarkReport } from "../../src/cli/codex-bench/report";
import { createCapturedRuntime } from "../helpers/cli-test-utils";

function report() {
  return buildBenchmarkReport(
    { codexVersion: null, codexHome: null, interrupted: false, shutdownError: null, trials: [] },
    {
      workload: { models: [], speeds: [], runs: 3 },
      sessionRetention: "keep",
      prompt: { source: "built-in", path: null, text: "Fixture prompt" },
    },
  );
}

test.each([
  { sampleCount: 0, min: null, median: null, max: null, expected: "— (0 samples)" },
  { sampleCount: 1, min: 720, median: 720, max: 720, expected: "0.72 (1 sample)" },
  { sampleCount: 2, min: 720, median: 850, max: 980, expected: "0.72–0.98 (2 samples)" },
  { sampleCount: 3, min: 720, median: 850, max: 980, expected: "0.72 / 0.85 / 0.98" },
])("formats metric cells from $sampleCount usable samples", ({ expected, ...metric }) => {
  const result = report();
  const group = result.summaries[0]!;
  group.completedMeasuredTrials = 3;
  group.codexFirstTokenMs = metric;
  const { runtime, stdout, stderr } = createCapturedRuntime();
  renderBenchmarkReport(runtime, result);
  const row = stdout.text.split("\n").find((line) => line.startsWith("Inherited"));
  expect(row).toContain("3/3");
  expect(row).toContain(expected);
  expect(stdout.text).not.toContain("\u001b");
  expect(stderr.text).toBe("");
});

test("compact renders medians and labels metrics with fewer usable samples", () => {
  const result = report();
  const group = result.summaries[0]!;
  group.completedMeasuredTrials = 3;
  group.codexFirstTokenMs = { sampleCount: 3, min: 2_220, median: 2_310, max: 3_680 };
  group.turnOutputTokensPerSecond = { sampleCount: 2, min: 40, median: 45, max: 50 };
  const { runtime, stdout } = createCapturedRuntime();
  renderBenchmarkReport(runtime, result, { compact: true });
  expect(stdout.text).toMatch(
    /Inherited +Inherited +Inherited +3\/3 +2\.31 +45\.0 \(2 samples\) +— \(0 samples\)/u,
  );
  expect(stdout.text).toContain("Medians · served speed unknown");
  expect(stdout.text).not.toContain("Tokens ·");
});

test("escapes selected model and opted-in prompt text, and labels partial token totals", () => {
  const result = report();
  result.summaries[0]!.model = "模型\u009b";
  result.prompt = { source: "file", path: "example.txt", text: "first\r\n\u001b[31mnext\u200f" };
  result.tokenUsage = {
    partial: true,
    totals: {
      inputTokens: 12,
      outputTokens: null,
      cachedInputTokens: null,
      cacheWriteInputTokens: null,
      reasoningOutputTokens: null,
      totalTokens: null,
    },
  };
  const { runtime, stdout } = createCapturedRuntime();
  renderBenchmarkReport(runtime, result);
  expect(stdout.text).toContain("模型\\u009b");
  expect(stdout.text).toContain("first\n\\u001b[31mnext\\u200f");
  expect(stdout.text).toMatch(/Invocation total \(partial\) +12 +— +—/u);
});
