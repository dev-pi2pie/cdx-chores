import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { REPO_ROOT } from "../helpers/cli-test-utils";
import { buildNodeCaller, traceMethod } from "./fixtures/runner";
import { withShutdownFixture } from "./fixtures/shutdown";

const scenarios = [
  ["exit", "before-completion"],
  ["exit", "after-completion"],
  ["exit", "withheld-start-reply"],
  ["EOF", "before-completion"],
  ["EOF", "withheld-start-reply"],
] as const;
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
    `Node ${label} reports app-server %s %s`,
    async (transport, timing) => {
      const exited = transport === "exit";
      const completed = timing !== "before-completion";
      const withheld = !exited || timing === "withheld-start-reply";
      const readAfterExit = exited && completed;
      const diagnostic = exited
        ? "exit code 17"
        : label === "benchmark"
          ? "stdout ended"
          : "app-server stopped";
      await withShutdownFixture(
        {
          leaderExitDuringTurn: exited
            ? completed
              ? "after-completion"
              : "before-completion"
            : undefined,
          resistantWorker: exited,
          endStdoutDuringThread: !exited && !completed ? 1 : undefined,
          endStdoutAfterThread: !exited && completed ? 1 : undefined,
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
            env: { ...options.env, FIXTURE_READ_TURN_AFTER_EXIT: readAfterExit ? "1" : "0" },
            timeoutMs: 5_000,
            graceMs: 600,
            cleanupMs: 1_500,
          }).completion;
          expect(result.reason).toBe("exit-failed");
          expect(result.exitCode, result.stderr).toBe(1);
          expect(result.issues).toEqual([]);
          expect(result.stderr).toMatch(new RegExp(`Transport failed: .*${diagnostic}`));
          expect(result.stderr).not.toContain("Shutdown failed");
          if (readAfterExit) {
            expect(await readFile(join(home, "turn-read-exit-code"), "utf8")).toBe("17");
          }

          const report = JSON.parse(result.stdout);
          if (label === "benchmark") {
            expect(report.run).toMatchObject({
              transportError: expect.stringContaining(diagnostic),
              shutdownError: null,
            });
            expect(report.trials).toMatchObject([
              completed
                ? { status: "completed", turnId: "turn-thread-1", turnDurationMs: 800 }
                : { status: "failed", error: expect.stringContaining(diagnostic) },
            ]);
          } else {
            expect(report.results).toMatchObject([
              completed
                ? { status: "completed", turnId: "turn-thread-1", durationMs: 800 }
                : { status: "error", error: expect.stringContaining(diagnostic) },
            ]);
          }
          const events = await trace();
          if (!exited) expect(traceMethod(events, "stdout-ended")).toHaveLength(1);
          if (withheld) {
            expect((report.trials ?? report.results)[0].sessionRetention.status).toBe("skipped");
            expect(traceMethod(events, "fixture/turn-start-reply")).toHaveLength(0);
            expect(traceMethod(events, "turn/started")).toHaveLength(1);
            expect(traceMethod(events, "turn/completed")).toHaveLength(completed ? 1 : 0);
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
