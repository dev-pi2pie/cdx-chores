import { expect, test } from "bun:test";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import { startCliBenchmark, withRunnerFixture, withStderrTtyPreload } from "./fixtures/runner";

const startup = "1 combination · 1 measured trial + 1 warm-up\n";

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
    expect(run.stdout).toContain("Token totals (partial) · input 195 · output 80");
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
    expect(styled.stdout).toContain("\u001b[1m");
    expect(disabled.stdout).not.toContain("\u001b");
    expect(environment.stdout).not.toContain("\u001b");
    expect(styled.stderr).toBe(startup);
  });
});
