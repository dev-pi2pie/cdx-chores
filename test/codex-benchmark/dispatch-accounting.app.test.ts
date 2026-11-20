import { describe, expect, test } from "bun:test";
import { access, mkdir, symlink } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
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

const maintainerEntry = join(REPO_ROOT, "scripts/spikes/codex-benchmark-live-check.ts");
const maintainerBundle = "examples/playground/codex-benchmark-live-check.mjs";

async function startMaintainerBundle(cwd: string, env: NodeJS.ProcessEnv) {
  await mkdir(join(cwd, "examples", "playground"), { recursive: true });
  const limits = { timeoutMs: 6_000, graceMs: 600, cleanupMs: 1_500 };
  const build = await startFixtureProcess({
    executable: process.execPath,
    args: [
      "build",
      maintainerEntry,
      "--target=node",
      "--format=esm",
      "--outfile=" + maintainerBundle,
    ],
    cwd,
    env: { PATH: process.env.PATH },
    ...limits,
  }).completion;
  expect(build.stopped).toBe(true);
  expect(build.ok, build.stderr).toBe(true);
  return startFixtureProcess({
    executable: "node",
    args: [
      maintainerBundle,
      "--model",
      "model-a",
      "--effort",
      "low",
      "--session-retention",
      "archive",
    ],
    cwd,
    env,
    ...limits,
  });
}

test.skipIf(process.platform === "win32").each(["peer-closed", "backpressure"] as const)(
  "maintainer bundle handles %s",
  async (mode) => {
    const closed = mode === "peer-closed";
    await withRunnerFixture(
      { closeStdinOnThreadStart: closed ? 1 : undefined },
      async ({ options, trace }) => {
        const { CDX_CHORES_CODEX_PATH: fixture, ...env } = options.env ?? {};
        if (!fixture) throw new Error("The bundle test requires a synthetic app-server.");
        const bin = join(options.cwd, "node_modules", ".bin");
        await mkdir(bin, { recursive: true });
        // Exercise the fallback at the documented depth and give the override a distinct default.
        await symlink(closed ? process.execPath : fixture, join(bin, "codex"));
        const preload = pathToFileURL(join(import.meta.dir, "fixtures/turn-write-preload.mjs"));
        const owned = await startMaintainerBundle(options.cwd, {
          ...env,
          ...(closed ? { CDX_CHORES_CODEX_PATH: " " + fixture + " " } : {}),
          NODE_OPTIONS: "--import=" + preload.href,
          FIXTURE_TURN_WRITE: mode,
          FIXTURE_TURN_THREAD: "1",
        });
        const result = await owned.completion;
        expect(result.stopped).toBe(true);
        expect(result.issues).toEqual([]);
        expect(result.exitCode, result.stderr).toBe(closed ? 1 : 0);
        expect(result.stderr).toContain(
          closed ? "observed immediate EPIPE" : "observed backpressure",
        );
        const { results } = JSON.parse(result.stdout);
        expect(results).toHaveLength(closed ? 1 : 2);
        if (closed) {
          expect(result.stderr).toContain("Transport failed");
          expect(results[0]).toMatchObject({
            requestedSpeed: "standard",
            status: "error",
            error: expect.stringContaining("EPIPE"),
            sentTier: null,
            sessionRetention: { status: "skipped", threadId: "thread-1" },
          });
        } else {
          expect(results).toMatchObject([
            { requestedSpeed: "standard", status: "completed", sentTier: "default" },
            { requestedSpeed: "fast", status: "completed", sentTier: "priority" },
          ]);
        }
        const events = await trace();
        expect(traceMethod(events, "thread/start")).toHaveLength(closed ? 1 : 2);
        expect(traceMethod(events, "stdin-closed")).toHaveLength(closed ? 1 : 0);
        const expectedThreads = closed ? [] : ["thread-1", "thread-2"];
        for (const method of ["turn/start", "thread/archive"]) {
          expect(traceMethod(events, method).map(({ params }) => params?.threadId)).toEqual(
            expectedThreads,
          );
        }
        expect(traceMethod(events, "thread/delete")).toEqual([]);
      },
    );
  },
  15_000,
);

test.skipIf(process.platform === "win32").each([
  ["SIGINT", 130],
  ["SIGTERM", 143],
] as const)(
  "maintainer bundle preserves %s exit",
  async (signal, exitCode) => {
    await withRunnerFixture(
      { withholdStartReplyThread: 1, waitForInterruptThread: 1 },
      async ({ options, trace }) => {
        const owned = await startMaintainerBundle(options.cwd, options.env ?? {});
        try {
          const deadline = performance.now() + 2_000;
          while (traceMethod(await trace(), "turn/start").length === 0) {
            if (performance.now() >= deadline) throw new Error("Live check did not start a turn.");
            await delay(10);
          }
          expect(owned.child.kill(signal)).toBe(true);
          const result = await owned.completion;
          expect(result.stopped).toBe(true);
          expect(result.issues).toEqual([]);
          expect(result.exitCode, result.stderr).toBe(exitCode);
          const events = await trace();
          expect(traceMethod(events, "turn/start")).toHaveLength(1);
          expect(traceMethod(events, "turn/interrupt")).toEqual([]);
          expect(traceMethod(events, "thread/archive")).toEqual([]);
        } finally {
          owned.shutdown();
          await owned.completion;
        }
      },
    );
  },
  15_000,
);

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
