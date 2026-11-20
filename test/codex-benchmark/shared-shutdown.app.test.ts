import { expect, test } from "bun:test";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import {
  isLiveProcess,
  observeProcessGroup,
  type ProcessMember,
  requireProcessObservation,
} from "../../scripts/testing/execution/process-table";
import type { OwnedProcess } from "../../scripts/testing/execution/process";
import { startFixtureProcess } from "../../scripts/testing/fixtures/fixture-process";
import { REPO_ROOT } from "../helpers/cli-test-utils";
import { traceMethod, withRunnerFixture } from "./fixtures/runner";

type CallerExit = { at: number; processes: ProcessMember[] };

function watchCallerExit({ child }: OwnedProcess) {
  let observed: CallerExit | undefined;
  let observationError: unknown;
  child.once("exit", () => {
    try {
      observed = { at: Date.now(), processes: requireProcessObservation() };
    } catch (error) {
      observationError = error;
    }
  });
  return () => {
    if (!observed) throw observationError ?? new Error("Fixture caller exit was not observed.");
    return observed;
  };
}

async function readLeader(home: string) {
  const leader = Number(await readFile(join(home, "leader.pid"), "utf8"));
  if (!Number.isSafeInteger(leader) || leader <= 1) {
    throw new Error("Missing valid fixture group leader.");
  }
  return leader;
}

async function readSpawnedLeader(home: string) {
  let receipt: string;
  try {
    receipt = await readFile(join(home, "app-server-spawn"), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
  if (receipt === "not-started") return undefined;
  const pid = Number(receipt);
  if (!Number.isSafeInteger(pid) || pid <= 1) {
    throw new Error("Incomplete fixture app-server spawn receipt.");
  }
  return pid;
}

async function checkShutdownAtExit(
  home: string,
  exit: CallerExit,
  escalation: "allowed" | "denied" | "undelivered",
) {
  const leader = await readLeader(home);
  expect(await readSpawnedLeader(home)).toBe(leader);
  const worker = JSON.parse(await readFile(join(home, "worker.pid"), "utf8")) as {
    pid: number;
    groupId: number;
  };
  expect(worker.groupId).toBe(leader);
  expect(Number.isSafeInteger(worker.pid)).toBe(true);
  expect(worker.pid).toBeGreaterThan(1);
  expect(worker.pid).not.toBe(leader);
  const members = exit.processes
    .filter((p) => p.groupId === leader && isLiveProcess(p))
    .map((p) => p.pid)
    .sort((a, b) => a - b);
  expect(members).toEqual(
    escalation === "allowed" ? [] : [leader, worker.pid].sort((a, b) => a - b),
  );
  const signals = (await readFile(join(home, "signals.jsonl"), "utf8"))
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as { pid: number; signal: string; at: number });
  expect(signals).toMatchObject([
    { pid: -leader, signal: "SIGTERM" },
    { pid: -leader, signal: "SIGKILL" },
  ]);
  expect(signals[1]!.at).toBeGreaterThanOrEqual(signals[0]!.at);
  expect(exit.at).toBeGreaterThanOrEqual(signals[1]!.at);
  expect(exit.at - signals[0]!.at).toBeLessThanOrEqual(3_000);
}

async function releaseShutdownFixture(home: string, caller: OwnedProcess) {
  try {
    await writeFile(join(home, "release-shutdown"), "");
  } finally {
    caller.shutdown();
    const result = await caller.completion;
    // Both fixture readiness receipts can be absent when an assertion fails.
    const leader = await readSpawnedLeader(home);
    if (leader !== undefined) {
      const deadline = performance.now() + 1_000;
      let remaining: ProcessMember[];
      do {
        remaining = (await observeProcessGroup(leader, deadline - performance.now())).filter(
          isLiveProcess,
        );
        if (remaining.length === 0) break;
        await delay(20);
      } while (performance.now() < deadline);
      expect(remaining).toEqual([]);
    }
    expect(result.stopped, result.issues.join("\n")).toBe(true);
  }
}

test.skipIf(process.platform === "win32").each(["allowed", "denied", "undelivered"] as const)(
  "built benchmark preserves both trials when escalation is %s",
  async (escalation) => {
    await withRunnerFixture(
      { resistantLeader: true, resistantWorker: true },
      async ({ home, options, trace }) => {
        const build = await Bun.build({
          entrypoints: [join(REPO_ROOT, "src/bin.ts")],
          target: "node",
          packages: "external",
        });
        expect(build.success).toBe(true);
        const cli = join(options.cwd, "bin.mjs");
        await Bun.write(cli, build.outputs[0]!);
        const owned = startFixtureProcess({
          executable: "node",
          args: [
            "--require",
            join(import.meta.dir, "fixtures/shutdown-signal.cjs"),
            cli,
            "codex-bench",
            "--json",
            "--runs",
            "1",
          ],
          env: { ...options.env, FIXTURE_ESCALATION: escalation, FIXTURE_RECORD_APP_SERVER: "1" },
          cwd: options.cwd,
          timeoutMs: 6_000,
          graceMs: 600,
          cleanupMs: 1_500,
        });
        const callerExit = watchCallerExit(owned);
        try {
          const result = await owned.completion;
          await checkShutdownAtExit(home, callerExit(), escalation);
          expect(result.stopped).toBe(true);
          expect(result.issues).toEqual([]);
          expect(traceMethod(await trace(), "turn/completed")).toHaveLength(2);
          expect(result.exitCode, result.stderr).toBe(escalation === "allowed" ? 0 : 1);
          const report = JSON.parse(result.stdout);
          expect(report.trials).toHaveLength(2);
          expect(report.trials).toMatchObject([
            { status: "completed", warmup: true, threadId: "thread-1" },
            { status: "completed", warmup: false, threadId: "thread-2" },
          ]);
          expect(report.run.shutdownError).toEqual(
            escalation === "allowed"
              ? null
              : expect.stringContaining(
                  escalation === "denied" ? "denied app-server SIGKILL" : "shutdown deadline",
                ),
          );
        } finally {
          await releaseShutdownFixture(home, owned);
        }
      },
    );
  },
  12_000,
);

test.skipIf(process.platform === "win32").each([
  { mode: "normal", signal: null, escalation: "allowed", exitCode: 0 },
  { mode: "SIGINT", signal: "SIGINT", escalation: "allowed", exitCode: 130 },
  { mode: "SIGTERM", signal: "SIGTERM", escalation: "allowed", exitCode: 143 },
  {
    mode: "denied escalation",
    signal: null,
    escalation: "denied",
    exitCode: 1,
    diagnostic: "denied app-server SIGKILL",
  },
  {
    mode: "undelivered escalation",
    signal: null,
    escalation: "undelivered",
    exitCode: 1,
    diagnostic: "shutdown deadline",
  },
] as const)(
  "live check verifies worker shutdown on $mode",
  async ({ signal, escalation, exitCode, diagnostic }) => {
    await withRunnerFixture(
      { resistantWorker: true, resistantLeader: true, stallInitialization: signal !== null },
      async ({ home, options, trace }) => {
        const owned = startFixtureProcess({
          executable: process.execPath,
          args: [
            "--preload",
            join(import.meta.dir, "fixtures/shutdown-signal.cjs"),
            join(import.meta.dir, "fixtures/runner-live-check.ts"),
            "--model",
            "model-a",
            "--effort",
            "low",
            "--session-retention",
            "archive",
          ],
          env: { ...options.env, FIXTURE_ESCALATION: escalation, FIXTURE_RECORD_APP_SERVER: "1" },
          cwd: options.cwd,
          timeoutMs: 6_000,
          graceMs: 600,
          cleanupMs: 1_500,
        });
        const callerExit = watchCallerExit(owned);
        try {
          if (signal) {
            const deadline = performance.now() + 2_000;
            while (!traceMethod(await trace(), "initialize").length) {
              if (performance.now() >= deadline) throw new Error("Fixture did not initialize.");
              await delay(20);
            }
            owned.child.kill(signal);
          }
          const result = await owned.completion;
          await checkShutdownAtExit(home, callerExit(), escalation);
          expect(result.stopped).toBe(true);
          expect(result.issues).toEqual([]);
          expect(result.reason).toBe(exitCode === 0 ? "completed" : "exit-failed");
          expect(result.signal).toBeNull();
          expect(result.exitCode, result.stderr).toBe(exitCode);
          const events = await trace();
          if (signal) {
            expect(traceMethod(events, "turn/start")).toHaveLength(0);
          } else {
            expect(traceMethod(events, "turn/completed").map(({ params }) => params)).toMatchObject(
              [
                { threadId: "thread-1", turnId: "turn-thread-1", status: "completed" },
                { threadId: "thread-2", turnId: "turn-thread-2", status: "completed" },
              ],
            );
            expect(JSON.parse(result.stdout).results).toMatchObject([
              {
                status: "completed",
                requestedSpeed: "standard",
                sentTier: "default",
                threadId: "thread-1",
                turnId: "turn-thread-1",
              },
              {
                status: "completed",
                requestedSpeed: "fast",
                sentTier: "priority",
                threadId: "thread-2",
                turnId: "turn-thread-2",
              },
            ]);
          }
          if (diagnostic) {
            expect(result.stderr).toContain("Shutdown failed");
            expect(result.stderr).toContain(diagnostic);
          }
        } finally {
          await releaseShutdownFixture(home, owned);
        }
      },
    );
  },
  10_000,
);
