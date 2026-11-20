import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { startFixtureProcess } from "../../scripts/testing/fixtures/fixture-process";
import { REPO_ROOT } from "../helpers/cli-test-utils";
import { startCliBenchmark, traceMethod, withRunnerFixture } from "./fixtures/runner";

type Scenario = Parameters<typeof withRunnerFixture>[0];
const preload = join(import.meta.dir, "fixtures/turn-recovery-preload.mjs");

type Caller = "benchmark" | "live check";

async function runRecovery(caller: Caller, scenario: Scenario, late = false) {
  return withRunnerFixture({ ...scenario, traceLifecycle: true }, async ({ options, trace }) => {
    const env = { ...options.env, FIXTURE_LATE_TURN: late ? "1" : "0" };
    const child =
      caller === "benchmark"
        ? startCliBenchmark(
            { ...options, env },
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
          )
        : startFixtureProcess({
            executable: process.execPath,
            args: [
              "--preload",
              preload,
              join(REPO_ROOT, "scripts/spikes/codex-turn-lifecycle/live.ts"),
            ],
            env,
            cwd: options.cwd,
            timeoutMs: 10_000,
            graceMs: 600,
            cleanupMs: 1_500,
          });
    const result = await child.completion;
    expect(result.stopped).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.reason, result.stderr).toMatch(/^(completed|exit-failed)$/);
    const report = JSON.parse(result.stdout);
    const trials = caller === "benchmark" ? report.trials : report.results;
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
    const { first, turns, interrupts, archives, events, exit } = await runRecovery("benchmark", {
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

describe.each(["benchmark", "live check"] as const)("%s turn recovery", (caller) => {
  test.each(["normal", "withheld"] as const)("recovers Standard with a %s reply", async (reply) => {
    const { first, turns, events, archives, interrupts, exit } = await runRecovery(caller, {
      withholdStartReplyThread: reply === "withheld" ? 1 : undefined,
    });
    expect(exit).toBe(0);
    expect(first).toMatchObject({
      threadId: "thread-1",
      turnId: "turn-thread-1",
      status: "completed",
      sessionRetention: { status: "archived" },
    });
    const firstThread = events
      .filter(({ params }) => params?.threadId === "thread-1")
      .map(({ method }) => method);
    expect(firstThread.includes("fixture/turn-start-reply")).toBe(reply === "normal");
    expect(firstThread.indexOf("turn/completed")).toBeGreaterThan(
      firstThread.indexOf("turn/started"),
    );
    expect(firstThread.indexOf("thread/archive")).toBeGreaterThan(
      firstThread.indexOf("turn/completed"),
    );
    const archiveIndex = events.findIndex(({ method }) => method === "thread/archive");
    expect(archiveIndex).toBeLessThan(
      events.findIndex(
        ({ method, params }) =>
          method === "turn/start" && params?.serviceTierForTurn === "priority",
      ),
    );
    expect(archives[0]).toBe("thread-1");
    expect(turns.slice(0, 2)).toEqual(["default", "priority"]);
    expect(interrupts).toEqual([]);
  });
  test.each(["thread", "turn"] as const)(
    "ignores an unrelated %s terminal at start timeout",
    async (mismatchedCompletion) => {
      const { first, turns, archives, interrupts, events } = await runRecovery(caller, {
        withholdStartReply: true,
        mismatchedCompletion,
        interrupt: "unconfirmed",
      });
      expect(first).toMatchObject({
        status: caller === "benchmark" ? "failed" : "error",
        sessionRetention: { status: "skipped" },
      });
      expect(traceMethod(events, "turn/completed").map(({ params }) => params)).toEqual([
        {
          threadId: mismatchedCompletion === "thread" ? "other-thread" : "thread-1",
          turnId: mismatchedCompletion === "turn" ? "other-turn" : "turn-thread-1",
        },
      ]);
      expect(interrupts).toEqual(
        caller === "benchmark" ? [{ threadId: "thread-1", turnId: "turn-thread-1" }] : [],
      );
      expect(turns).toEqual(["default"]);
      expect(archives).toEqual([]);
    },
  );

  test.each(["withheld", "late"] as const)(
    "stops after a no-ID timeout with the announcement %s",
    async (announcement) => {
      const late = announcement === "late";
      const { first, turns, interrupts, archives, events, exit, stderr } = await runRecovery(
        caller,
        { omitTurnStart: true },
        late,
      );
      expect(exit).toBe(1);
      expect(first).toMatchObject({
        threadId: "thread-1",
        turnId: null,
        status: caller === "benchmark" ? "failed" : "error",
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
      if (caller === "benchmark") expect(first.inferenceAttempted).toBe(true);
      if (late) expect(stderr).toContain("fixture received reply after late announcement");
    },
  );
});

test.each(["start", "completion"] as const)(
  "live check stops Standard at the %s deadline",
  async (deadline) => {
    const { first, turns, events, archives, interrupts, exit } = await runRecovery("live check", {
      withholdStartReplyThread: deadline === "start" ? 1 : undefined,
      waitForInterruptThread: 1,
    });
    expect(exit).toBe(1);
    expect(first).toMatchObject({
      threadId: "thread-1",
      turnId: "turn-thread-1",
      status: "error",
      error: expect.stringContaining(
        deadline === "start" ? "turn/start timed out" : "Turn completion timed out",
      ),
      sessionRetention: { status: "skipped" },
    });
    expect(traceMethod(events, "thread/start")).toHaveLength(1);
    expect(turns).toEqual(["default"]);
    expect(archives).toEqual([]);
    expect(interrupts).toEqual([]);
  },
);
