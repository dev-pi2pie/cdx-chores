import { expect, test } from "bun:test";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import { startCliBenchmark, withRunnerFixture, withStderrTtyPreload } from "./fixtures/runner";

const startup = "1 combination · 1 measured trial + 1 warm-up\n";

function usageRows(stdout: string): string[][] {
  return stdout
    .split("Reported token usage\n")[1]!
    .trim()
    .split("\n")
    .map((line) => line.trim().split(/ {2,}/));
}

test("redirects startup and running partial usage to stderr, with prompt and totals on stdout", async () => {
  await withRunnerFixture({ usageSnapshots: [{ input_tokens: 45 }] }, async ({ options }) => {
    await writeFile(join(options.cwd, "prompt.txt"), "Fixture prompt\n\u001b[31m");
    const run = await startCliBenchmark(options, [
      "--prompt-file",
      "prompt.txt",
      "--show-prompt",
      "--show-token-usage",
    ]).completion;
    expect(run.ok).toBe(true);
    expect(run.stdout).toContain("Requested speed");
    expect(run.stdout).toContain("Prompt\nFixture prompt\n\\u001b[31m");
    expect(usageRows(run.stdout)).toEqual([
      ["Request", "Model", "Requested speed", "Input", "Output", "Total"],
      ["Warm-up (partial)", "model-a", "Inherited", "45", "—", "—"],
      ["Trial 1/1", "model-a", "Inherited", "150", "80", "230"],
      ["Warm-up subtotal (partial)", "45", "—", "—"],
      ["Measured subtotal", "150", "80", "230"],
      ["Invocation total (partial)", "195", "80", "230"],
    ]);
    expect(run.stderr).toBe(
      startup +
        "Warm-up · model-a · Inherited · reported — (partial) · cumulative — (partial)\n" +
        "Trial 1/1 · model-a · Inherited · reported 230 tokens · cumulative 230 tokens (partial)\n",
    );
    expect(run.stderr).not.toContain("Waiting for text");
    expect(run.stderr).not.toContain("\u001b");
    expect(run.stdout).not.toContain("\u001b");
  });
});

test("reconciles partial measured usage and warm-up subtotals across models and speeds", async () => {
  const usage = { input_tokens: 1_000, output_tokens: 0, total_tokens: 1_000 };
  await withRunnerFixture(
    { usageSnapshots: [usage, usage, usage, null, usage, usage] },
    async ({ options }) => {
      const run = await startCliBenchmark(options, [
        "--codex-model",
        "model-a",
        "--codex-model",
        "model-b",
        "--codex-speed",
        "standard",
        "--codex-speed",
        "ultrafast",
        "--show-token-usage",
      ]).completion;
      expect(run.ok).toBe(true);
      expect(usageRows(run.stdout)).toEqual([
        ["Request", "Model", "Requested speed", "Input", "Output", "Total"],
        ["Warm-up", "model-a", "Standard", "1,000", "0", "1,000"],
        ["Warm-up", "model-a", "Ultrafast", "1,000", "0", "1,000"],
        ["Warm-up", "model-b", "Standard", "1,000", "0", "1,000"],
        ["Trial 1/1 (partial)", "model-a", "Standard", "—", "—", "—"],
        ["Trial 1/1", "model-a", "Ultrafast", "1,000", "0", "1,000"],
        ["Trial 1/1", "model-b", "Standard", "1,000", "0", "1,000"],
        ["Warm-up subtotal", "3,000", "0", "3,000"],
        ["Measured subtotal (partial)", "2,000", "0", "2,000"],
        ["Invocation total (partial)", "5,000", "0", "5,000"],
      ]);
      expect(run.stderr).toContain(
        "Trial 1/1 · model-b · Standard · reported 1,000 tokens · cumulative 5,000 tokens (partial)",
      );
    },
  );
});

test.each(["matching", "unrelated"] as const)(
  "keeps JSON stdout clean during $streamText text events on a TTY",
  async (streamText) => {
    await withRunnerFixture({ streamText }, async ({ options }) => {
      const preload = await withStderrTtyPreload(options.cwd);
      const run = await startCliBenchmark(options, ["--json", "--no-color"], preload).completion;
      expect(run.ok).toBe(true);
      expect(JSON.parse(run.stdout).run.completedMeasuredTrials).toBe(1);
      expect(run.stdout).not.toContain("\u001b");
      expect(run.stderr.startsWith(startup)).toBe(true);
      expect(run.stderr).toContain("Waiting for text");
      expect(run.stderr.includes("Streaming")).toBe(streamText === "matching");
      expect(run.stderr).not.toContain("private fixture chunk");
      expect(run.stderr.endsWith("\r\u001b[2K\r")).toBe(true);
    });
  },
);

test("uses terminal color only when stdout is a TTY and colors are enabled", async () => {
  await withRunnerFixture({}, async ({ options }) => {
    const preload = join(options.cwd, "stdout-tty.cjs");
    await writeFile(preload, 'Object.defineProperty(process.stdout, "isTTY", { value: true });');
    const styled = await startCliBenchmark(options, [], preload).completion;
    const disabled = await startCliBenchmark(options, ["--no-color"], preload).completion;
    const environment = await startCliBenchmark(
      {
        ...options,
        env: { ...options.env, NO_COLOR: "" },
      },
      [],
      preload,
    ).completion;
    for (const run of [styled, disabled, environment]) expect(run.ok).toBe(true);
    expect(styled.stdout).not.toContain("Reported token usage");
    expect(styled.stdout).toContain("\u001b[1m");
    expect(disabled.stdout).not.toContain("\u001b");
    expect(environment.stdout).not.toContain("\u001b");
    expect(styled.stderr).toBe(startup);
  });
});
