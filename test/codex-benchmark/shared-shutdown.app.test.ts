import { expect, test } from "bun:test";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { pathToFileURL } from "node:url";
import { REPO_ROOT } from "../helpers/cli-test-utils";
import { traceMethod } from "./fixtures/runner";
import {
  checkShutdownAtExit,
  watchCallerExit,
  startShutdownLiveCheck,
  withShutdownFixture,
} from "./fixtures/shutdown";

test.skipIf(process.platform === "win32").each(["allowed", "denied", "undelivered"] as const)(
  "built benchmark preserves both trials when escalation is %s",
  async (escalation) => {
    await withShutdownFixture(
      { resistantLeader: true, resistantWorker: true },
      async ({ home, options, trace, start }) => {
        const build = await Bun.build({
          entrypoints: [join(REPO_ROOT, "src/bin.ts")],
          target: "node",
          packages: "external",
        });
        expect(build.success).toBe(true);
        const cli = join(options.cwd, "bin.mjs");
        await Bun.write(cli, build.outputs[0]!);
        const owned = start({
          executable: "node",
          args: [
            "--import",
            pathToFileURL(join(import.meta.dir, "fixtures/shutdown-signal.mjs")).href,
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
        const callerExit = watchCallerExit(owned);
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
    await withShutdownFixture(
      { resistantWorker: true, resistantLeader: true, stallInitialization: signal !== null },
      async (fixture) => {
        const { home, trace } = fixture;
        const owned = startShutdownLiveCheck(fixture, escalation);
        const callerExit = watchCallerExit(owned);
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
          expect(traceMethod(events, "turn/completed").map(({ params }) => params)).toMatchObject([
            { threadId: "thread-1", turnId: "turn-thread-1", status: "completed" },
            { threadId: "thread-2", turnId: "turn-thread-2", status: "completed" },
          ]);
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
      },
    );
  },
  10_000,
);
