import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
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
const aborted = event("turn_aborted", { turn_id: "fixture-turn", reason: "interrupted" });
const otherStarted = event("task_started", { turn_id: "other-turn" });
const otherComplete = event("task_complete", { turn_id: "other-turn", duration_ms: 1 });

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
      expect(report.sessionRetention).toBe("keep");
      expect(report.results[0]).toMatchObject({
        status: "completed",
        pathAtThreadStart: true,
        pathLookupAttempts: 0,
        firstReadFoundTerminal: false,
        terminalEvent: "task_complete",
        firstTokenMs: 200,
        durationMs: 800,
        outputTokens: 80,
        usagePartial: false,
        turnOutputTokensPerSecond: 100,
        durationMatchesLive: true,
        outputMatchesLive: true,
        sessionRetention: { status: "kept" },
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

test("expires on an unfinished terminal record and retains attributable usage before archiving", async () => {
  await runScenario(
    { jsonl: started + tokens(40) + complete.slice(0, -3), deadlineMs: 300 },
    async ({ exitCode, report, trace, home }) => {
      expect(exitCode).toBe(1);
      expect(report.results[0]).toMatchObject({
        status: "completed",
        firstReadFoundTerminal: false,
        terminalEvent: null,
        terminalVisibleAfterMs: null,
        firstTokenMs: null,
        durationMs: null,
        turnOutputTokensPerSecond: null,
        liveDurationMs: 800,
        outputTokens: 40,
        usagePartial: true,
        sessionRetention: { status: "archived" },
      });
      const reads = trace.slice(2, -1);
      expect(reads.length).toBeGreaterThan(1);
      expect(new Set(reads)).toEqual(
        new Set([`rollout/read ${join(home, "returned-rollout.jsonl")}`]),
      );
      expect(trace.at(-1)).toBe("thread/archive fixture-thread");
      expect(await readFile(join(home, "archived.jsonl"), "utf8")).toBe(
        started + tokens(40) + complete.slice(0, -3),
      );
    },
    ["--session-retention", "archive"],
  );
});

test("expires when the thread path stays unavailable", async () => {
  await runScenario(
    { jsonl: completeJsonl, pathAfterLookups: null, deadlineMs: 300 },
    ({ exitCode, report, trace }) => {
      expect(exitCode).toBe(1);
      expect(report.results[0]).toMatchObject({
        status: "completed",
        pathAtThreadStart: false,
        pathLookupAttempts: trace.length - 2,
        firstReadFoundTerminal: null,
        terminalEvent: null,
        firstTokenMs: null,
        durationMs: null,
        turnOutputTokensPerSecond: null,
        outputTokens: null,
        usagePartial: false,
      });
      expect(trace.length).toBeGreaterThan(3);
      expect(new Set(trace.slice(2))).toEqual(new Set(["thread/read fixture-thread"]));
    },
  );
});

test("closes interrupted usage at the matching turn_aborted and counts cumulative snapshots once", async () => {
  await runScenario(
    {
      jsonl:
        otherStarted +
        tokens(900) +
        otherComplete +
        started +
        tokens(30) +
        tokens(55) +
        tokens(55) +
        aborted +
        tokens(999),
      liveStatus: "interrupted",
      liveOutputTokens: 55,
    },
    ({ exitCode, report }) => {
      expect(exitCode).toBe(1);
      expect(report.results[0]).toMatchObject({
        status: "interrupted",
        firstReadFoundTerminal: true,
        terminalEvent: "turn_aborted",
        outputTokens: 55,
        usagePartial: true,
        outputMatchesLive: true,
        turnOutputTokensPerSecond: null,
      });
    },
  );
});

test.each([
  {
    label: "unclosed interrupted turn",
    jsonl: started + tokens(55) + otherComplete,
    outputTokens: 55,
  },
  {
    label: "later start",
    jsonl: started + tokens(55) + otherStarted + tokens(999) + complete,
    outputTokens: 55,
  },
  {
    label: "missing matching start",
    jsonl: otherStarted + tokens(999) + complete,
    outputTokens: null,
  },
])("limits partial usage attribution with $label", async ({ jsonl, outputTokens }) => {
  await runScenario(
    { jsonl, liveStatus: "interrupted", deadlineMs: 300 },
    ({ exitCode, report }) => {
      expect(exitCode).toBe(1);
      expect(report.results[0]).toMatchObject({
        status: "interrupted",
        terminalEvent: null,
        outputTokens,
        usagePartial: outputTokens !== null,
        firstTokenMs: null,
        durationMs: null,
        turnOutputTokensPerSecond: null,
      });
    },
  );
});

test("explicit keep leaves the trial rollout active without a retention request", async () => {
  await runScenario(
    { jsonl: completeJsonl },
    async ({ exitCode, report, trace, home }) => {
      expect(exitCode).toBe(0);
      expect(report.sessionRetention).toBe("keep");
      expect(report.results[0]).toMatchObject({ sessionRetention: { status: "kept" } });
      expect(trace.at(-1)).toBe(`rollout/read ${join(home, "returned-rollout.jsonl")}`);
      expect(await readFile(join(home, "returned-rollout.jsonl"), "utf8")).toBe(completeJsonl);
    },
    ["--session-retention", "keep"],
  );
});

test.each([
  { mode: "archive", status: "archived" },
  { mode: "delete", status: "deleted" },
])("applies explicit $mode only after recovering the terminal record", async ({ mode, status }) => {
  await runScenario(
    { jsonl: completeJsonl.slice(0, -3), finishAfterFirstRead: completeJsonl.slice(-3) },
    async ({ exitCode, report, trace, home }) => {
      expect(exitCode).toBe(0);
      expect(report.sessionRetention).toBe(mode);
      expect(report.results[0]).toMatchObject({
        status: "completed",
        firstReadFoundTerminal: false,
        terminalEvent: "task_complete",
        outputTokens: 80,
        turnOutputTokensPerSecond: 100,
        sessionRetention: { status },
      });
      const active = join(home, "returned-rollout.jsonl");
      expect(trace.slice(2)).toEqual([
        `rollout/read ${active}`,
        "rollout/write completed",
        `rollout/read ${active}`,
        `thread/${mode} fixture-thread`,
      ]);
      await expect(access(active)).rejects.toMatchObject({ code: "ENOENT" });
      if (mode === "archive") {
        expect(await readFile(join(home, "archived.jsonl"), "utf8")).toBe(completeJsonl);
      } else {
        await expect(access(join(home, "archived.jsonl"))).rejects.toMatchObject({
          code: "ENOENT",
        });
      }
    },
    ["--session-retention", mode],
  );
});

test.each(["archive", "delete"])("preserves the completed result if %s fails", async (mode) => {
  await runScenario(
    { jsonl: completeJsonl, retentionError: true },
    async ({ exitCode, report, trace, home }) => {
      expect(exitCode).toBe(1);
      expect(report.results[0]).toMatchObject({
        threadId: "fixture-thread",
        status: "completed",
        outputTokens: 80,
        turnOutputTokensPerSecond: 100,
        sessionRetention: {
          status: "failed",
          error: expect.stringContaining("fixture retention failed"),
        },
      });
      expect(trace.at(-1)).toBe(`thread/${mode} fixture-thread`);
      expect(await readFile(join(home, "returned-rollout.jsonl"), "utf8")).toBe(completeJsonl);
    },
    ["--session-retention", mode],
  );
});

test("skips deletion when the thread has no confirmed turn completion", async () => {
  await runScenario(
    { jsonl: "", turnStartError: true },
    async ({ exitCode, report, trace, home }) => {
      expect(exitCode).toBe(1);
      expect(report.results[0]).toMatchObject({
        threadId: "fixture-thread",
        status: "error",
        error: expect.stringContaining("fixture turn start failed"),
        sessionRetention: { status: "skipped" },
      });
      expect(trace).toEqual(["turn/start fixture-thread"]);
      await access(join(home, "returned-rollout.jsonl"));
    },
    ["--session-retention", "delete"],
  );
});
