import { expect, test } from "bun:test";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { startCliBenchmark, withRunnerFixture, withStderrTtyPreload } from "./fixtures/runner";

const startup = "1 combination · 1 measured trial + 1 warm-up\n";

test("compact output counts case occurrences in progress and merges repeated pairs in the table", async () => {
  await withRunnerFixture({}, async ({ options }) => {
    const result = await startCliBenchmark(options, [
      "--case",
      "model-a=fast",
      "--case",
      "model-b=standard",
      "--case",
      "model-a=fast",
      "--compact",
      "--no-color",
    ]).completion;
    expect(result.ok).toBe(true);
    expect(result.stderr).toBe("3 combinations · 3 measured trials + 3 warm-ups\n");
    expect(
      result.stdout
        .split("\n")
        .filter((line) => line.startsWith("model-"))
        .map((line) => line.trim().split(/ {2,}/).slice(0, 3)),
    ).toEqual([
      ["model-a", "Fast", "2/2"],
      ["model-b", "Standard", "1/1"],
    ]);
  });
});

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
    {
      usageSnapshots: [usage, usage, usage, { input_tokens: 125, output_tokens: 0 }, null, usage],
    },
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
        ["Trial 1/1 (partial)", "model-a", "Standard", "125", "0", "—"],
        ["Trial 1/1 (partial)", "model-a", "Ultrafast", "—", "—", "—"],
        ["Trial 1/1", "model-b", "Standard", "1,000", "0", "1,000"],
        ["Warm-up subtotal", "3,000", "0", "3,000"],
        ["Measured subtotal (partial)", "1,125", "0", "1,000"],
        ["Invocation total (partial)", "4,125", "0", "4,000"],
      ]);
      expect(run.stderr).toContain(
        "Trial 1/1 · model-a · Standard · reported — (partial) · cumulative 3,000 tokens (partial)",
      );
      expect(run.stderr).toContain(
        "Trial 1/1 · model-b · Standard · reported 1,000 tokens · cumulative 4,000 tokens (partial)",
      );
    },
  );
});

test.each(["matching", "unrelated"] as const)(
  "keeps compact TTY progress concise during %s text events",
  async (streamText) => {
    await withRunnerFixture({ streamText }, async ({ options }) => {
      const preload = await withStderrTtyPreload(options.cwd);
      const run = await startCliBenchmark(
        options,
        ["--compact", "--no-color", "--show-token-usage"],
        preload,
      ).completion;
      expect(run.ok).toBe(true);
      expect(run.stdout).toContain("Tokens · 230 warm-up · 230 measured · 460 total");
      expect(run.stdout).not.toContain("\u001b");
      expect(run.stderr.startsWith(startup)).toBe(true);
      expect(run.stderr).toContain("Waiting for text");
      expect(run.stderr.includes("Streaming")).toBe(streamText === "matching");
      expect(run.stderr).not.toContain("private fixture chunk");
      expect(run.stderr).not.toContain("reported 230 tokens");
      expect(run.stderr.endsWith("\r\u001b[2K\r")).toBe(true);
    });
  },
);

test("compact keeps partial totals in the report and emits only startup on redirected stderr", async () => {
  await withRunnerFixture({ usageSnapshots: [null] }, async ({ options }) => {
    const run = await startCliBenchmark(options, ["--compact", "--show-token-usage"]).completion;
    expect(run.ok).toBe(true);
    expect(run.stdout).toMatch(/Inherited +Inherited +1\/1 +0\.20 +100\.0 +0\.80/u);
    expect(run.stdout).toContain(
      "Tokens · — warm-up (partial) · 230 measured · 230 total (partial)",
    );
    expect(run.stdout).not.toContain("Reported token usage");
    expect(run.stderr).toBe(startup);
  });
});

test("clears transient JSON progress before writing the report with prompt and usage", async () => {
  await withRunnerFixture({ streamText: "matching" }, async ({ options }) => {
    const writesPath = join(options.cwd, "cli-writes.jsonl");
    const preload = await withStderrTtyPreload(options.cwd, writesPath);
    await writeFile(join(options.cwd, "task.txt"), "Fixture prompt\n");
    const run = await startCliBenchmark(
      options,
      ["--json", "--compact", "--show-token-usage", "--prompt-file", "./task.txt", "--show-prompt"],
      preload,
    ).completion;
    expect(run.ok).toBe(true);
    const report = JSON.parse(run.stdout);
    expect(report.run.completedMeasuredTrials).toBe(1);
    expect(report.tokenUsage).toMatchObject({ totals: { totalTokens: 460 } });
    expect(report.prompt).toEqual({ source: "file", path: "./task.txt", text: "Fixture prompt\n" });
    expect(run.stderr).toContain("Waiting for text");
    expect(run.stderr).toContain("Streaming");
    expect(run.stderr).not.toContain("private fixture chunk");
    expect(run.stderr).not.toContain(startup.trim());
    expect(run.stderr).not.toContain("reported 230 tokens");

    const writes = (await readFile(writesPath, "utf8"))
      .trimEnd()
      .split("\n")
      .map((line) => JSON.parse(line) as { name: string; text: string });
    const reportWrite = writes.findIndex(({ name }) => name === "stdout");
    expect(reportWrite).toBeGreaterThan(0);
    expect(
      writes
        .slice(0, reportWrite)
        .map(({ text }) => text)
        .join(""),
    ).toBe(run.stderr);
    expect(run.stderr.endsWith("\r\x1b[2K\r")).toBe(true);
  });
});

test.each(["TTY", "redirected", "--no-color", "NO_COLOR"] as const)(
  "mixed-speed JSON reports warnings with the stderr color policy for %s",
  async (mode) => {
    await withRunnerFixture({}, async ({ options }) => {
      const preload = mode === "redirected" ? undefined : await withStderrTtyPreload(options.cwd);
      const run = await startCliBenchmark(
        mode === "NO_COLOR" ? { ...options, env: { ...options.env, NO_COLOR: "" } } : options,
        [
          "--json",
          "--codex-model",
          "model-b",
          "--codex-speed",
          "ultrafast",
          "--codex-speed",
          "standard",
          ...(mode === "--no-color" ? ["--no-color"] : []),
        ],
        preload,
      ).completion;
      expect(run.ok).toBe(true);
      const warning = " (model-b/ultrafast): model-b does not advertise ultrafast.";
      const label = mode === "TTY" ? "\x1b[33munavailable\x1b[39m" : "unavailable";
      if (preload) {
        expect(run.stderr).toContain(`\r\x1b[2K\r${label}${warning}\n`);
      } else {
        expect(run.stderr).toBe(`${label}${warning}\n${label}${warning}\n`);
      }
      if (mode !== "TTY") expect(run.stderr.replaceAll("\x1b[2K", "")).not.toContain("\x1b");

      expect(run.stdout).not.toContain("\x1b");
      const report = JSON.parse(run.stdout);
      expect(report.run.completedMeasuredTrials).toBe(1);
      expect(report.trials[0]).toMatchObject({
        status: "unavailable",
        error: "model-b does not advertise ultrafast.",
      });
      expect(report.trials.at(-1)).toMatchObject({
        status: "completed",
        requestedSpeed: "standard",
      });
    });
  },
);

test("prints red trial and retention failures after clearing the JSON progress line", async () => {
  await withRunnerFixture({ failFirst: true, retentionError: true }, async ({ options }) => {
    const preload = await withStderrTtyPreload(options.cwd);
    const run = await startCliBenchmark(
      options,
      ["--json", "--session-retention", "archive"],
      preload,
    ).completion;
    expect(run.exitCode).toBe(1);
    expect(run.stderr).toContain(
      "\r\x1b[2K\r\x1b[31mfailed\x1b[39m (inherited model/inherited speed): fixture inference failed\n",
    );
    expect(run.stderr).toContain("Session retention \x1b[31mfailed\x1b[39m (thread-2):");
    const report = JSON.parse(run.stdout);
    expect(report.trials.at(-1)).toMatchObject({
      status: "completed",
      sessionRetention: { status: "failed" },
    });
  });
});

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
