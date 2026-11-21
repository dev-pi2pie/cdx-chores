import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { pathToFileURL } from "node:url";
import {
  isLiveProcess,
  requireProcessObservation,
} from "../../scripts/testing/execution/process-table";
import { REPO_ROOT } from "../helpers/cli-test-utils";
import { buildNodeCaller, traceMethod, type RunnerFixture } from "./fixtures/runner";
import {
  checkShutdownAtExit,
  readSpawnedLeader,
  signalCallerGroup,
  watchCallerExit,
  withShutdownFixture,
} from "./fixtures/shutdown";

const preload = pathToFileURL(join(import.meta.dir, "fixtures/shutdown-signal.mjs")).href;

async function waitUntil(ready: () => boolean | Promise<boolean>, message: string) {
  const deadline = performance.now() + 4_000;
  while (!(await ready())) {
    if (performance.now() >= deadline) throw new Error(message);
    await delay(10);
  }
}

async function readyGroup(
  home: string,
  trace: RunnerFixture["trace"],
  callerPid: number | undefined,
) {
  await waitUntil(
    async () => traceMethod(await trace(), "initialize").length > 0,
    "Caller did not initialize.",
  );
  const leader = await readSpawnedLeader(home);
  const worker = JSON.parse(await readFile(join(home, "worker.pid"), "utf8"));
  const live = requireProcessObservation().filter(isLiveProcess);
  expect(live).toContainEqual(
    expect.objectContaining({ pid: leader, parentPid: callerPid, groupId: leader }),
  );
  expect(live).toContainEqual(
    expect.objectContaining({ pid: worker.pid, parentPid: leader, groupId: leader }),
  );
  return leader;
}

for (const [name, entry, args] of [
  ["benchmark", "src/bin.ts", ["codex-bench", "--json", "--runs", "1"]],
  [
    "live check",
    "scripts/spikes/codex-benchmark-live-check.ts",
    ["--model", "model-a", "--effort", "low"],
  ],
] as const) {
  test.skipIf(process.platform === "win32").concurrent.each([
    { label: "default HUP", first: "SIGHUP", next: null, handler: false, code: null },
    { label: "installed HUP", first: "SIGHUP", next: null, handler: true, code: 42 },
    { label: "installed HUP then TERM", first: "SIGHUP", next: "SIGTERM", handler: true, code: 42 },
    { label: "TERM then default HUP", first: "SIGTERM", next: "SIGHUP", handler: false, code: 143 },
    {
      label: "default HUP after normal close",
      first: "SIGHUP",
      next: null,
      handler: false,
      code: null,
      idle: true,
    },
  ] as const)(
    `built ${name} preserves $label`,
    async (scenario) => {
      const idle = "idle" in scenario;
      await withShutdownFixture(
        { stallInitialization: !idle, resistantLeader: !idle, resistantWorker: true },
        async ({ home, options, start, trace }) => {
          const bundle = await buildNodeCaller(join(REPO_ROOT, entry), options.cwd);
          const caller = start({
            executable: "node",
            args: ["--import", preload, bundle, ...args],
            cwd: options.cwd,
            env: {
              ...options.env,
              FIXTURE_CALLER_SIGNAL: scenario.handler ? "SIGHUP" : undefined,
              FIXTURE_HOLD_AFTER_CLOSE: idle ? "1" : undefined,
            },
            timeoutMs: 8_000,
            graceMs: 600,
            cleanupMs: 1_500,
          });
          const atExit = watchCallerExit(caller);
          if (idle) {
            const marker = join(home, "caller-idle");
            await waitUntil(() => existsSync(marker), "Caller did not reach idle.");
            expect(JSON.parse(await readFile(marker, "utf8"))).toEqual({ before: 0, after: 0 });
            signalCallerGroup(caller, "SIGHUP");
            const result = await caller.completion;
            expect(result.signal).toBe("SIGHUP");
            expect(result.issues).toEqual([]);
            await checkShutdownAtExit(home, atExit(), "allowed");
            return;
          }
          const leader = await readyGroup(home, trace, caller.child.pid);
          const sentAt = signalCallerGroup(caller, scenario.first);
          if (scenario.next) {
            await waitUntil(
              () => existsSync(join(home, "signals.jsonl")),
              "Caller did not start cleanup.",
            );
            signalCallerGroup(caller, scenario.next);
          }
          const result = await caller.completion;
          const exit = atExit();
          expect({
            code: result.exitCode,
            signal: result.signal,
            liveMembers: exit.processes.filter((p) => p.groupId === leader && isLiveProcess(p))
              .length,
            methods: (await trace()).map((e) => e.method),
          }).toEqual({
            code: scenario.code,
            signal: scenario.code === null ? "SIGHUP" : null,
            liveMembers: 0,
            methods: ["initialize"],
          });
          expect(result.stopped).toBe(true);
          expect(result.issues).toEqual([]);
          expect(exit.at - sentAt).toBeLessThan(2_500);
          await checkShutdownAtExit(home, exit, "allowed", sentAt);
        },
      );
    },
    15_000,
  );
}

test.skipIf(process.platform === "win32")(
  "default TERM closes concurrent benchmark and doctor groups",
  async () => {
    const stalled = { stallInitialization: true, resistantLeader: true, resistantWorker: true };
    await withShutdownFixture(stalled, (doctor) =>
      withShutdownFixture(
        stalled,
        async (bench) => {
          const bundle = await buildNodeCaller(
            join(import.meta.dir, "fixtures/concurrent-signal-owners.ts"),
            bench.options.cwd,
          );
          const caller = bench.start({
            executable: "node",
            args: ["--import", preload, bundle],
            cwd: bench.options.cwd,
            env: {
              ...bench.options.env,
              FIXTURE_SECOND_HOME: doctor.home,
              FIXTURE_SECOND_EXECUTABLE: doctor.options.env?.CDX_CHORES_CODEX_PATH,
            },
            timeoutMs: 8_000,
            graceMs: 600,
            cleanupMs: 1_500,
          });
          const atExit = watchCallerExit(caller);
          const groups = await Promise.all(
            [bench, doctor].map(({ home, trace }) => readyGroup(home, trace, caller.child.pid)),
          );
          expect(groups[0]).not.toBe(groups[1]);
          const sentAt = signalCallerGroup(caller, "SIGTERM");
          const result = await caller.completion;
          expect(result.signal).toBe("SIGTERM");
          expect(result.issues).toEqual([]);
          for (const { home, trace } of [bench, doctor]) {
            await checkShutdownAtExit(home, atExit(), "allowed", sentAt);
            expect((await trace()).map((e) => e.method)).toEqual(["initialize"]);
          }
        },
        undefined,
        doctor.start,
      ),
    );
  },
  15_000,
);
