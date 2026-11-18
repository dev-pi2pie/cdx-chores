import { expect, test } from "bun:test";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { lifecycleDiagnostic } from "../codex-info/live-fixture";
import { REPO_ROOT } from "../helpers/cli-test-utils";
import { captureSpeedRequest, fixtureModel, speedCases } from "./fixtures/speed-provider";

type Fixture = Parameters<Parameters<typeof captureSpeedRequest>[1]>[0];

function runCli(fixture: Fixture, args: string[]) {
  const { start, env, codex } = fixture;
  return start({
    executable: process.execPath,
    args: [join(REPO_ROOT, "src/bin.ts"), ...args],
    env: { ...env, CDX_CHORES_CODEX_PATH: codex },
    timeoutMs: 18_000,
  }).completion;
}

async function rollouts(home: string, directory: string) {
  try {
    return (await readdir(join(home, directory), { recursive: true })).filter((path) =>
      path.endsWith(".jsonl"),
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

test.each(speedCases)(
  "benchmark CLI sends the selected tier: $label",
  async ({ baseline, selection, wireTier }) => {
    const requests = await captureSpeedRequest(baseline, async (fixture) => {
      const speed = selection === "default" ? "standard" : selection;
      const result = await runCli(fixture, [
        "codex-bench",
        "--runs",
        "1",
        ...(speed === undefined ? [] : ["--codex-speed", speed]),
      ]);
      if (!result.ok) throw new Error(`${lifecycleDiagnostic(result)}\n${result.stderr}`);
      expect(result.stdout).toContain("1/1 measured trials (1 warm-ups)");
      expect(await rollouts(fixture.env.CODEX_HOME!, "sessions")).toHaveLength(2);
      expect(await rollouts(fixture.env.CODEX_HOME!, "archived_sessions")).toEqual([]);
    });
    expect(requests.map((request) => [request.model, request.service_tier])).toEqual([
      [fixtureModel, wireTier],
      [fixtureModel, wireTier],
    ]);
    for (const request of requests) {
      expect(JSON.stringify(request.input)).toContain("Explain how an LRU cache works");
    }
  },
  25_000,
);

test("benchmark CLI rotates two models and two speeds with a fixed prompt and archives each trial", async () => {
  const secondModel = `${fixtureModel}-b`;
  const prompt = "Compare these fixture rows: α and β.\n";
  const requests = await captureSpeedRequest("default", async (fixture) => {
    const home = fixture.env.CODEX_HOME!;
    const catalogPath = join(home, "model-catalog.json");
    const catalog = JSON.parse(await readFile(catalogPath, "utf8")) as {
      models: Array<{ slug: string }>;
    };
    catalog.models.push({ ...catalog.models[0], slug: secondModel });
    await writeFile(catalogPath, JSON.stringify(catalog));
    await writeFile(join(fixture.cwd, "prompt.txt"), prompt);
    const result = await runCli(fixture, [
      "codex-bench",
      "--codex-speed",
      "standard",
      "--codex-model",
      fixtureModel,
      "--session-retention",
      "archive",
      "--codex-speed",
      "fast",
      "--prompt-file",
      "prompt.txt",
      "--codex-model",
      secondModel,
    ]);
    if (!result.ok) throw new Error(`${lifecycleDiagnostic(result)}\n${result.stderr}`);
    expect(result.stdout).toContain("12/12 measured trials (4 warm-ups)");
    expect(await rollouts(home, "sessions")).toEqual([]);
    expect(new Set(await rollouts(home, "archived_sessions")).size).toBe(16);
  });
  const forward = [
    [fixtureModel, undefined],
    [fixtureModel, "priority"],
    [secondModel, undefined],
    [secondModel, "priority"],
  ] satisfies [unknown[], unknown[], unknown[], unknown[]];
  const reverse = [forward[1], forward[0], forward[3], forward[2]];
  expect(requests.map((request) => [request.model, request.service_tier])).toEqual([
    ...forward,
    ...forward,
    ...reverse,
    ...forward,
  ]);
  for (const request of requests) {
    expect(JSON.stringify(request.input)).toContain(JSON.stringify(prompt).slice(1, -1));
  }
}, 25_000);

test("benchmark CLI rejects invalid runs, speed, retention and prompt files before inference", async () => {
  const requests = await captureSpeedRequest("default", async (fixture) => {
    await writeFile(join(fixture.cwd, "empty.txt"), " \n");
    await writeFile(join(fixture.cwd, "invalid.txt"), Buffer.from([0xff]));
    for (const { args, message } of [
      { args: ["--runs", "0"], message: "positive integer" },
      { args: ["--runs", "2.5"], message: "positive integer" },
      { args: ["--runs", "1", "--runs", "2"], message: "may only be specified once" },
      { args: ["--codex-speed", "normal"], message: "Codex speed must be one of" },
      { args: ["--session-retention", "remove"], message: "Session retention must be one of" },
      { args: ["--prompt-file", "missing.txt"], message: "Unable to load --prompt-file" },
      { args: ["--prompt-file", "empty.txt"], message: "Prompt file is empty" },
      { args: ["--prompt-file", "invalid.txt"], message: "utf-8" },
    ]) {
      const result = await runCli(fixture, ["codex-bench", ...args]);
      expect(result.exitCode).toBeGreaterThan(0);
      expect(result.stderr.toLowerCase()).toContain(message.toLowerCase());
      expect(result.stdout).toBe("");
    }
    expect(await rollouts(fixture.env.CODEX_HOME!, "sessions")).toEqual([]);
  });
  expect(requests).toEqual([]);
}, 25_000);
