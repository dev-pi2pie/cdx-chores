import { expect, test } from "bun:test";
import { join } from "node:path";
import { startCliBenchmark, traceMethod, withRunnerFixture } from "./fixtures/runner";

type Scenario = Parameters<typeof withRunnerFixture>[0];
const preload = join(import.meta.dir, "fixtures/turn-recovery-preload.mjs");

async function runRecovery(scenario: Scenario, late = false) {
  return withRunnerFixture({ ...scenario, traceLifecycle: true }, async ({ options, trace }) => {
    const result = await startCliBenchmark(
      { ...options, env: { ...options.env, FIXTURE_LATE_TURN: late ? "1" : "0" } },
      [
        "--case",
        "model-a=standard",
        "--case",
        "model-a=fast",
        "--session-retention",
        "archive",
        "--show-token-usage",
        "--json",
      ],
      preload,
    ).completion;
    expect(result.stopped).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.reason, result.stderr).toMatch(/^(completed|exit-failed)$/);
    const trials = JSON.parse(result.stdout).trials;
    const events = await trace();
    const turns = traceMethod(events, "turn/start").map(({ params }) => params?.serviceTierForTurn);
    const interrupts = traceMethod(events, "turn/interrupt").map(({ params }) => params);
    const archives = traceMethod(events, "thread/archive").map(({ params }) => params?.threadId);
    return {
      first: trials[0],
      turns,
      interrupts,
      archives,
      events,
      exit: result.exitCode,
      stderr: result.stderr,
    };
  });
}

test.each(["confirmed", "unconfirmed"] as const)(
  "benchmark start timeout with %s interruption",
  async (interrupt) => {
    const confirmed = interrupt === "confirmed";
    const { first, turns, interrupts, archives, events, exit } = await runRecovery({
      withholdStartReplyThread: 1,
      waitForInterruptThread: 1,
      interrupt,
    });
    expect(exit).toBe(1);
    expect(first).toMatchObject({
      status: "failed",
      threadId: "thread-1",
      turnId: "turn-thread-1",
      error: expect.stringContaining("turn/start: Codex app-server request timed out"),
      inferenceAttempted: true,
      sentTier: "default",
      tokenUsage: { partial: true, counts: { totalTokens: 230 } },
      sessionRetention: { status: confirmed ? "archived" : "skipped" },
    });
    expect(interrupts).toEqual([{ threadId: "thread-1", turnId: "turn-thread-1" }]);
    expect(traceMethod(events, "fixture/turn-interrupt-reply")).toHaveLength(1);
    if (confirmed) {
      expect(archives[0]).toBe("thread-1");
      expect(turns.slice(0, 2)).toEqual(["default", "priority"]);
      const methods = events.map(({ method }) => method);
      expect(methods.indexOf("turn/interrupt")).toBeLessThan(methods.indexOf("turn/completed"));
      expect(methods.indexOf("turn/completed")).toBeLessThan(methods.indexOf("thread/archive"));
      expect(methods.indexOf("thread/archive")).toBeLessThan(
        methods.indexOf("thread/start", methods.indexOf("thread/start") + 1),
      );
    } else {
      expect(archives).toEqual([]);
      expect(turns).toEqual(["default"]);
      expect(traceMethod(events, "thread/start")).toHaveLength(1);
      expect(traceMethod(events, "turn/completed")).toHaveLength(0);
    }
  },
);

test.each(["thread", "turn"] as const)(
  "benchmark ignores an unrelated %s terminal at start timeout",
  async (mismatchedCompletion) => {
    const { first, turns, archives, interrupts, events } = await runRecovery({
      withholdStartReply: true,
      mismatchedCompletion,
      interrupt: "unconfirmed",
    });
    expect(first).toMatchObject({ status: "failed", sessionRetention: { status: "skipped" } });
    expect(traceMethod(events, "turn/completed").map(({ params }) => params)).toEqual([
      {
        threadId: mismatchedCompletion === "thread" ? "other-thread" : "thread-1",
        turnId: mismatchedCompletion === "turn" ? "other-turn" : "turn-thread-1",
      },
    ]);
    expect(interrupts).toEqual([{ threadId: "thread-1", turnId: "turn-thread-1" }]);
    expect(turns).toEqual(["default"]);
    expect(archives).toEqual([]);
  },
);

test.each([false, true])(
  "benchmark stops after a no-ID timeout (late announcement: %s)",
  async (late) => {
    const { first, turns, interrupts, archives, events, exit, stderr } = await runRecovery(
      { omitTurnStart: true },
      late,
    );
    expect(exit).toBe(1);
    expect(first).toMatchObject({
      threadId: "thread-1",
      turnId: null,
      status: "failed",
      inferenceAttempted: true,
      sentTier: "default",
      error: expect.stringContaining("timed out"),
      sessionRetention: { status: "skipped" },
    });
    expect(turns).toEqual(["default"]);
    expect(interrupts).toEqual([]);
    expect(archives).toEqual([]);
    expect(traceMethod(events, "thread/start")).toHaveLength(1);
    expect(
      events
        .filter(({ method }) => ["fixture/announce-late-turn", "turn/started"].includes(method))
        .map(({ method, params }) => [method, params]),
    ).toEqual(
      late
        ? [
            ["fixture/announce-late-turn", { threadId: "thread-1" }],
            ["turn/started", { threadId: "thread-1", turnId: "turn-thread-1" }],
          ]
        : [],
    );
    if (late) expect(stderr).toContain("fixture received reply after late announcement");
  },
);
