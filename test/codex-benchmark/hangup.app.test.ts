import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { pathToFileURL } from "node:url";
import {
  isLiveProcess,
  requireProcessObservation,
} from "../../scripts/testing/execution/process-table";
import { REPO_ROOT } from "../helpers/cli-test-utils";
import { buildNodeCaller, traceMethod } from "./fixtures/runner";
import {
  checkShutdownAtExit,
  readSpawnedLeader,
  signalCallerGroup,
  watchCallerExit,
  withShutdownFixture,
} from "./fixtures/shutdown";

for (const [name, entry, args] of [
  ["benchmark", "src/bin.ts", ["codex-bench", "--json", "--runs", "1"]],
  [
    "live check",
    "scripts/spikes/codex-benchmark-live-check.ts",
    ["--model", "model-a", "--effort", "low"],
  ],
] as const) {
  test.skipIf(process.platform === "win32").each(["default", "installed"] as const)(
    `built ${name} cleans up on group SIGHUP with %s handler`,
    async (handler) => {
      await withShutdownFixture(
        { stallInitialization: true, resistantLeader: true, resistantWorker: true },
        async ({ home, options, start, trace }) => {
          const bundle = await buildNodeCaller(join(REPO_ROOT, entry), options.cwd);
          const caller = start({
            executable: "node",
            args: [
              "--import",
              pathToFileURL(join(import.meta.dir, "fixtures/shutdown-signal.mjs")).href,
              bundle,
              ...args,
            ],
            cwd: options.cwd,
            env: {
              ...options.env,
              FIXTURE_CALLER_SIGNAL: handler === "installed" ? "SIGHUP" : undefined,
            },
            timeoutMs: 8_000,
            graceMs: 600,
            cleanupMs: 1_500,
          });
          const atExit = watchCallerExit(caller);
          const deadline = performance.now() + 4_000;
          while (!traceMethod(await trace(), "initialize").length) {
            if (performance.now() >= deadline) throw new Error("Caller did not initialize.");
            await delay(10);
          }
          const leader = await readSpawnedLeader(home);
          const worker = JSON.parse(await readFile(join(home, "worker.pid"), "utf8"));
          const live = requireProcessObservation().filter(isLiveProcess);
          expect(live).toContainEqual(
            expect.objectContaining({ pid: leader, parentPid: caller.child.pid, groupId: leader }),
          );
          expect(live).toContainEqual(
            expect.objectContaining({ pid: worker.pid, parentPid: leader, groupId: leader }),
          );
          const sentAt = signalCallerGroup(caller, "SIGHUP");
          const result = await caller.completion;
          const exit = atExit();
          expect({
            code: result.exitCode,
            signal: result.signal,
            liveMembers: exit.processes.filter((p) => p.groupId === leader && isLiveProcess(p))
              .length,
            methods: (await trace()).map((e) => e.method),
          }).toEqual({
            code: handler === "installed" ? 42 : null,
            signal: handler === "installed" ? null : "SIGHUP",
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
