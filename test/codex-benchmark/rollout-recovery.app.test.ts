import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { REPO_ROOT, withTempFixtureDir } from "../helpers/cli-test-utils";
import type { Scenario } from "./fixtures/live-check";

const driver = join(REPO_ROOT, "test/codex-benchmark/fixtures/live-check.ts");

function event(type: string, payload: object) {
  return JSON.stringify({ type: "event_msg", payload: { type, ...payload } }) + "\n";
}

const started = event("task_started", { turn_id: "fixture-turn" });
const tokens = (output_tokens: number) =>
  event("token_count", { info: { total_token_usage: { output_tokens } } });
const complete = event("task_complete", {
  turn_id: "fixture-turn",
  time_to_first_token_ms: 200,
  duration_ms: 800,
});
const completeJsonl = started + tokens(80) + complete;

async function runScenario(
  scenario: Scenario,
  verify: (run: {
    exitCode: number | null;
    report: { sessionRetention: string; results: [unknown] };
    trace: string[];
    home: string;
  }) => Promise<void> | void,
  args: string[] = [],
) {
  await withTempFixtureDir("codex-benchmark-recovery", async (directory) => {
    const home = join(directory, "codex-home");
    await mkdir(home);
    await writeFile(join(home, "scenario.json"), JSON.stringify(scenario));
    await writeFile(join(home, "unrelated.jsonl"), "unrelated thread\n");
    const result = spawnSync(
      process.execPath,
      [driver, "--model", "fixture-model", "--effort", "low", "--speed", "standard", ...args],
      {
        cwd: directory,
        env: { HOME: directory, CODEX_HOME: home, TMPDIR: directory },
        encoding: "utf8",
        timeout: 4_000,
      },
    );
    if (result.error || result.stderr) throw new Error(result.stderr, { cause: result.error });
    expect(await readFile(join(home, "unrelated.jsonl"), "utf8")).toBe("unrelated thread\n");
    const report = JSON.parse(result.stdout);
    expect(report.results).toHaveLength(1);
    await verify({
      exitCode: result.status,
      report,
      trace: (await readFile(join(home, "trace.txt"), "utf8")).trimEnd().split("\n"),
      home,
    });
  });
}

test("recovers a terminal line completed after the first rollout read", async () => {
  await runScenario(
    {
      jsonl: started + tokens(80) + complete.slice(0, -3),
      finishAfterFirstRead: complete.slice(-3),
      liveOutputTokens: 80,
    },
    ({ exitCode, report, trace, home }) => {
      expect(exitCode).toBe(0);
      expect(report.results[0]).toMatchObject({
        status: "completed",
        pathAtThreadStart: true,
        pathLookupAttempts: 0,
        firstReadFoundTerminal: false,
        terminalEvent: "task_complete",
        firstTokenMs: 200,
        durationMs: 800,
        outputTokens: 80,
        turnOutputTokensPerSecond: 100,
        durationMatchesLive: true,
        outputMatchesLive: true,
      });
      const read = `rollout/read ${join(home, "returned-rollout.jsonl")}`;
      expect(trace).toEqual([
        "turn/start fixture-thread",
        "turn/completed fixture-turn",
        read,
        "rollout/write completed",
        read,
      ]);
    },
  );
});

test("retries thread/read and uses the exact returned rollout path", async () => {
  await runScenario(
    { jsonl: completeJsonl, pathAfterLookups: 2 },
    ({ exitCode, report, trace, home }) => {
      expect(exitCode).toBe(0);
      expect(report.results[0]).toMatchObject({
        pathAtThreadStart: false,
        pathLookupAttempts: 2,
        firstReadFoundTerminal: true,
        firstTokenMs: 200,
        outputTokens: 80,
      });
      expect(trace).toEqual([
        "turn/start fixture-thread",
        "turn/completed fixture-turn",
        "thread/read fixture-thread",
        "thread/read fixture-thread",
        `rollout/read ${join(home, "returned-rollout.jsonl")}`,
      ]);
    },
  );
});
