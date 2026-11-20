import { expect, test } from "bun:test";
import { join } from "node:path";
import { startFixtureProcess } from "../../scripts/testing/fixtures/fixture-process";
import { REPO_ROOT } from "../helpers/cli-test-utils";
import { traceMethod, withRunnerFixture } from "./fixtures/runner";

const failures = {
  refused: "fixture refused local write",
  ended: "app-server stdin is not writable",
  rejected: "fixture rejected turn/start",
};

test.each(["refused", "ended", "rejected", "backpressure"] as const)(
  "benchmark accounts for a %s measured turn write",
  async (mode) => {
    const rejected = mode === "rejected";
    await withRunnerFixture(
      { rejectTurnStartThread: rejected ? 2 : undefined },
      async ({ options, trace }) => {
        const build = await Bun.build({
          entrypoints: [join(REPO_ROOT, "src/bin.ts")],
          packages: "external",
          target: "node",
        });
        expect(build.success).toBe(true);
        const cli = join(options.cwd, "bin.mjs");
        await Bun.write(cli, build.outputs[0]!);
        const preload = join(import.meta.dir, "fixtures/turn-write-preload.cjs");
        const result = await startFixtureProcess({
          executable: "node",
          args: [
            ...(rejected ? [] : ["--require", preload]),
            cli,
            "codex-bench",
            "--runs",
            "1",
            "--codex-speed",
            "standard",
            "--json",
            "--show-token-usage",
          ],
          env: { ...options.env, FIXTURE_TURN_WRITE: mode },
          cwd: options.cwd,
          timeoutMs: 10_000,
          graceMs: 600,
          cleanupMs: 1_500,
        }).completion;
        const completed = mode === "backpressure";
        expect(result.stopped).toBe(true);
        expect(result.issues).toEqual([]);
        expect(result.exitCode, result.stderr).toBe(completed ? 0 : 1);
        if (completed) expect(result.stderr).toContain("fixture observed backpressure");
        const attempted = rejected || completed;
        const starts = traceMethod(await trace(), "turn/start");
        expect(starts.map(({ params }) => params?.threadId)).toEqual(
          attempted ? ["thread-1", "thread-2"] : ["thread-1"],
        );
        for (const { params } of starts) expect(params?.serviceTierForTurn).toBe("default");
        const report = JSON.parse(result.stdout);
        expect(report.trials).toHaveLength(2);
        expect(report.trials[0]).toMatchObject({ warmup: true, status: "completed" });
        expect(report.trials[1]).toMatchObject({
          warmup: false,
          threadId: "thread-2",
          status: completed ? "completed" : "failed",
          inferenceAttempted: attempted,
          sentTier: attempted ? "default" : null,
        });
        if (!completed) expect(report.trials[1].error).toContain(failures[mode]);
        expect(report.tokenUsage).toMatchObject({
          partial: rejected,
          totals: { totalTokens: completed ? 460 : 230 },
        });
      },
    );
  },
);
