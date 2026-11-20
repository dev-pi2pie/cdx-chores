import { describe, expect, test } from "bun:test";
import { access } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { startFixtureProcess } from "../../scripts/testing/fixtures/fixture-process";
import { REPO_ROOT } from "../helpers/cli-test-utils";
import { traceMethod, withRunnerFixture } from "./fixtures/runner";

const cases = [
  {
    mode: "thread-rejected",
    error: "fixture rejected thread/start",
    continues: true,
    total: 460,
  },
  { mode: "refused", error: "fixture refused local write", continues: true, total: 460 },
  {
    mode: "refused",
    retention: "delete",
    error: "fixture refused local write",
    continues: true,
    total: 460,
  },
  { mode: "ended", error: "app-server stdin is not writable", total: 230, transport: true },
  { mode: "peer-closed", error: "EPIPE", total: 230, transport: true },
  {
    mode: "rejected",
    error: "fixture rejected turn/start",
    attempted: true,
    total: 230,
    partial: true,
  },
  { mode: "backpressure", attempted: true, completed: true, continues: true, total: 690 },
  { mode: "later-loss", attempted: true, transport: true, total: 460, partial: true },
  {
    mode: "loss-after-completion",
    attempted: true,
    completed: true,
    transport: true,
    retention: "keep",
    total: 460,
  },
];

async function buildNodeCaller(entry: string, cwd: string) {
  const build = await Bun.build({ entrypoints: [entry], packages: "external", target: "node" });
  expect(build.success).toBe(true);
  const executable = join(cwd, "caller.mjs");
  await Bun.write(executable, build.outputs[0]!);
  return executable;
}

for (const caller of ["benchmark", "live check on Node", "live check on Bun"] as const) {
  const benchmark = caller === "benchmark";
  const onBun = caller === "live check on Bun";
  const fault = benchmark ? 2 : 1;
  describe(caller, () => {
    for (const scenario of cases) {
      const { mode, continues, attempted, completed, transport, error } = scenario;
      const retention = scenario.retention ?? "archive";
      const writePreload = ["refused", "ended", "peer-closed", "backpressure"].includes(mode);
      if (onBun && writePreload) continue;
      const preloadName = writePreload
        ? "turn-write-preload.mjs"
        : mode === "loss-after-completion"
          ? "final-readback-eof-preload.mjs"
          : undefined;
      const preload = preloadName && join(import.meta.dir, "fixtures", preloadName);
      const preloadArgs = preload
        ? [onBun ? "--preload" : "--import", onBun ? preload : pathToFileURL(preload).href]
        : [];
      test.skipIf(mode === "peer-closed" && process.platform === "win32")(
        `${mode} write with ${retention} requested`,
        async () => {
          await withRunnerFixture(
            {
              rejectThreadStartAt: mode === "thread-rejected" ? fault : undefined,
              rejectTurnStartThread: mode === "rejected" ? fault : undefined,
              closeStdinOnThreadStart: mode === "peer-closed" ? fault : undefined,
              endStdoutDuringThread: mode === "later-loss" ? fault : undefined,
              endStdoutAfterThread: mode === "loss-after-completion" ? fault : undefined,
            },
            async ({ home, options, trace }) => {
              const entry = join(
                REPO_ROOT,
                benchmark ? "src/bin.ts" : "test/codex-benchmark/fixtures/runner-live-check.ts",
              );
              const script = onBun ? entry : await buildNodeCaller(entry, options.cwd);
              const args = benchmark
                ? [
                    "codex-bench",
                    "--runs",
                    "2",
                    "--codex-speed",
                    "standard",
                    "--json",
                    "--show-token-usage",
                  ]
                : ["--model", "model-a", "--effort", "low"];
              const result = await startFixtureProcess({
                executable: onBun ? process.execPath : "node",
                args: [...preloadArgs, script, ...args, "--session-retention", retention],
                env: {
                  ...options.env,
                  FIXTURE_TURN_WRITE: mode,
                  FIXTURE_TURN_THREAD: String(fault),
                },
                cwd: options.cwd,
                timeoutMs: 10_000,
                graceMs: 600,
                cleanupMs: 1_500,
              }).completion;

              expect(result.stopped).toBe(true);
              expect(result.issues).toEqual([]);
              expect(result.exitCode, result.stderr).toBe(completed && !transport ? 0 : 1);
              if (transport) expect(result.stderr).toContain("Transport failed");
              if (mode === "backpressure") expect(result.stderr).toContain("observed backpressure");
              if (mode === "peer-closed")
                expect(result.stderr).toContain("observed immediate EPIPE");

              const report = JSON.parse(result.stdout);
              const trials = benchmark ? report.trials : report.results;
              expect(trials).toHaveLength(fault + Number(Boolean(continues)));
              const trial = trials[fault - 1];
              expect(trial).toMatchObject({
                requestedSpeed: "standard",
                status: completed ? "completed" : benchmark ? "failed" : "error",
                sentTier: attempted ? "default" : null,
              });
              if (error) expect(trial.error).toContain(error);
              if (!completed && mode !== "thread-rejected") {
                expect(trial.sessionRetention).toMatchObject({
                  status: "skipped",
                  threadId: `thread-${fault}`,
                });
              }
              if (continues) {
                expect(trials.at(-1)).toMatchObject({
                  requestedSpeed: benchmark ? "standard" : "fast",
                  threadId: `thread-${fault + 1}`,
                  status: "completed",
                  sentTier: benchmark ? "default" : "priority",
                });
              }

              const events = await trace();
              expect(traceMethod(events, "thread/start")).toHaveLength(trials.length);
              const expectedStarts = [
                ...(benchmark ? [["thread-1", "default"]] : []),
                ...(attempted ? [[`thread-${fault}`, "default"]] : []),
                ...(continues ? [[`thread-${fault + 1}`, benchmark ? "default" : "priority"]] : []),
              ];
              expect(
                traceMethod(events, "turn/start").map(({ params }) => [
                  params?.threadId,
                  params?.serviceTierForTurn,
                ]),
              ).toEqual(expectedStarts);
              const retentionEvents = events.filter(
                ({ method }) => method === "thread/archive" || method === "thread/delete",
              );
              expect(
                retentionEvents.map(({ method, params }) => [method, params?.threadId]),
              ).toEqual(
                retention === "keep"
                  ? []
                  : [
                      ...(benchmark ? [[`thread/${retention}`, "thread-1"]] : []),
                      ...(completed ? [[`thread/${retention}`, `thread-${fault}`]] : []),
                      ...(continues ? [[`thread/${retention}`, `thread-${fault + 1}`]] : []),
                    ],
              );
              if (mode === "peer-closed")
                expect(traceMethod(events, "stdin-closed")).toHaveLength(1);
              if (mode === "later-loss") {
                expect(events.at(-1)?.method).toBe("stdout-ended");
                expect(trial.turnId).toBe(`turn-thread-${fault}`);
              }
              if (mode === "loss-after-completion") {
                await access(join(home, "final-readback-after-eof"));
                expect(trial.sessionRetention).toMatchObject({ status: "kept" });
              }

              if (benchmark) {
                expect(trials[0]).toMatchObject({ warmup: true, status: "completed" });
                expect(trial).toMatchObject({
                  inferenceAttempted: Boolean(attempted),
                  warmup: false,
                });
                expect(report.tokenUsage).toMatchObject({
                  partial: Boolean(scenario.partial),
                  totals: { totalTokens: scenario.total },
                });
                if (transport) expect(report.run.transportError).not.toBeNull();
                else expect(report.run.transportError).toBeNull();
              }
            },
          );
        },
        15_000,
      );
    }
  });
}
