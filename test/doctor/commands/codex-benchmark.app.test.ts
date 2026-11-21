import { expect, test } from "bun:test";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { pathToFileURL } from "node:url";

import { actionDoctor } from "../../../src/cli/actions/doctor";
import { inspectCodexBenchmark } from "../../../src/cli/doctor/codex-benchmark";
import {
  buildNodeCaller,
  traceMethod,
  withRunnerFixture,
} from "../../codex-benchmark/fixtures/runner";
import {
  callerCancellationSignals,
  checkShutdownAtExit,
  signalCallerGroup,
  watchCallerExit,
  withShutdownFixture,
} from "../../codex-benchmark/fixtures/shutdown";
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
  { mode: "verified", initializeError: false, escalation: "allowed", signal: null, exitCode: 0 },
  {
    mode: "unverified",
    initializeError: false,
    escalation: "undelivered",
    signal: null,
    exitCode: 0,
  },
  {
    mode: "initialization error",
    initializeError: true,
    escalation: "deny-term",
    signal: null,
    exitCode: 0,
  },
  ...callerCancellationSignals.flatMap((signal) => [
    {
      mode: signal + " by default",
      initializeError: false,
      escalation: "allowed",
      signal,
      exitCode: null,
    } as const,
    {
      mode: signal + " with a caller handler",
      initializeError: false,
      escalation: "allowed",
      signal,
      exitCode: 42,
    } as const,
  ]),
] as const)(
  "built doctor observes $mode app-server shutdown",
  async ({ initializeError, escalation, signal, exitCode }) => {
    await withShutdownFixture(
      {
        appServerUserAgent: "cdx_chores/0.171.0",
        resistantLeader: signal === "SIGHUP" || escalation !== "allowed",
        resistantWorker: true,
        initializeError,
        stallInitialization: signal !== null,
      },
      async ({ home, options, trace, start }) => {
        const callerHandlesSignal = signal !== null && exitCode !== null;
        const cli = await buildNodeCaller(join(REPO_ROOT, "src/bin.ts"), options.cwd);
        const caller = start({
          executable: "node",
          args: [
            "--import",
            pathToFileURL(join(REPO_ROOT, "test/codex-benchmark/fixtures/shutdown-signal.mjs"))
              .href,
            cli,
            "doctor",
            "--json",
          ],
          env: {
            ...options.env,
            FIXTURE_ESCALATION: escalation,
            FIXTURE_CALLER_SIGNAL: callerHandlesSignal ? signal : undefined,
          },
          cwd: options.cwd,
          timeoutMs: 10_000,
          graceMs: 600,
          cleanupMs: 1_500,
        });
        const callerExit = watchCallerExit(caller);
        let cancellationAt: number | undefined;
        if (signal) {
          const deadline = performance.now() + 5_000;
          while (!traceMethod(await trace(), "initialize").length) {
            if (performance.now() >= deadline) throw new Error("Doctor did not initialize.");
            await delay(20);
          }
          cancellationAt = signalCallerGroup(caller, signal);
        }
        const result = await caller.completion;
        await checkShutdownAtExit(home, callerExit(), escalation, cancellationAt);
        expect(result.stopped).toBe(true);
        expect(result.issues).toEqual([]);
        const events = await trace();
        expect(events[0]?.method).toBe("initialize");
        if (signal) {
          expect(traceMethod(events, "initialize-fallback")).toHaveLength(0);
          expect(result.reason).toBe("exit-failed");
        }
        expect(result.signal).toBe(callerHandlesSignal ? null : signal);
        // A failed benchmark prerequisite remains a diagnostic in the doctor report.
        expect(result.exitCode, result.stderr).toBe(exitCode);
        if (exitCode === null) return;
        const { codexBenchmark } = JSON.parse(result.stdout);
        expect(codexBenchmark.status).toBe(!signal && escalation === "allowed" ? "met" : "failed");
        expect(codexBenchmark.version).toBe(initializeError || signal ? null : "0.171.0");
        if (escalation !== "allowed")
          expect(codexBenchmark.detail).toContain("App-server shutdown failed");
        if (initializeError || signal)
          expect(codexBenchmark.detail).toContain("App-server initialization failed");
      },
    );
  },
  15_000,
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
