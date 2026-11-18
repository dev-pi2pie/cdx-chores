import { expect, test } from "bun:test";
import { access, appendFile, chmod, copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { startFixtureProcess } from "../../scripts/testing/fixtures/fixture-process.ts";
import { runCodexBenchmark, type BenchmarkOptions } from "../../src/adapters/codex/benchmark";
import { REPO_ROOT, withTempFixtureDir } from "../helpers/cli-test-utils";

interface Scenario {
  phase?: string | null;
  delayed?: boolean;
  fallback?: boolean;
  tool?: boolean;
  rerouted?: boolean;
  interrupt?: "confirmed" | "unconfirmed";
  withholdStartReply?: boolean;
  failFirst?: boolean;
  rejectFast?: boolean;
  retentionError?: boolean;
}

interface Event {
  method: string;
  params?: Record<string, unknown>;
}

function traceMethod(events: Event[], method: string) {
  return events.filter((event) => event.method === method);
}

async function withRunnerFixture<T>(
  scenario: Scenario,
  exercise: (fixture: {
    home: string;
    options: BenchmarkOptions;
    trace: () => Promise<Event[]>;
  }) => Promise<T>,
): Promise<T> {
  return withTempFixtureDir("codex-benchmark-runner", async (root) => {
    const home = join(root, "codex-home");
    const executable = join(root, "codex-fixture.cjs");
    const tracePath = join(home, "events.jsonl");
    await mkdir(home);
    await copyFile(
      join(REPO_ROOT, "test/codex-benchmark/fixtures/benchmark-app-server.cjs"),
      executable,
    );
    await chmod(executable, 0o755);
    await writeFile(join(home, "scenario.json"), JSON.stringify(scenario));
    await writeFile(join(home, "unrelated.jsonl"), "unrelated\n");
    const result = await exercise({
      home,
      options: {
        cwd: root,
        env: {
          PATH: process.env.PATH,
          HOME: root,
          CODEX_HOME: home,
          CDX_CHORES_CODEX_PATH: executable,
        },
        models: [],
        speeds: [],
        runs: 1,
        prompt: "fixture prompt",
      },
      trace: async () => {
        const text = await readFile(tracePath, "utf8").catch((error: NodeJS.ErrnoException) => {
          if (error.code === "ENOENT") return "";
          throw error;
        });
        return text
          .split("\n")
          .slice(0, -1)
          .map((line) => JSON.parse(line) as Event);
      },
    });
    expect(await readFile(join(home, "unrelated.jsonl"), "utf8")).toBe("unrelated\n");
    return result;
  });
}

test("rotates the starting speed by round on fresh persisted threads", async () => {
  await withRunnerFixture({ phase: "final_answer" }, async ({ home, options, trace }) => {
    const report = await runCodexBenchmark({
      ...options,
      models: ["model-a", "model-b"],
      speeds: ["standard", "fast"],
      provider: "requested-provider",
      reasoningEffort: "high",
      runs: 3,
    });
    expect(report.codexHome).toBe(home);
    expect(report.codexVersion).toBe("0.170.0");
    expect(report.trials.filter((trial) => trial.warmup)).toHaveLength(4);
    expect(report.trials.filter((trial) => trial.eligible)).toHaveLength(12);
    expect(new Set(report.trials.map((trial) => trial.threadId)).size).toBe(16);
    const events = await trace();
    expect(traceMethod(events, "model/list")[0]?.params?.modelProvider).toBe("requested-provider");
    expect(traceMethod(events, "thread/start").map((event) => event.params?.model)).toEqual(
      Array(4).fill(["model-a", "model-a", "model-b", "model-b"]).flat(),
    );
    expect(
      traceMethod(events, "thread/start").every(
        (event) => event.params?.modelProvider === "requested-provider",
      ),
    ).toBe(true);
    const starts = traceMethod(events, "turn/start");
    expect(starts.map((event) => event.params?.serviceTierForTurn)).toEqual([
      "default",
      "priority",
      "default",
      "priority",
      "default",
      "priority",
      "default",
      "priority",
      "priority",
      "default",
      "priority",
      "default",
      "default",
      "priority",
      "default",
      "priority",
    ]);
    expect(
      starts.every(
        (event) =>
          JSON.stringify(event.params?.input) ===
            JSON.stringify([{ type: "text", text: options.prompt, text_elements: [] }]) &&
          event.params?.effort === "high",
      ),
    ).toBe(true);
    expect(traceMethod(events, "thread/archive")).toHaveLength(0);
    expect(traceMethod(events, "thread/delete")).toHaveLength(0);
  });
});

test("skips a missing tier per model and continues supported combinations", async () => {
  await withRunnerFixture({}, async ({ options, trace }) => {
    const result = await runCodexBenchmark({
      ...options,
      models: ["model-a", "model-b"],
      speeds: ["fast", "ultrafast"],
    });
    const measured = result.trials.filter((trial) => !trial.warmup);
    expect(
      measured.map(({ model, requestedSpeed, status, sentTier }) => ({
        model,
        requestedSpeed,
        status,
        sentTier,
      })),
    ).toEqual([
      { model: "model-a", requestedSpeed: "fast", status: "completed", sentTier: "priority" },
      { model: "model-a", requestedSpeed: "ultrafast", status: "completed", sentTier: "ultrafast" },
      { model: "model-b", requestedSpeed: "fast", status: "completed", sentTier: "priority" },
      { model: "model-b", requestedSpeed: "ultrafast", status: "unavailable", sentTier: null },
    ]);
    expect(traceMethod(await trace(), "thread/start")).toHaveLength(6);
  });
});

test("preserves partial usage when a provider rejects an advertised speed", async () => {
  await withRunnerFixture({ rejectFast: true }, async ({ options }) => {
    const { trials } = await runCodexBenchmark({ ...options, speeds: ["fast", "standard"] });
    expect(trials[2]).toMatchObject({
      status: "unavailable",
      outputTokens: 80,
      usagePartial: true,
      eligible: false,
    });
    expect(trials[3]).toMatchObject({ status: "completed", sentTier: "default", eligible: true });
  });
});

test.each([
  { label: "commentary-only", scenario: { phase: "commentary" } },
  { label: "tool activity", scenario: { phase: "final_answer", tool: true } },
  { label: "model reroute", scenario: { phase: "final_answer", rerouted: true } },
])(
  "$label contributes completed outcomes and usage with no eligible samples",
  async ({ scenario }) => {
    await withRunnerFixture(scenario, async ({ options, trace }) => {
      const { trials } = await runCodexBenchmark(options);
      expect(trials[1]).toMatchObject({
        model: null,
        requestedSpeed: null,
        resolvedModel: "model-a",
        resolvedProvider: "fixture-provider",
        resolvedReasoningEffort: "medium",
        status: "completed",
        usage: {
          inputTokens: 150,
          outputTokens: 80,
          cachedInputTokens: 25,
          cacheWriteInputTokens: 18,
          reasoningOutputTokens: 20,
          totalTokens: 230,
        },
        eligible: false,
      });
      const events = await trace();
      expect(traceMethod(events, "thread/start")[0]?.params).not.toHaveProperty("model");
      expect(traceMethod(events, "thread/start")[0]?.params).not.toHaveProperty("modelProvider");
      expect(traceMethod(events, "turn/start")[0]?.params).not.toHaveProperty("serviceTierForTurn");
      expect(traceMethod(events, "turn/start")[0]?.params).not.toHaveProperty("effort");
    });
  },
);

test("looks up the same thread after completion, retries the rollout read, then archives", async () => {
  await withRunnerFixture({ delayed: true, fallback: true }, async ({ home, options, trace }) => {
    const readCounts = new Map<string, number>();
    const { trials } = await runCodexBenchmark({
      ...options,
      sessionRetention: "archive",
      rollout: {
        onRolloutRead: async (path) => {
          await access(path);
          const count = (readCounts.get(path) ?? 0) + 1;
          readCounts.set(path, count);
          if (count === 1) await appendFile(path, "\n");
        },
      },
    });
    expect(trials.every((trial) => trial.firstTokenMs === 200 && trial.durationMs === 800)).toBe(
      true,
    );
    expect([...readCounts.values()]).toEqual([2, 2]);
    const events = (await trace()).filter(({ method }) =>
      ["turn/completed", "thread/read", "thread/archive"].includes(method),
    );
    expect(events.map(({ method, params }) => [method, params?.threadId])).toEqual([
      ["turn/completed", "thread-1"],
      ["thread/read", "thread-1"],
      ["thread/read", "thread-1"],
      ["thread/archive", "thread-1"],
      ["turn/completed", "thread-2"],
      ["thread/read", "thread-2"],
      ["thread/read", "thread-2"],
      ["thread/archive", "thread-2"],
    ]);
    expect(await readFile(join(home, "thread-2.jsonl.archive"), "utf8")).toContain(
      '"type":"task_complete"',
    );
  });
});

test.each(["archive", "delete"] as const)(
  "preserves the completed trial and saved metrics when %s is rejected",
  async (sessionRetention) => {
    await withRunnerFixture({ retentionError: true }, async ({ options, trace }) => {
      const { trials } = await runCodexBenchmark({ ...options, sessionRetention });
      expect(trials[1]).toMatchObject({
        status: "completed",
        eligible: true,
        firstTokenMs: 200,
        durationMs: 800,
        outputTokens: 80,
        sessionRetention: { status: "failed", threadId: "thread-2" },
      });
      expect(traceMethod(await trace(), `thread/${sessionRetention}`)).toHaveLength(2);
    });
  },
);

async function waitForTurnStart(trace: () => Promise<Event[]>): Promise<void> {
  const deadline = Date.now() + 4_000;
  while (Date.now() < deadline) {
    if (traceMethod(await trace(), "turn/start").length) return;
    await delay(20);
  }
  throw new Error("The fixture did not start a turn.");
}

test("preserves partial usage and skips cleanup when interruption is unconfirmed", async () => {
  await withRunnerFixture({ interrupt: "unconfirmed" }, async ({ options, trace }) => {
    const cancellation = new AbortController();
    const run = runCodexBenchmark({
      ...options,
      signal: cancellation.signal,
      sessionRetention: "delete",
      rollout: { deadlineMs: 300 },
    });
    const started = await waitForTurnStart(trace).then(
      () => true,
      () => false,
    );
    cancellation.abort();
    const { trials, interrupted } = await run;
    expect(started).toBe(true);
    expect(interrupted).toBe(true);
    expect(trials).toHaveLength(1);
    expect(trials[0]).toMatchObject({
      status: "cancelled",
      eligible: false,
      firstTokenMs: null,
      durationMs: null,
      outputTokens: 80,
      usagePartial: true,
      sessionRetention: { status: "skipped", threadId: "thread-1" },
    });
    const events = await trace();
    expect(traceMethod(events, "turn/interrupt")[0]?.params).toEqual({
      threadId: "thread-1",
      turnId: "turn-thread-1",
    });
    expect(traceMethod(events, "thread/delete")).toHaveLength(0);
  });
});

function startCliBenchmark(options: BenchmarkOptions, args: string[]) {
  return startFixtureProcess({
    executable: process.execPath,
    args: [join(REPO_ROOT, "src/bin.ts"), "codex-bench", "--runs", "1", ...args],
    cwd: options.cwd,
    env: options.env ?? process.env,
    timeoutMs: 10_000,
    graceMs: 600,
    cleanupMs: 1_500,
  });
}

test("CLI reports a failed turn, continues, and retains only confirmed trial threads", async () => {
  await withRunnerFixture({ failFirst: true }, async ({ options, trace }) => {
    const result = await startCliBenchmark(options, ["--session-retention", "delete"]).completion;
    expect(result.stopped).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("fixture inference failed");
    expect(result.stdout).toContain("1/1 measured trials (1 warm-ups)");
    const events = await trace();
    expect(traceMethod(events, "thread/delete").map((event) => event.params?.threadId)).toEqual([
      "thread-1",
      "thread-2",
    ]);
  });
});

test.skipIf(process.platform === "win32")(
  "foreground SIGINT interrupts exactly one active turn before archiving",
  async () => {
    await withRunnerFixture(
      { interrupt: "confirmed", withholdStartReply: true },
      async ({ options, trace }) => {
        const cli = startCliBenchmark(options, ["--session-retention", "archive"]);
        try {
          await waitForTurnStart(trace);
          expect(traceMethod(await trace(), "turn/start")).toHaveLength(1);
          if (!cli.child.pid) throw new Error("Expected an owned CLI process.");
          process.kill(-cli.child.pid, "SIGINT");
          const result = await cli.completion;
          expect(result.stopped).toBe(true);
          expect(result.issues).toEqual([]);
          expect(result.exitCode).toBe(130);
          const events = await trace();
          expect(traceMethod(events, "turn/start")).toHaveLength(1);
          expect(events.slice(-3).map(({ method }) => method)).toEqual([
            "turn/interrupt",
            "turn/completed",
            "thread/archive",
          ]);
          expect(events.at(-1)?.params?.threadId).toBe("thread-1");
        } finally {
          cli.shutdown();
          await cli.completion;
        }
      },
    );
  },
);
