import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { REPO_ROOT } from "../helpers/cli-test-utils";
import { buildNodeCaller, traceMethod } from "./fixtures/runner";
import { withShutdownFixture } from "./fixtures/shutdown";

const scenarios = ["before-completion", "after-completion", "withheld-start-reply"] as const;
const callers = [
  { label: "benchmark", entry: "src/bin.ts", args: ["codex-bench", "--json", "--runs", "1"] },
  {
    label: "live check",
    entry: "test/codex-benchmark/fixtures/runner-live-check.ts",
    args: ["--model", "model-a", "--effort", "low"],
  },
] as const;

for (const { label, entry, args } of callers) {
  test.skipIf(process.platform === "win32").each(scenarios)(
    `Node ${label} reports app-server exit %s with stdout held open`,
    async (scenario) => {
      const completed = scenario !== "before-completion";
      const withheld = scenario === "withheld-start-reply";
      await withShutdownFixture(
        {
          leaderExitDuringTurn: completed ? "after-completion" : "before-completion",
          resistantWorker: true,
          withholdStartReplyThread: withheld ? 1 : undefined,
          traceLifecycle: withheld,
        },
        async ({ home, options, start, trace }) => {
          const caller = await buildNodeCaller(join(REPO_ROOT, entry), options.cwd);
          const result = await start({
            executable: "node",
            args: [
              "--import",
              join(import.meta.dir, "fixtures/shutdown-signal.mjs"),
              caller,
              ...args,
              ...(withheld ? ["--session-retention", "archive"] : []),
            ],
            cwd: options.cwd,
            env: { ...options.env, FIXTURE_READ_TURN_AFTER_EXIT: completed ? "1" : "0" },
            timeoutMs: 5_000,
            graceMs: 600,
            cleanupMs: 1_500,
          }).completion;
          expect(result.reason).toBe("exit-failed");
          expect(result.exitCode, result.stderr).toBe(1);
          expect(result.issues).toEqual([]);
          expect(result.stderr).toMatch(/Transport failed: .*app-server stopped with exit code 17/);
          expect(result.stderr).not.toContain("Shutdown failed");
          if (completed) {
            expect(await readFile(join(home, "turn-read-exit-code"), "utf8")).toBe("17");
          }

          const report = JSON.parse(result.stdout);
          if (label === "benchmark") {
            expect(report.run).toMatchObject({
              transportError: expect.stringContaining("exit code 17"),
              shutdownError: null,
            });
            expect(report.trials).toMatchObject([
              completed
                ? { status: "completed", turnId: "turn-thread-1", turnDurationMs: 800 }
                : { status: "failed", error: expect.stringContaining("exit code 17") },
            ]);
          } else {
            expect(report.results).toMatchObject([
              completed
                ? { status: "completed", turnId: "turn-thread-1", durationMs: 800 }
                : { status: "error", error: expect.stringContaining("exit code 17") },
            ]);
          }
          const events = await trace();
          if (withheld) {
            expect((report.trials ?? report.results)[0].sessionRetention.status).toBe("skipped");
            expect(traceMethod(events, "fixture/turn-start-reply")).toHaveLength(0);
            expect(traceMethod(events, "turn/started")).toHaveLength(1);
            expect(traceMethod(events, "turn/completed")).toHaveLength(1);
            expect(traceMethod(events, "thread/archive")).toHaveLength(0);
          }
          expect(traceMethod(events, "thread/start")).toHaveLength(1);
          expect(traceMethod(events, "turn/start")).toHaveLength(1);
        },
      );
    },
    10_000,
  );
}
