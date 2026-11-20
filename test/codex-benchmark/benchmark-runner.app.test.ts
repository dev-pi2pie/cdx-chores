import { expect, test } from "bun:test";
import { access, appendFile, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { pathToFileURL } from "node:url";

import {
  isLiveProcess,
  requireProcessObservation,
} from "../../scripts/testing/execution/process-table.ts";
import { runCodexBenchmark } from "../../src/adapters/codex/benchmark";
import {
  startCliBenchmark,
  traceMethod,
  withRunnerFixture,
  withStderrTtyPreload,
  type BenchmarkProtocolEvent,
} from "./fixtures/runner";

const shortRolloutPreload = join(import.meta.dir, "fixtures/short-rollout-preload.mjs");

function startCliWithShortReadback(
  options: Parameters<typeof startCliBenchmark>[0],
  args: string[],
  thread: number,
  preload = shortRolloutPreload,
) {
  const env = { ...options.env, FIXTURE_SHORT_ROLLOUT_TURN: `turn-thread-${thread}` };
  return startCliBenchmark({ ...options, env }, args, preload);
}

test("reports the version using the supplied app-server environment", async () => {
  await withRunnerFixture({ appServerUserAgent: "codex/exec/0.171.0" }, async ({ options }) => {
    const env = { ...options.env, CODEX_INTERNAL_ORIGINATOR_OVERRIDE: "codex/exec" };
    const report = await runCodexBenchmark({ ...options, env });
    expect(report.startupError).toBeNull();
    expect(report.codexVersion).toBe("0.171.0");
  });
});

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

test.each([
  {
    message: "Service tier priority is not supported for this account.",
    status: "unavailable",
    exitCode: 0,
  },
  {
    message: "This account does not support the priority service tier.",
    status: "unavailable",
    exitCode: 0,
  },
  {
    message: "This account is not eligible for the priority service tier.",
    status: "unavailable",
    exitCode: 0,
  },
  {
    message: "Service tier 'priority' is not eligible for this account.",
    status: "unavailable",
    exitCode: 0,
  },
  {
    message: 'Unsupported parameter: "service_tier" is not supported with this model.',
    status: "unavailable",
    exitCode: 0,
  },
  {
    message: 'Unsupported parameter: "image_url" is not supported with this service tier.',
    status: "failed",
    exitCode: 1,
  },
  {
    message: "Invalid value for 'service_tier': priority.",
    status: "unavailable",
    exitCode: 0,
  },
  {
    message: "Image input is not eligible for this model at the priority service tier.",
    status: "failed",
    exitCode: 1,
  },
  {
    message: "This model does not support image input at the priority service tier.",
    status: "failed",
    exitCode: 1,
  },
  {
    message: "Image input is not supported by this model at the priority service tier.",
    status: "failed",
    exitCode: 1,
  },
])("CLI classifies the provider reply: $message", async ({ message, status, exitCode }) => {
  await withRunnerFixture({ rejectFast: message }, async ({ options }) => {
    const result = await startCliBenchmark(options, [
      "--json",
      "--show-token-usage",
      "--codex-speed",
      "fast",
      "--codex-speed",
      "standard",
    ]).completion;
    expect(result.exitCode).toBe(exitCode);
    expect(result.stderr).toContain(`${status} (inherited model/fast): ${message}`);
    const { run, trials } = JSON.parse(result.stdout);
    expect(run.completedMeasuredTrials).toBe(1);
    expect(trials[2]).toMatchObject({
      status,
      error: message,
      eligible: false,
      tokenUsage: { partial: true, counts: { outputTokens: 80 } },
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

async function waitForMethod(
  trace: () => Promise<BenchmarkProtocolEvent[]>,
  method: string,
): Promise<void> {
  const deadline = Date.now() + 4_000;
  while (Date.now() < deadline) {
    if (traceMethod(await trace(), method).length) return;
    await delay(20);
  }
  throw new Error(`The fixture did not receive ${method}.`);
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
    const started = await waitForMethod(trace, "turn/start").then(
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

test.skipIf(process.platform === "win32")(
  "shutdown stops a resistant worker after the app-server group leader exits",
  async () => {
    await withRunnerFixture({ resistantWorker: true }, async ({ home, options }) => {
      const report = await runCodexBenchmark(options);
      const worker = JSON.parse(await readFile(join(home, "worker.pid"), "utf8")) as {
        pid: number;
        groupId: number;
      };
      expect(worker.pid).toBeGreaterThan(1);
      const exists = () =>
        requireProcessObservation().some(
          (entry) =>
            entry.pid === worker.pid && entry.groupId === worker.groupId && isLiveProcess(entry),
        );
      try {
        expect(report.shutdownError).toBeNull();
        expect(exists()).toBe(false);
      } finally {
        if (exists()) process.kill(worker.pid, "SIGKILL");
      }
    });
  },
);

test.skipIf(process.platform === "win32")(
  "CLI preserves completed trials and reports an unconfirmed app-server shutdown",
  async () => {
    await withRunnerFixture({}, async ({ options, trace }) => {
      const preload = await withStderrTtyPreload(options.cwd);
      // Force the group-exit probe to see a live group while real shutdown signals still run.
      await appendFile(
        preload,
        "\nconst kill = process.kill; process.kill = (pid, signal) => " +
          "(pid < 0 && signal === 0 ? true : kill(pid, signal));",
      );
      const result = await startCliBenchmark(options, ["--json"], preload).completion;
      expect(result.stopped).toBe(true);
      expect(result.issues).toEqual([]);
      expect(result.exitCode).toBe(1);
      expect(JSON.parse(result.stdout).run.completedMeasuredTrials).toBe(1);
      expect(result.stderr).toContain("\r\x1b[2K\r\x1b[31mShutdown failed\x1b[39m:");
      expect(result.stderr).toContain("process group did not stop before its shutdown deadline");
      expect(traceMethod(await trace(), "turn/completed")).toHaveLength(2);
    });
  },
);

test.each(["thread/start", "turn/start"] as const)(
  "CLI records a sent tier only on turn requests when %s is rejected",
  async (method) => {
    await withRunnerFixture({ rejectStart: method }, async ({ options, trace }) => {
      const result = await startCliBenchmark(options, ["--json", "--codex-speed", "fast"])
        .completion;
      expect(result.exitCode).toBe(1);
      const { trials } = JSON.parse(result.stdout);
      const turnRequests = traceMethod(await trace(), "turn/start");
      const attempted = method === "turn/start";
      expect(turnRequests.map(({ params }) => params?.serviceTierForTurn)).toEqual(
        attempted ? ["priority"] : [],
      );
      expect(trials).toHaveLength(attempted ? 1 : 2);
      for (const trial of trials) {
        expect(trial).toMatchObject({
          status: "failed",
          inferenceAttempted: attempted,
          sentTier: attempted ? "priority" : null,
          error: expect.stringContaining(`fixture rejected ${method}`),
        });
      }
    });
  },
);

test("an ambiguous RPC error about the tier still fails after earlier measurements", async () => {
  await withRunnerFixture(
    {
      turnStartRefusal: {
        at: 3,
        error: {
          code: -32602,
          message: 'Unsupported parameter: "service_tier" is not supported with this model.',
        },
      },
    },
    async ({ options, trace }) => {
      const result = await startCliBenchmark({ ...options, runs: 3 }, [
        "--json",
        "--codex-speed",
        "standard",
        "--session-retention",
        "archive",
      ]).completion;
      expect(result.exitCode).toBe(1);
      const { trials, run } = JSON.parse(result.stdout);
      expect(run.completedMeasuredTrials).toBe(1);
      expect(trials).toMatchObject([
        { status: "completed" },
        { status: "completed" },
        {
          status: "failed",
          inferenceAttempted: true,
          sentTier: "default",
          turnId: null,
          sessionRetention: { status: "skipped" },
        },
      ]);
      const events = await trace();
      expect(traceMethod(events, "thread/start")).toHaveLength(3);
      expect(traceMethod(events, "turn/start")).toHaveLength(3);
      expect(traceMethod(events, "thread/archive").map(({ params }) => params?.threadId)).toEqual([
        "thread-1",
        "thread-2",
      ]);
    },
  );
});

test.each([1, 2])(
  "CLI reports transport loss during readback and keeps completed results with %i measured trials scheduled",
  async (runs) => {
    await withRunnerFixture({ exitDuringReadbackThread: 2 }, async ({ options, trace }) => {
      // Keep the default readback deadline in the control without a successor.
      const trial = { ...options, runs };
      const cli =
        runs === 1
          ? startCliBenchmark(trial, ["--json"])
          : startCliWithShortReadback(trial, ["--json"], 2);
      const result = await cli.completion;
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("Transport failed");
      const report = JSON.parse(result.stdout);
      expect(report.run).toMatchObject({
        interrupted: false,
        transportError: expect.stringContaining("17"),
        shutdownError: null,
        completedMeasuredTrials: 1,
      });
      expect(report.trials.map((trial: { status: string }) => trial.status)).toEqual([
        "completed",
        "completed",
      ]);
      expect(traceMethod(await trace(), "turn/start")).toHaveLength(2);
    });
  },
);

test("CLI reports stdout EOF during a turn while the app-server is still alive", async () => {
  await withRunnerFixture({ endStdoutDuringThread: 3 }, async ({ options, trace }) => {
    const result = await startCliWithShortReadback(
      { ...options, runs: 3 },
      ["--json", "--show-token-usage", "--session-retention", "archive"],
      3,
    ).completion;
    expect(result.reason).toBe("exit-failed");
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Transport failed");
    const report = JSON.parse(result.stdout);
    expect(report.run).toMatchObject({
      interrupted: false,
      transportError: expect.stringContaining("stdout ended"),
      shutdownError: null,
      completedMeasuredTrials: 1,
    });
    expect(report.trials).toMatchObject([
      { status: "completed", warmup: true },
      { status: "completed", warmup: false, turnDurationMs: 800 },
      {
        status: "failed",
        tokenUsage: { partial: true, counts: { totalTokens: 230 } },
        sessionRetention: { status: "skipped" },
      },
    ]);
    const events = await trace();
    expect(traceMethod(events, "stdout-ended")).toHaveLength(1);
    expect(traceMethod(events, "turn/start")).toHaveLength(3);
    expect(traceMethod(events, "turn/interrupt")).toHaveLength(0);
    expect(traceMethod(events, "thread/archive").map(({ params }) => params?.threadId)).toEqual([
      "thread-1",
      "thread-2",
    ]);
  });
}, 15_000);

test("CLI reports stdout EOF observed during final rollout readback", async () => {
  await withRunnerFixture({ endStdoutAfterThread: 2 }, async ({ home, options, trace }) => {
    const preload = join(import.meta.dir, "fixtures", "final-readback-eof-preload.mjs");
    const result = await startCliBenchmark(options, ["--json"], preload).completion;
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Transport failed");
    expect(JSON.parse(result.stdout)).toMatchObject({
      run: {
        interrupted: false,
        transportError: expect.stringContaining("stdout ended"),
        shutdownError: null,
        completedMeasuredTrials: 1,
      },
      trials: [
        { status: "completed", warmup: true },
        { status: "completed", warmup: false, turnDurationMs: 800 },
      ],
    });
    await access(join(home, "final-readback-after-eof"));
    expect((await trace()).at(-1)?.method).toBe("stdout-ended");
  });
});

test("CLI retains matching completions when turn/start replies are withheld", async () => {
  await withRunnerFixture({ withholdStartReply: true }, async ({ options, trace }) => {
    const result = await startCliBenchmark(options, [
      "--json",
      "--codex-speed",
      "standard",
      "--session-retention",
      "archive",
    ]).completion;
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    const report = JSON.parse(result.stdout);
    expect(report.run).toMatchObject({ interrupted: false, completedMeasuredTrials: 1 });
    expect(report.trials).toMatchObject(
      [true, false].map((warmup, index) => ({
        warmup,
        status: "completed",
        inferenceAttempted: true,
        sentTier: "default",
        threadId: `thread-${index + 1}`,
        turnId: `turn-thread-${index + 1}`,
        turnDurationMs: 800,
        eligible: !warmup,
        sessionRetention: { status: "archived" },
      })),
    );
    const events = await trace();
    expect(
      traceMethod(events, "turn/start").map(({ params }) => params?.serviceTierForTurn),
    ).toEqual(["default", "default"]);
    expect(traceMethod(events, "thread/archive").map(({ params }) => params?.threadId)).toEqual([
      "thread-1",
      "thread-2",
    ]);
  });
}, 15_000);

test.each(["thread", "turn"] as const)(
  "ignores completion with an unrelated %s ID while awaiting a start reply",
  async (mismatchedCompletion) => {
    await withRunnerFixture({ mismatchedCompletion }, async ({ options, trace }) => {
      const report = await runCodexBenchmark({
        ...options,
        sessionRetention: "archive",
        rollout: { deadlineMs: 100 },
      });
      expect(report.trials).toMatchObject([
        {
          status: "failed",
          turnId: "turn-thread-1",
          error: expect.stringContaining("fixture rejected"),
          sessionRetention: { status: "skipped" },
        },
      ]);
      const events = await trace();
      expect(traceMethod(events, "turn/start")).toHaveLength(1);
      expect(traceMethod(events, "turn/interrupt")).toHaveLength(0);
      expect(traceMethod(events, "thread/archive")).toHaveLength(0);
    });
  },
);

test("transport loss with an announced turn preserves its ID and stops scheduling", async () => {
  await withRunnerFixture(
    { withholdStartReplyThread: 1, endStdoutDuringThread: 1 },
    async ({ options, trace }) => {
      const report = await runCodexBenchmark({
        ...options,
        sessionRetention: "archive",
        rollout: { deadlineMs: 100 },
      });
      expect(report.transportError).toContain("stdout ended");
      expect(report.trials).toMatchObject([
        {
          threadId: "thread-1",
          turnId: "turn-thread-1",
          inferenceAttempted: true,
          status: "failed",
          error: expect.stringContaining("stdout ended"),
          sessionRetention: { status: "skipped" },
        },
      ]);
      const events = await trace();
      expect(traceMethod(events, "thread/start")).toHaveLength(1);
      expect(traceMethod(events, "turn/interrupt")).toHaveLength(0);
      expect(traceMethod(events, "thread/archive")).toHaveLength(0);
    },
  );
});

test("CLI returns a zero-trial JSON report when initialization is rejected", async () => {
  await withRunnerFixture({ initializeError: true }, async ({ options, trace }) => {
    const result = await startCliBenchmark(options, ["--json"]).completion;
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("fixture refused initialization");
    expect(JSON.parse(result.stdout)).toMatchObject({
      run: {
        interrupted: false,
        startupError: expect.stringContaining("fixture refused initialization"),
        completedMeasuredTrials: 0,
      },
      trials: [],
      summaries: [{ plannedMeasuredTrials: 1, measuredTrials: 0 }],
    });
    expect((await trace()).map(({ method }) => method)).toEqual(["initialize"]);
  });
});

test.skipIf(process.platform === "win32")(
  "CLI cancels promptly when turn/start never supplies an ID",
  async () => {
    await withRunnerFixture({ holdTurnStart: true }, async ({ options, trace }) => {
      const cli = startCliBenchmark(options, ["--json", "--session-retention", "archive"]);
      try {
        await waitForMethod(trace, "turn/start");
        const signalledAt = performance.now();
        cli.child.kill("SIGINT");
        const result = await cli.completion;
        // Allow scheduling and shutdown time beyond the one-second turn-ID grace.
        expect(performance.now() - signalledAt).toBeLessThan(3_000);
        expect(result.reason).toBe("exit-failed");
        expect(result.exitCode).toBe(130);
        expect(JSON.parse(result.stdout)).toMatchObject({
          run: { interrupted: true },
          trials: [
            {
              status: "cancelled",
              inferenceAttempted: true,
              threadId: "thread-1",
              turnId: null,
              sessionRetention: { status: "skipped" },
            },
          ],
        });
        expect((await trace()).map(({ method }) => method)).toEqual([
          "initialize",
          "initialized",
          "thread/start",
          "turn/start",
        ]);
      } finally {
        cli.shutdown();
        await cli.completion;
      }
    });
  },
  15_000,
);

test("interrupts the matching turn when its ID arrives just after cancellation", async () => {
  await withRunnerFixture(
    { holdTurnStart: true, withholdStartReply: true, interrupt: "confirmed" },
    async ({ options, home, trace }) => {
      const cancellation = new AbortController();
      const run = runCodexBenchmark({
        ...options,
        signal: cancellation.signal,
        sessionRetention: "archive",
      });
      try {
        await waitForMethod(trace, "turn/start");
      } finally {
        cancellation.abort();
        await writeFile(join(home, "release-turn-start"), "");
      }
      const result = await run;
      expect(result.interrupted).toBe(true);
      expect(result.trials).toMatchObject([
        { status: "cancelled", turnId: "turn-thread-1", sessionRetention: { status: "archived" } },
      ]);
      expect(traceMethod(await trace(), "turn/interrupt").map(({ params }) => params)).toEqual([
        { threadId: "thread-1", turnId: "turn-thread-1" },
      ]);
    },
  );
});

test.skipIf(process.platform === "win32")(
  "CLI returns an interrupted report on SIGINT during initialization",
  async () => {
    await withRunnerFixture({ stallInitialization: true }, async ({ home, options, trace }) => {
      const cli = startCliBenchmark(options, ["--json"]);
      try {
        await waitForMethod(trace, "initialize");
        cli.child.kill("SIGINT");
        const result = await cli.completion;
        expect(result.exitCode).toBe(130);
        expect(result.stderr).toBe("");
        expect(JSON.parse(result.stdout)).toMatchObject({
          run: { interrupted: true, transportError: null, shutdownError: null },
          trials: [],
        });
        expect((await trace()).map(({ method }) => method)).toEqual(["initialize"]);
        const pid = Number(await readFile(join(home, "initializing.pid"), "utf8"));
        expect(requireProcessObservation().some((p) => p.pid === pid && isLiveProcess(p))).toBe(
          false,
        );
      } finally {
        cli.shutdown();
        await cli.completion;
      }
    });
  },
);

test.each(["model/list", "config/read"] as const)(
  "CLI recovers the measured Fast trial after a transient %s failure",
  async (method) => {
    await withRunnerFixture({ rejectFirstLookup: method }, async ({ options, trace }) => {
      const result = await startCliBenchmark(options, [
        "--json",
        "--codex-speed",
        "fast",
        "--codex-speed",
        "standard",
      ]).completion;
      expect(result.exitCode).toBe(1);
      const { run, trials } = JSON.parse(result.stdout);
      expect(trials).toMatchObject([
        {
          warmup: true,
          requestedSpeed: "fast",
          status: "failed",
          error: expect.stringContaining(`temporary ${method} failure`),
          inferenceAttempted: false,
        },
        { warmup: true, requestedSpeed: "standard", status: "completed" },
        { warmup: false, requestedSpeed: "fast", status: "completed", sentTier: "priority" },
        { warmup: false, requestedSpeed: "standard", status: "completed" },
      ]);
      expect(run.completedMeasuredTrials).toBe(2);
      const events = await trace();
      expect(traceMethod(events, "model/list")).toHaveLength(method === "model/list" ? 2 : 1);
      expect(traceMethod(events, "config/read")).toHaveLength(method === "config/read" ? 2 : 1);
      expect(
        traceMethod(events, "turn/start").map(({ params }) => params?.serviceTierForTurn),
      ).toEqual(["default", "priority", "default"]);
    });
  },
);

test.each(["model-a", null])(
  "reuses successful tier discovery with configured model %s",
  async (configuredModel) => {
    await withRunnerFixture({ configuredModel }, async ({ options, trace }) => {
      const report = await runCodexBenchmark({ ...options, speeds: ["fast", "standard"] });
      expect(report.trials.map((trial) => trial.status)).toEqual(Array(4).fill("completed"));
      const events = await trace();
      expect(traceMethod(events, "model/list")).toHaveLength(1);
      expect(traceMethod(events, "config/read")).toHaveLength(1);
      expect(
        traceMethod(events, "turn/start").map(({ params }) => params?.serviceTierForTurn),
      ).toEqual(["priority", "default", "priority", "default"]);
    });
  },
);

test.skipIf(process.platform === "win32").each(["model/list", "config/read"] as const)(
  "CLI stops tier discovery on SIGINT during %s",
  async (method) => {
    await withRunnerFixture({ stallTierLookup: method }, async ({ options, trace }) => {
      const cli = startCliBenchmark(options, ["--json", "--codex-speed", "fast"]);
      try {
        await waitForMethod(trace, method);
        cli.child.kill("SIGINT");
        const result = await cli.completion;
        expect(result.exitCode).toBe(130);
        expect(JSON.parse(result.stdout)).toMatchObject({
          run: { interrupted: true, transportError: null, shutdownError: null },
          trials: [{ status: "cancelled", inferenceAttempted: false, threadId: null }],
        });
        const lookups = method === "config/read" ? ["model/list", "config/read"] : ["model/list"];
        expect((await trace()).map((event) => event.method)).toEqual([
          "initialize",
          "initialized",
          ...lookups,
        ]);
      } finally {
        cli.shutdown();
        await cli.completion;
      }
    });
  },
);

test.skipIf(process.platform === "win32")(
  "CLI cancels a pending thread start on SIGINT before inference",
  async () => {
    await withRunnerFixture({ withholdThreadStartReply: true }, async ({ options, trace }) => {
      const cli = startCliBenchmark(options, ["--json", "--session-retention", "archive"]);
      try {
        await waitForMethod(trace, "fixture/thread-created");
        cli.child.kill("SIGINT");
        const result = await cli.completion;
        expect(result.reason).toBe("exit-failed");
        expect(result.exitCode).toBe(130);
        expect(JSON.parse(result.stdout)).toMatchObject({
          run: { interrupted: true, transportError: null, shutdownError: null },
          trials: [
            {
              status: "cancelled",
              inferenceAttempted: false,
              threadId: null,
              sessionRetention: null,
            },
          ],
        });
        expect((await trace()).map(({ method }) => method)).toEqual([
          "initialize",
          "initialized",
          "thread/start",
          "fixture/thread-created",
        ]);
      } finally {
        cli.shutdown();
        await cli.completion;
      }
    });
  },
  15_000,
);

test.each(["confirmed", "unconfirmed"] as const)(
  "CLI fails a timed-out trial with %s interruption and recovers partial usage",
  async (interrupt) => {
    await withRunnerFixture(
      { waitForInterruptThread: 2, interrupt },
      async ({ options, trace }) => {
        const preload = join(options.cwd, "turn-deadline.mjs");
        await writeFile(
          preload,
          [
            "const timeout = AbortSignal.timeout.bind(AbortSignal);",
            "let turns = 0;",
            "AbortSignal.timeout = (ms) => timeout(ms === 120000 && ++turns === 2 ? 250 : ms);",
          ].join("\n"),
        );
        const result = await startCliBenchmark(
          { ...options, runs: 2 },
          ["--json", "--show-token-usage", "--session-retention", "archive"],
          preload,
        ).completion;
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toContain("timed out");
        const report = JSON.parse(result.stdout);
        const confirmed = interrupt === "confirmed";
        expect(report.run).toMatchObject({
          interrupted: false,
          completedMeasuredTrials: confirmed ? 1 : 0,
        });
        expect(report.trials[1]).toMatchObject({
          status: "failed",
          error: expect.stringContaining("timed out"),
          tokenUsage: { partial: true, counts: { totalTokens: 230 } },
          sessionRetention: { status: confirmed ? "archived" : "skipped" },
        });
        expect(report.trials).toHaveLength(confirmed ? 3 : 2);
        if (confirmed)
          expect(report.trials[2]).toMatchObject({ status: "completed", turnDurationMs: 800 });
        const events = await trace();
        expect(traceMethod(events, "turn/start")).toHaveLength(confirmed ? 3 : 2);
        expect(traceMethod(events, "thread/archive").map(({ params }) => params?.threadId)).toEqual(
          confirmed ? ["thread-1", "thread-2", "thread-3"] : ["thread-1"],
        );
        const interrupts = traceMethod(events, "turn/interrupt");
        expect(interrupts.map((event) => event.params?.threadId)).toEqual(["thread-2"]);
      },
    );
  },
  15_000,
);

test.each([null, "fixture interrupted the turn"])(
  "CLI fails a server-interrupted trial after a completed measurement (reason: %s)",
  async (message) => {
    await withRunnerFixture(
      { serverInterrupt: { thread: 3, message } },
      async ({ options, trace }) => {
        const result = await startCliBenchmark({ ...options, runs: 2 }, [
          "--json",
          "--show-token-usage",
        ]).completion;
        const reason = message ?? "Codex app-server interrupted the turn.";
        expect(result.exitCode).toBe(1);
        expect(result.stderr.trim()).toBe(`cancelled (inherited model/inherited speed): ${reason}`);
        expect(JSON.parse(result.stdout)).toMatchObject({
          run: {
            interrupted: false,
            completedMeasuredTrials: 1,
            transportError: null,
            shutdownError: null,
          },
          trials: [
            { status: "completed", warmup: true },
            { status: "completed", warmup: false, turnDurationMs: 800 },
            {
              status: "cancelled",
              warmup: false,
              eligible: false,
              error: reason,
              tokenUsage: { partial: true, counts: { totalTokens: 230 } },
            },
          ],
        });
        expect(traceMethod(await trace(), "turn/interrupt")).toHaveLength(0);
      },
    );
  },
);

test("CLI reports a failed turn, continues, and retains only confirmed trial threads", async () => {
  await withRunnerFixture({ failThread: 1 }, async ({ options, trace }) => {
    const preload = await withStderrTtyPreload(options.cwd);
    const result = await startCliBenchmark(
      options,
      ["--session-retention", "delete", "--no-color", "--show-token-usage"],
      preload,
    ).completion;
    expect(result.stopped).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain(
      "\r\x1b[2K\rWarm-up · model-a · Inherited · reported 230 tokens (partial)",
    );
    expect(result.stderr).toContain(
      "failed (inherited model/inherited speed): fixture inference failed",
    );
    expect(result.stdout).toContain("1/1 measured trials (1 warm-ups)");
    expect(result.stdout).toMatch(/Warm-up subtotal \(partial\) +150 +80 +230/u);
    expect(result.stdout).toMatch(/Measured subtotal +150 +80 +230/u);
    expect(result.stdout).toMatch(/Invocation total \(partial\) +300 +160 +460/u);
    const events = await trace();
    expect(traceMethod(events, "thread/delete").map((event) => event.params?.threadId)).toEqual([
      "thread-1",
      "thread-2",
    ]);
  });
});

for (const json of [false, true]) {
  test.skipIf(process.platform === "win32")(
    `foreground SIGINT interrupts exactly one active turn before archiving (${json ? "JSON" : "terminal"})`,
    async () => {
      await withRunnerFixture(
        { interrupt: "confirmed", withholdStartReply: true },
        async ({ options, trace }) => {
          const preload = await withStderrTtyPreload(options.cwd);
          const cli = startCliBenchmark(
            options,
            [
              "--session-retention",
              "archive",
              "--no-color",
              "--show-token-usage",
              ...(json ? ["--json"] : []),
            ],
            preload,
          );
          try {
            await waitForMethod(trace, "turn/start");
            expect(traceMethod(await trace(), "turn/start")).toHaveLength(1);
            if (!cli.child.pid) throw new Error("Expected an owned CLI process.");
            process.kill(-cli.child.pid, "SIGINT");
            const result = await cli.completion;
            expect(result.stopped).toBe(true);
            expect(result.issues).toEqual([]);
            expect(result.exitCode).toBe(130);
            expect(result.stderr).toContain("Waiting for text");
            if (json) {
              expect(result.stderr.endsWith("\r\x1b[2K\r")).toBe(true);
              const report = JSON.parse(result.stdout);
              expect(report.run.interrupted).toBe(true);
              expect(report.trials).toHaveLength(1);
              expect(report.trials[0]).toMatchObject({ status: "cancelled" });
              expect(report.tokenUsage).toMatchObject({
                partial: true,
                totals: { totalTokens: 230 },
              });
            } else {
              expect(result.stderr).toContain(
                "\r\x1b[2K\rWarm-up · model-a · Inherited · reported 230 tokens (partial)",
              );
              expect(result.stdout).toMatch(/Warm-up subtotal \(partial\) +150 +80 +230/u);
              expect(result.stdout).toMatch(/Measured subtotal +— +— +—/u);
              expect(result.stdout).toMatch(/Invocation total \(partial\) +150 +80 +230/u);
            }
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
}

test.skipIf(process.platform === "win32").each([
  { first: "SIGINT", second: "SIGTERM", exitCode: 130 },
  { first: "SIGTERM", second: "SIGINT", exitCode: 143 },
] as const)(
  "clears JSON progress and keeps the skipped-retention warning when $first cancels the active turn",
  async ({ first, second, exitCode }) => {
    await withRunnerFixture({ interrupt: "unconfirmed" }, async ({ options, trace }) => {
      const preload = await withStderrTtyPreload(options.cwd);
      await appendFile(
        preload,
        `\nimport ${JSON.stringify(pathToFileURL(shortRolloutPreload).href)};\n`,
      );
      const cli = startCliWithShortReadback(
        options,
        ["--json", "--session-retention", "archive"],
        1,
        preload,
      );
      try {
        await waitForMethod(trace, "turn/start");
        if (!cli.child.pid) throw new Error("Expected an owned CLI process.");
        process.kill(-cli.child.pid, first);
        await waitForMethod(trace, "turn/interrupt");
        expect(cli.child.kill(second)).toBe(true);
        const result = await cli.completion;
        expect(result.exitCode).toBe(exitCode);
        const cleared = result.stderr.lastIndexOf("\r\x1b[2K\r");
        const warning = "Session retention \x1b[33mskipped\x1b[39m (thread-1):";
        expect(cleared).toBeGreaterThan(-1);
        expect(result.stderr.indexOf(warning)).toBeGreaterThan(cleared);
        const report = JSON.parse(result.stdout);
        expect(report.run.interrupted).toBe(true);
        expect(report.trials).toHaveLength(1);
        expect(report.trials[0]).toMatchObject({
          status: "cancelled",
          sessionRetention: { status: "skipped" },
        });
        const events = await trace();
        expect(traceMethod(events, "turn/start")).toHaveLength(1);
        expect(traceMethod(events, "turn/interrupt")).toHaveLength(1);
        expect(traceMethod(events, "thread/archive")).toHaveLength(0);
      } finally {
        cli.shutdown();
        await cli.completion;
      }
    });
  },
);
