import { expect, test } from "bun:test";
import { once } from "node:events";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import {
  requireProcessObservation,
  isLiveProcess,
} from "../../scripts/testing/execution/process-table";
import { startFixtureProcess } from "../../scripts/testing/fixtures/fixture-process";
import { REPO_ROOT } from "../helpers/cli-test-utils";
import { traceMethod, withRunnerFixture } from "./fixtures/runner";

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
          env: { ...options.env, FIXTURE_ESCALATION: escalation },
          cwd: options.cwd,
          timeoutMs: 6_000,
          graceMs: 600,
          cleanupMs: 1_500,
        });
        try {
          const observedExit = once(owned.child, "exit").then(() => ({
            at: Date.now(),
            processes: requireProcessObservation(),
          }));
          const [exit, result] = await Promise.all([observedExit, owned.completion]);
          const { pid: worker, groupId: leader } = JSON.parse(
            await readFile(join(home, "worker.pid"), "utf8"),
          );
          expect(leader).toBeGreaterThan(1);
          expect(worker).toBeGreaterThan(1);
          const members = exit.processes
            .filter((p) => p.groupId === leader && isLiveProcess(p))
            .map((p) => p.pid)
            .sort((a, b) => a - b);
          const signals = (await readFile(join(home, "signals.jsonl"), "utf8"))
            .trim()
            .split("\n")
            .map((line) => JSON.parse(line) as { pid: number; signal: string; at: number });
          const elapsed = exit.at - signals[0]!.at;
          expect(signals[0]).toMatchObject({ pid: -leader, signal: "SIGTERM" });
          expect(signals).toContainEqual(
            expect.objectContaining({ pid: -leader, signal: "SIGKILL" }),
          );
          expect(elapsed).toBeGreaterThanOrEqual(0);
          expect(elapsed).toBeLessThanOrEqual(3_000);
          expect(result.stopped).toBe(true);
          expect(result.issues).toEqual([]);
          expect(traceMethod(await trace(), "turn/completed")).toHaveLength(2);
          expect(members).toEqual(
            escalation === "allowed" ? [] : [leader, worker].sort((a, b) => a - b),
          );
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
          // Release even when the worker never produced its readiness receipt.
          await writeFile(join(home, "release-shutdown"), "");
          await owned.completion;
          const leader = Number(await readFile(join(home, "leader.pid"), "utf8"));
          expect(leader).toBeGreaterThan(1);
          const live = () =>
            requireProcessObservation().some((p) => p.groupId === leader && isLiveProcess(p));
          const deadline = performance.now() + 1_000;
          while (live() && performance.now() < deadline) await delay(20);
          expect(live()).toBe(false);
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
  { mode: "denied escalation", signal: null, escalation: "denied", exitCode: 1 },
] as const)(
  "live check verifies worker shutdown on $mode",
  async ({ signal, escalation, exitCode }) => {
    await withRunnerFixture(
      { resistantWorker: true, resistantLeader: true, stallInitialization: signal !== null },
      async ({ home, options, trace }) => {
        const owned = startFixtureProcess({
          executable: process.execPath,
          args: [
            "--preload",
            join(import.meta.dir, "fixtures/shutdown-signal.cjs"),
            join(REPO_ROOT, "scripts/spikes/codex-turn-lifecycle/live.ts"),
          ],
          env: { ...options.env, FIXTURE_ESCALATION: escalation },
          cwd: options.cwd,
          timeoutMs: 6_000,
          graceMs: 600,
          cleanupMs: 1_500,
        });
        const observeExit = once(owned.child, "exit").then(requireProcessObservation);
        const workerIdentity = async () =>
          JSON.parse(await readFile(join(home, "worker.pid"), "utf8")) as {
            pid: number;
            groupId: number;
          };
        try {
          if (signal) {
            const deadline = performance.now() + 2_000;
            while (!traceMethod(await trace(), "initialize").length) {
              if (performance.now() >= deadline) throw new Error("Fixture did not initialize.");
              await delay(20);
            }
            owned.child.kill(signal);
          }
          const [processes, result] = await Promise.all([observeExit, owned.completion]);
          const { pid: worker, groupId: leader } = await workerIdentity();
          expect(leader).toBeGreaterThan(1);
          expect(worker).toBeGreaterThan(1);
          const liveMembers = processes.filter((p) => p.groupId === leader && isLiveProcess(p));
          expect(liveMembers.map((p) => p.pid).sort((a, b) => a - b)).toEqual(
            escalation === "denied" ? [leader, worker].sort((a, b) => a - b) : [],
          );
          expect(result.issues).toEqual([]);
          expect(result.exitCode, result.stderr).toBe(exitCode);
          if (signal) {
            expect(traceMethod(await trace(), "turn/start")).toHaveLength(0);
          } else {
            expect(JSON.parse(result.stdout).results).toMatchObject([
              { status: "completed", requestedSpeed: "standard" },
              { status: "completed", requestedSpeed: "fast" },
            ]);
          }
          if (escalation === "denied") expect(result.stderr).toContain("Shutdown failed");
        } finally {
          await writeFile(join(home, "release-shutdown"), "");
          owned.shutdown();
          await Promise.allSettled([observeExit, owned.completion]);
          const identity = await workerIdentity().catch(() => undefined);
          if (identity) {
            const live = () =>
              requireProcessObservation().some(
                (p) => (p.pid === identity.pid || p.pid === identity.groupId) && isLiveProcess(p),
              );
            const deadline = performance.now() + 1_000;
            while (live() && performance.now() < deadline) await delay(20);
            expect(live()).toBe(false);
          }
        }
      },
    );
  },
  10_000,
);
