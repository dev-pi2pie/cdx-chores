import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { startFixtureProcess } from "../../scripts/testing/fixtures/fixture-process";
import { startCliBenchmark, traceMethod, withRunnerFixture } from "./fixtures/runner";

type Scenario = Parameters<typeof withRunnerFixture>[0];
const preload = join(import.meta.dir, "fixtures/turn-recovery-preload.mjs");

type Caller = "benchmark" | "live check";

async function runRecovery(
  caller: Caller,
  scenario: Scenario,
  {
    late = false,
    originator,
    retention = "archive",
    cancel,
    gate,
    shortReadback = false,
  }: {
    late?: boolean;
    originator?: string;
    retention?: "archive" | "delete";
    cancel?: "SIGTERM";
    gate?:
      | "deadline"
      | "reply-conflict"
      | "readback-conflict"
      | "late-reply"
      | "start-deadline"
      | "start-deadline-race";
    shortReadback?: boolean;
  } = {},
) {
  return withRunnerFixture(
    { ...scenario, traceLifecycle: true },
    async ({ home, options, trace }) => {
      const env = {
        ...options.env,
        FIXTURE_LATE_TURN: late ? "1" : "0",
        FIXTURE_LIFECYCLE_GATE: gate ?? (cancel ? "cancel" : undefined),
        FIXTURE_SHORT_ROLLOUT_TURN:
          caller === "benchmark" && shortReadback ? "turn-thread-1" : undefined,
        CODEX_INTERNAL_ORIGINATOR_OVERRIDE: originator,
      };
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
                retention,
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
                join(import.meta.dir, "fixtures/runner-live-check.ts"),
                "--model",
                "model-a",
                "--effort",
                "low",
                "--session-retention",
                retention,
              ],
              env,
              cwd: options.cwd,
              timeoutMs: 10_000,
              graceMs: 600,
              cleanupMs: 1_500,
            });
      try {
        if (cancel) {
          const deadline = performance.now() + 2_000;
          const receipt =
            gate === "late-reply" ? "caller-reconciling-reply" : "caller-turn-observed";
          while (!existsSync(join(home, receipt))) {
            if (performance.now() >= deadline)
              throw new Error(`Missing caller receipt ${receipt}.`);
            await delay(10);
          }
          child.child.kill(cancel);
        }
      } catch (error) {
        child.shutdown();
        await child.completion;
        throw error;
      }
      const result = await child.completion;
      expect(result.stopped).toBe(true);
      expect(result.issues).toEqual([]);
      expect(result.reason, result.stderr).toMatch(/^(completed|exit-failed)$/);
      const report = JSON.parse(result.stdout);
      const trials = caller === "benchmark" ? report.trials : report.results;
      const events = await trace();
      const turns = traceMethod(events, "turn/start").map(
        ({ params }) => params?.serviceTierForTurn,
      );
      const interrupts = traceMethod(events, "turn/interrupt").map(({ params }) => params);
      const archives = traceMethod(events, "thread/archive").map(({ params }) => params?.threadId);
      return {
        codexVersion: caller === "benchmark" ? report.run.codexVersion : report.codexVersion,
        first: trials[0],
        trials,
        turns,
        interrupts,
        archives,
        events,
        exit: result.exitCode,
        stderr: result.stderr,
      };
    },
  );
}

test.concurrent.each([
  { interrupt: "confirmed", withholdInterruptReply: false },
  { interrupt: "confirmed", withholdInterruptReply: true },
  { interrupt: "unconfirmed", withholdInterruptReply: false },
] as const)(
  "benchmark start timeout with $interrupt interruption (withhold reply: $withholdInterruptReply)",
  async ({ interrupt, withholdInterruptReply }) => {
    const confirmed = interrupt === "confirmed";
    const { first, turns, interrupts, archives, events, exit } = await runRecovery(
      "benchmark",
      { withholdStartReplyThread: 1, waitForInterruptThread: 1, interrupt, withholdInterruptReply },
      { shortReadback: !confirmed },
    );
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
    expect(traceMethod(events, "fixture/turn-interrupt-reply")).toHaveLength(
      withholdInterruptReply ? 0 : 1,
    );
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
  test.each(["codex/exec", undefined])(
    "reports the version with originator override %j",
    async (originator) => {
      const { codexVersion, exit } = await runRecovery(
        caller,
        { appServerUserAgent: "codex/exec/0.171.0" },
        { originator },
      );
      expect(exit).toBe(0);
      expect(codexVersion).toBe(originator ? "0.171.0" : caller === "benchmark" ? null : undefined);
    },
  );

  test.each(["normal", "withheld"] as const)("recovers Standard with a %s reply", async (reply) => {
    const { first, trials, turns, events, archives, interrupts, exit } = await runRecovery(caller, {
      withholdStartReplyThread: reply === "withheld" ? 1 : undefined,
    });
    expect(exit).toBe(0);
    expect(first).toMatchObject({
      threadId: "thread-1",
      turnId: "turn-thread-1",
      status: "completed",
      sessionRetention: { status: "archived" },
    });
    if (caller === "benchmark") {
      for (const [trial, warmup] of [
        [first, true],
        [trials[2], false],
      ] as const) {
        expect(trial).toMatchObject({
          turnId: warmup ? "turn-thread-1" : "turn-thread-3",
          warmup,
          eligible: !warmup,
          codexFirstTokenMs: 200,
          turnDurationMs: 800,
          turnOutputTokensPerSecond: 100,
          tokenUsage: { counts: { totalTokens: 230 }, partial: false },
        });
      }
    }
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
  test.concurrent.each(["thread", "turn"] as const)(
    "ignores an unrelated %s terminal at start timeout",
    async (mismatchedCompletion) => {
      const { first, turns, archives, interrupts, events } = await runRecovery(
        caller,
        { withholdStartReply: true, mismatchedCompletion, interrupt: "unconfirmed" },
        { shortReadback: true },
      );
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

  test.concurrent.each(["withheld", "late"] as const)(
    "stops after a no-ID timeout with the announcement %s",
    async (announcement) => {
      const late = announcement === "late";
      const { first, turns, interrupts, archives, events, exit, stderr } = await runRecovery(
        caller,
        { omitTurnStart: true },
        { late },
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

test.each(["rejected", "disconnected"] as const)(
  "live check stops after an announced turn is %s",
  async (failure) => {
    const { first, turns, archives, interrupts, exit } = await runRecovery(
      "live check",
      failure === "rejected"
        ? { mismatchedCompletion: "turn" }
        : { withholdStartReplyThread: 1, endStdoutDuringThread: 1 },
    );
    expect(exit).toBe(1);
    expect(first).toMatchObject({
      turnId: "turn-thread-1",
      status: "error",
      error: expect.stringContaining(
        failure === "rejected" ? "fixture rejected turn/start" : "app-server stopped",
      ),
      sessionRetention: { status: "skipped" },
    });
    expect(turns).toEqual(["default"]);
    expect(archives).toEqual([]);
    expect(interrupts).toEqual([]);
  },
);

const tooLarge = {
  code: -32602,
  message: "Input exceeds the maximum length of 1048576 characters.",
  data: { input_error_code: "input_too_large" },
};

describe.each(["benchmark", "live check"] as const)("%s ownership and rejection", (caller) => {
  // Each row uses its own caller, fixture directory, trace and app-server.
  test.concurrent.each([
    { label: "structured refusal", error: tooLarge, continues: true },
    { label: "structured refusal with a late start", error: tooLarge, late: true },
    { label: "same code and message", error: { code: tooLarge.code, message: tooLarge.message } },
    { label: "typed refusal with a start", error: tooLarge, evidence: "started", known: true },
    { label: "typed refusal with a terminal only", error: tooLarge, evidence: "terminal" },
    {
      label: "typed refusal with a lifecycle pair",
      error: tooLarge,
      evidence: "pair",
      known: true,
    },
    {
      label: "typed refusal before terminal only",
      error: tooLarge,
      evidence: "terminal",
      errorFirst: true,
    },
    {
      label: "typed refusal before a lifecycle pair",
      error: tooLarge,
      evidence: "pair",
      known: true,
      errorFirst: true,
    },
    { label: "typed refusal with item evidence", error: tooLarge, evidence: "item" },
    {
      label: "typed refusal with an unrelated terminal",
      error: tooLarge,
      evidence: "other-thread",
      continues: true,
    },
  ] as const)("checks submission evidence for $label", async (row) => {
    const continues = "continues" in row;
    const { first, turns, events, interrupts, exit, stderr } = await runRecovery(
      caller,
      {
        omitTurnStart: "late" in row,
        turnStartRefusal: {
          at: 1,
          error: row.error,
          evidence: "evidence" in row ? row.evidence : undefined,
          errorFirst: "errorFirst" in row,
        },
      },
      { retention: "delete", late: "late" in row, shortReadback: "known" in row },
    );
    expect(exit).toBe(1);
    expect(first).toMatchObject({
      threadId: "thread-1",
      turnId: "known" in row ? "turn-thread-1" : null,
      status: caller === "benchmark" ? "failed" : "error",
      sentTier: "default",
      error: expect.stringContaining(row.error.message),
      sessionRetention: { status: "skipped" },
    });
    if (caller === "benchmark") expect(first.inferenceAttempted).toBe(true);
    expect(interrupts).toEqual([]);
    expect(traceMethod(events, "thread/archive")).toEqual([]);
    if ("late" in row) {
      expect(stderr).toContain("fixture received reply after late announcement");
      expect(traceMethod(events, "turn/started")).toMatchObject([
        { params: { threadId: "thread-1", turnId: "turn-thread-1" } },
      ]);
    }
    if ("errorFirst" in row) {
      const rejection = events.findIndex(({ method }) => method === "fixture/turn-start-error");
      expect(rejection).toBeGreaterThanOrEqual(0);
      expect(events.findIndex(({ method }) => method === "turn/completed")).toBeGreaterThan(
        rejection,
      );
    }
    const deleted = traceMethod(events, "thread/delete").map(({ params }) => params?.threadId);
    expect(deleted).not.toContain("thread-1");
    if (continues) {
      expect(turns.slice(0, 2)).toEqual(["default", "priority"]);
      expect(deleted[0]).toBe("thread-2");
      expect(traceMethod(events, "thread/start").length).toBeGreaterThan(1);
    } else {
      expect(turns).toEqual(["default"]);
      expect(deleted).toEqual([]);
      expect(traceMethod(events, "thread/start")).toHaveLength(1);
    }
  });

  test.concurrent.each([null, { thread: { id: " " } }])(
    "rejects malformed thread/start result %j before dispatch",
    async (result) => {
      const { first, turns, events, archives, exit } = await runRecovery(caller, {
        threadStartReply: { at: 1, result },
      });
      expect(exit).toBe(1);
      expect(first).toMatchObject({
        sentTier: null,
        error: expect.stringContaining("new thread ID"),
      });
      expect(first.threadId ?? null).toBeNull();
      if (caller === "benchmark") expect(first.inferenceAttempted).toBe(false);
      const requests = traceMethod(events, "turn/start");
      expect(requests[0]?.params?.threadId).toBe("thread-2");
      expect(turns[0]).toBe("priority");
      expect(archives).not.toContain("thread-1");
      expect(archives[0]).toBe("thread-2");
    },
  );

  test("never sends another turn or retention RPC for a reused thread ID", async () => {
    const { trials, events, archives, exit } = await runRecovery(caller, {
      threadStartReply: { at: 2, result: { thread: { id: "thread-1" } } },
    });
    expect(exit).toBe(1);
    expect(trials[0]).toMatchObject({
      threadId: "thread-1",
      status: "completed",
      sessionRetention: { status: "archived" },
    });
    expect(trials[1]).toMatchObject({
      requestedSpeed: "fast",
      sentTier: null,
      error: expect.stringContaining("new thread ID"),
    });
    expect(archives.filter((id) => id === "thread-1")).toHaveLength(1);
    expect(
      traceMethod(events, "turn/start").filter(({ params }) => params?.threadId === "thread-1"),
    ).toHaveLength(1);
  });

  test.each([
    { label: "malformed started reply", result: { turn: { id: 123 } }, error: "valid turn ID" },
    {
      label: "malformed reply after announcement",
      result: { turn: { id: "" } },
      announce: true,
      known: true,
      error: "valid turn ID",
    },
    {
      label: "conflicting IDs",
      result: { turn: { id: "other-turn" } },
      announce: true,
      complete: true,
      error: "conflicting turn IDs",
    },
  ])("stops after $label without using an invented turn ID", async (row) => {
    const { first, turns, events, archives, interrupts, exit } = await runRecovery(
      caller,
      {
        turnStartReply: {
          at: 1,
          result: row.result,
          announce: row.announce,
          complete: row.complete,
        },
      },
      { shortReadback: row.known },
    );
    expect(exit).toBe(1);
    expect(first).toMatchObject({
      turnId: row.known ? "turn-thread-1" : null,
      sentTier: "default",
      error: expect.stringContaining(row.error),
      sessionRetention: { status: "skipped" },
    });
    expect(turns).toEqual(["default"]);
    expect(archives).toEqual([]);
    expect(interrupts).toEqual([]);
    expect(traceMethod(events, "thread/start")).toHaveLength(1);
  });

  test.concurrent.each([
    "after-reply",
    "during-readback",
    "reply-during-readback",
    "reply-after-readback",
    "during-retention",
  ] as const)(
    "stops after conflicting start %s",
    async (conflictingStart) => {
      const gate = {
        "after-reply": { name: "reply-conflict", trace: "fixture/turn-start-reply" },
        "during-readback": { name: "readback-conflict", trace: "fixture/rollout-read" },
        "reply-during-readback": { name: "readback-conflict", trace: "fixture/rollout-read" },
        "reply-after-readback": { name: "late-reply", trace: "fixture/reconcile-start-reply" },
        "during-retention": { name: undefined, trace: "thread/archive" },
      } as const;
      const retained = conflictingStart === "during-retention";
      // A measured turn can already be eligible when the archive is sent.
      const measured = caller === "benchmark" && retained;
      const failedThread = measured ? 3 : 1;
      const threadId = `thread-${failedThread}`;
      const { trials, turns, events, archives, interrupts, exit } = await runRecovery(
        caller,
        { conflictingStart, retentionConflictThread: measured ? failedThread : undefined },
        { gate: gate[conflictingStart].name },
      );
      const trial = trials[failedThread - 1];
      expect(exit).toBe(1);
      expect(trials).toHaveLength(failedThread);
      expect(trial).toMatchObject({
        threadId,
        turnId: null,
        sentTier: "default",
        error: expect.stringContaining("conflicting turn IDs"),
        sessionRetention: { status: retained ? "archived" : "skipped" },
      });
      if (caller === "benchmark") {
        expect(trial).toMatchObject({
          warmup: !measured,
          status: "failed",
          eligible: false,
          codexFirstTokenMs: null,
          turnDurationMs: null,
          turnOutputTokensPerSecond: null,
          tokenUsage: {
            counts:
              conflictingStart === "after-reply"
                ? null
                : { inputTokens: 150, outputTokens: 80, totalTokens: 230 },
            partial: true,
          },
        });
      }
      const conflict = events.findIndex(
        ({ method, params }) =>
          params?.threadId === threadId &&
          method ===
            (conflictingStart.startsWith("reply-") ? "fixture/turn-start-reply" : "turn/started") &&
          params?.turnId === "conflicting-turn",
      );
      const beforeConflict = events.findIndex(
        ({ method, params }) =>
          method === gate[conflictingStart].trace &&
          (method.startsWith("fixture/rollout-")
            ? params?.turnId === `turn-${threadId}`
            : params?.threadId === threadId),
      );
      expect(beforeConflict).toBeGreaterThanOrEqual(0);
      expect(conflict).toBeGreaterThan(beforeConflict);
      expect(turns).toEqual(measured ? ["default", "priority", "default"] : ["default"]);
      const precedingArchives = measured ? ["thread-1", "thread-2"] : [];
      expect(archives).toEqual(retained ? [...precedingArchives, threadId] : []);
      expect(interrupts).toEqual([]);
      expect(traceMethod(events, "thread/start")).toHaveLength(failedThread);
    },
    15_000,
  );

  test("retains a live-completed turn after an unfinished rollout reaches its deadline", async () => {
    const { first, turns, events } = await runRecovery(
      caller,
      { unfinishedRolloutThread: 1 },
      { retention: "delete", gate: "deadline" },
    );
    expect(first).toMatchObject({
      status: "completed",
      [caller === "benchmark" ? "codexFirstTokenMs" : "firstTokenMs"]: null,
      sessionRetention: { status: "deleted" },
    });
    const terminal = events.findIndex(({ method }) => method === "turn/completed");
    const readback = events.findIndex(({ method }) => method === "fixture/rollout-read");
    const deadline = events.findIndex(({ method }) => method === "fixture/rollout-deadline");
    const retention = events.findIndex(({ method }) => method === "thread/delete");
    const successor = events.findIndex(
      ({ method, params }) => method === "turn/start" && params?.serviceTierForTurn === "priority",
    );
    expect(terminal).toBeGreaterThanOrEqual(0);
    expect(readback).toBeGreaterThan(terminal);
    expect(deadline).toBeGreaterThan(readback);
    expect(retention).toBeGreaterThan(deadline);
    expect(successor).toBeGreaterThan(retention);
    expect(turns.slice(0, 2)).toEqual(["default", "priority"]);
  });

  test.concurrent.each(["matching", "rejected", "withheld"] as const)(
    "reconciles a %s start reply before retention and successor dispatch",
    async (reply) => {
      const withheld = reply === "withheld";
      const { first, turns, events, archives, exit } = await runRecovery(
        caller,
        withheld
          ? { withholdStartReplyThread: 1 }
          : { conflictingStart: "reply-after-readback", lateStartReply: reply },
        { gate: withheld ? "start-deadline" : "late-reply" },
      );
      const replied = events.findIndex(
        ({ method, params }) =>
          method === (withheld ? "fixture/turn-start-deadline" : "fixture/turn-start-reply") &&
          params?.turnId === (reply === "rejected" ? "conflicting-turn" : "turn-thread-1"),
      );
      const readback = events.findIndex(
        ({ method }) => method === (withheld ? "fixture/rollout-read" : "fixture/rollout-finished"),
      );
      expect(readback).toBeGreaterThanOrEqual(0);
      expect(replied).toBeGreaterThan(readback);
      if (!withheld) {
        const reconciling = events.findIndex(
          ({ method, params }) =>
            method === "fixture/reconcile-start-reply" && params?.turnId === "turn-thread-1",
        );
        expect(reconciling).toBeGreaterThan(readback);
        expect(replied).toBeGreaterThan(reconciling);
      }
      if (reply === "rejected") {
        expect(exit).toBe(1);
        expect(first.error).toContain("fixture rejected the late reply");
        expect(first.sessionRetention.status).toBe("skipped");
        expect(archives).toEqual([]);
        expect(turns).toEqual(["default"]);
        return;
      }
      expect(exit).toBe(0);
      expect(first.status).toBe("completed");
      const archive = events.findIndex(({ method }) => method === "thread/archive");
      expect(archive).toBeGreaterThan(replied);
      const successor = events.findIndex(
        ({ method, params }) => method === "turn/start" && params?.threadId === "thread-2",
      );
      expect(successor).toBeGreaterThan(archive);
      expect(turns.slice(0, 2)).toEqual(["default", "priority"]);
    },
  );

  test("cancels after readback while the start reply is pending", async () => {
    const { first, turns, archives, interrupts, exit } = await runRecovery(
      caller,
      { withholdStartReplyThread: 1 },
      { cancel: "SIGTERM", gate: "late-reply" },
    );
    expect(exit).toBe(143);
    expect(first.sessionRetention.status).toBe("skipped");
    expect(archives).toEqual([]);
    expect(turns).toEqual(["default"]);
    expect(interrupts).toEqual([]);
  });

  test("cancels an unsettled turn without retaining it or starting its successor", async () => {
    const { first, turns, events, archives, interrupts, exit } = await runRecovery(
      caller,
      { waitForInterruptThread: 1, interrupt: "unconfirmed" },
      { cancel: "SIGTERM", shortReadback: true },
    );
    expect(exit).toBe(143);
    expect(first).toMatchObject({
      turnId: "turn-thread-1",
      sessionRetention: { status: "skipped" },
    });
    expect(turns).toEqual(["default"]);
    expect(archives).toEqual([]);
    expect(traceMethod(events, "thread/start")).toHaveLength(1);
    expect(interrupts).toEqual(
      caller === "benchmark" ? [{ threadId: "thread-1", turnId: "turn-thread-1" }] : [],
    );
  });
});

test.concurrent.each(["start", "completion"] as const)(
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

test("live check recovers when the start deadline races with matching completion", async () => {
  const { first, turns, events, archives, exit } = await runRecovery(
    "live check",
    { withholdStartReplyThread: 1 },
    { gate: "start-deadline-race" },
  );
  expect(exit).toBe(0);
  expect(first).toMatchObject({ status: "completed", turnId: "turn-thread-1" });
  expect(turns).toEqual(["default", "priority"]);
  expect(archives).toEqual(["thread-1", "thread-2"]);
  const terminal = events.findIndex(({ method }) => method === "turn/completed");
  const deadline = events.findIndex(({ method }) => method === "fixture/turn-start-deadline");
  const archive = events.findIndex(({ method }) => method === "thread/archive");
  expect(terminal).toBeGreaterThanOrEqual(0);
  expect(deadline).toBeGreaterThan(terminal);
  expect(archive).toBeGreaterThan(deadline);
});
