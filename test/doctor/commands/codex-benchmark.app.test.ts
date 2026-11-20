import { expect, test } from "bun:test";
import { once } from "node:events";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import {
  requireProcessObservation,
  isLiveProcess,
} from "../../../scripts/testing/execution/process-table";
import { startFixtureProcess } from "../../../scripts/testing/fixtures/fixture-process";
import { actionDoctor } from "../../../src/cli/actions/doctor";
import { inspectCodexBenchmark } from "../../../src/cli/doctor/codex-benchmark";
import { withRunnerFixture } from "../../codex-benchmark/fixtures/runner";
import { createActionTestRuntime } from "../../helpers/cli-action-test-utils";
import { REPO_ROOT } from "../../helpers/cli-test-utils";
import { createDoctorFixture } from "../fixtures";

test.each([
  ["cdx_chores/0.170.0", "met", "0.170.0", undefined],
  ["cdx_chores/0.170.0+local", "met", "0.170.0+local", undefined],
  ["cdx_chores/1.0.0", "met", "1.0.0", undefined],
  ["Codex Exec/0.169.9", "unverified", "0.169.9", "Codex Exec"],
  ["codex/exec/0.170.0-beta.1", "unverified", "0.170.0-beta.1", "codex/exec"],
  ["codex_exec/0.171.0 (fixture)", "met", "0.171.0", undefined],
  ["codex_exec/0.170.0-beta.1+local", "unverified", "0.170.0-beta.1+local", undefined],
  ["Codex Exec/0.170.0+local", "met", "0.170.0+local", "Codex Exec"],
  ["codex/exec/0.171.0", "met", "0.171.0", "codex/exec"],
  ["codex/exec/0.171.0", "unverified", null, undefined],
  ["/0.171.0", "unverified", null, undefined],
  ["codex exec/0.171.0", "unverified", null, undefined],
  ["codex_exec/0.171.0/extra", "unverified", null, undefined],
  ["codex_exec/invalid cdx_chores/0.171.0", "unverified", null, undefined],
  [null, "unverified", null, undefined],
] as const)(
  "doctor checks app-server user agent %j, expects %s and %j with override %j",
  async (appServerUserAgent, status, version, originator) => {
    await withRunnerFixture({ appServerUserAgent }, async ({ options, trace }) => {
      const env = { ...options.env, CODEX_INTERNAL_ORIGINATOR_OVERRIDE: originator };
      const check = await inspectCodexBenchmark(options.cwd, env);
      expect(check).toMatchObject({ status, version, minimumVersion: "0.170.0" });
      const methods = (await trace()).map(({ method }) => method);
      expect(methods[0]).toBe("initialize");
      expect(methods.every((method) => method === "initialize" || method === "initialized")).toBe(
        true,
      );
    });
  },
);

test.skipIf(process.platform === "win32").each([
  { initialization: "succeeds", initializeError: false, escalation: "undelivered" },
  { initialization: "fails", initializeError: true, escalation: "deny-term" },
])(
  "doctor reports shutdown failure when initialization $initialization and the child is still alive",
  async ({ initializeError, escalation }) => {
    await withRunnerFixture(
      { appServerUserAgent: "cdx_chores/0.171.0", resistantLeader: true, initializeError },
      async ({ home, options, trace }) => {
        const build = await Bun.build({
          entrypoints: [join(REPO_ROOT, "src/cli/doctor/codex-benchmark.ts")],
          target: "node",
          packages: "external",
        });
        expect(build.success).toBe(true);
        await Bun.write(join(options.cwd, "probe.mjs"), build.outputs[0]!);
        const owned = startFixtureProcess({
          executable: "node",
          args: [
            "--import",
            pathToFileURL(join(REPO_ROOT, "test/codex-benchmark/fixtures/shutdown-signal.mjs"))
              .href,
            "--input-type=module",
            "-e",
            'import { inspectCodexBenchmark } from "./probe.mjs"; console.log(JSON.stringify(await inspectCodexBenchmark(process.cwd())));',
          ],
          env: { ...options.env, FIXTURE_ESCALATION: escalation },
          cwd: options.cwd,
          timeoutMs: 6_000,
          graceMs: 600,
          cleanupMs: 1_500,
        });
        let result;
        try {
          await once(owned.child, "exit");
          const at = Date.now();
          const processes = requireProcessObservation();
          const pid = Number(await readFile(join(home, "leader.pid"), "utf8"));
          const signals = (await readFile(join(home, "signals.jsonl"), "utf8"))
            .trim()
            .split("\n")
            .map((line) => JSON.parse(line) as { pid: number; signal: string; at: number });
          expect(signals.map((s) => [s.pid, s.signal])).toEqual(
            initializeError
              ? [[pid, "SIGTERM"]]
              : [
                  [pid, "SIGTERM"],
                  [pid, "SIGKILL"],
                ],
          );
          expect(at - signals[0]!.at).toBeGreaterThanOrEqual(0);
          expect(at - signals[0]!.at).toBeLessThanOrEqual(3_000);
          expect(
            processes.some(
              (p) => p.pid === pid && p.groupId === owned.child.pid && isLiveProcess(p),
            ),
          ).toBe(true);
        } finally {
          await writeFile(join(home, "release-shutdown"), "");
          result = await owned.completion;
        }
        expect(result.ok, result.stderr || JSON.stringify(result.issues)).toBe(true);
        const readiness = JSON.parse(result.stdout);
        expect(readiness.status).toBe("failed");
        expect(readiness.version).toBe(initializeError ? null : "0.171.0");
        expect(readiness.detail).toContain("App-server shutdown failed");
        if (initializeError) expect(readiness.detail).toContain("App-server initialization failed");
        expect((await trace())[0]?.method).toBe("initialize");
      },
    );
  },
  10_000,
);

test("doctor renders a failed initialization as a local diagnostic while retaining workflow checks", async () => {
  await withRunnerFixture({ initializeError: true }, async ({ options, trace }) => {
    const fixture = createDoctorFixture();
    for (const output of ["summary", "details", "json"]) {
      const { runtime, stdout, expectNoStderr } = createActionTestRuntime({ colorEnabled: false });
      await actionDoctor(runtime, {
        details: output === "details",
        json: output === "json",
        inspectors: {
          ...fixture.inspectors,
          inspectCodexBenchmark: () => inspectCodexBenchmark(options.cwd, options.env),
        },
      });
      expectNoStderr();
      if (output === "json") {
        const report = JSON.parse(stdout.text);
        expect(report.codexBenchmark).toMatchObject({
          status: "failed",
          version: null,
          detail: expect.stringContaining("`app-server`"),
        });
        expect(report.capabilities["data.query.codex"]).toBe(true);
      } else {
        expect(stdout.text).toContain("Codex benchmark local prerequisites: failed");
        expect(stdout.text).toContain("Run the selected Codex executable with `app-server`");
      }
    }
    expect((await trace()).map(({ method }) => method)).toEqual(Array(3).fill("initialize"));
  });
});
