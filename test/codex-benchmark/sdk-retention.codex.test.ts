import { expect, test } from "bun:test";
import { chmod, readFile } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { pathToFileURL } from "node:url";

import { lifecycleDiagnostic, withLiveCodexFixture } from "../codex-info/live-fixture";
import { withTempFixtureDir } from "../helpers/cli-test-utils";
import {
  callerCancellationSignals,
  checkShutdownAtExit,
  signalCallerGroup,
  watchCallerExit,
  withShutdownFixture,
} from "./fixtures/shutdown";
import { captureSpeedRequest, fixtureAnswer, fixturePrompt } from "./fixtures/speed-provider";

const cases = [
  {
    label: "delete only the one-shot data-query thread after capturing its answer",
    scenario: "one-shot",
    baseline: "default",
    answers: [
      fixtureAnswer,
      JSON.stringify({ sql: "SELECT value FROM file", reasoning_summary: "Read value." }),
    ],
    wireTiers: [undefined, "priority"],
  },
  {
    label: "archive a reused SDK thread after the second turn and final release",
    scenario: "reuse",
    baseline: "fast",
    answers: fixtureAnswer,
    wireTiers: [undefined, undefined],
  },
] as const;

async function withProbe(run: (driver: string) => Promise<void>): Promise<void> {
  await withTempFixtureDir("sdk-retention-driver", async (directory) => {
    const driver = await Bun.build({
      entrypoints: [join(import.meta.dir, "fixtures", "sdk-retention-probe.ts")],
      target: "node",
      packages: "external",
    });
    expect(driver.success).toBe(true);
    const driverPath = join(directory, "retention-probe.mjs");
    await Bun.write(driverPath, driver.outputs[0]!);
    await run(driverPath);
  });
}

test.each(cases)(
  "SDK retention can $label",
  async ({ scenario, baseline, answers, wireTiers }) => {
    await withProbe(async (driverPath) => {
      const requests = await captureSpeedRequest(
        baseline,
        async ({ env, start }) => {
          const result = await start({
            executable: "node",
            args: [driverPath, scenario, fixturePrompt, fixtureAnswer],
            env,
            timeoutMs: 12_000,
          }).completion;
          expect(result.ok, `${lifecycleDiagnostic(result)}\n${result.stderr}`).toBe(true);
          expect(result.stderr).toBe("");
        },
        answers,
      );
      expect(requests.map((request) => request.service_tier)).toEqual([...wireTiers]);
    });
  },
  20_000,
);

test.each([
  { scenario: "rpc-error", result: "fixture-answer", cancelled: false },
  { scenario: "work-error", result: "Original helper error.", cancelled: false },
  { scenario: "cancelled", result: /abort/i, cancelled: true },
  { scenario: "archive-close-error", result: "fixture-answer", cancelled: false },
  { scenario: "delete-close-error", result: "Original helper error.", cancelled: false },
  { scenario: "default-keep", result: "fixture-answer", cancelled: false },
] as const)(
  "SDK retention preserves helper outcome when $scenario occurs",
  async ({ scenario, result, cancelled }) => {
    await withProbe(async (driverPath) => {
      await withLiveCodexFixture(async ({ start, root, env, cwd }) => {
        const executable = join(root, "selected-codex.mjs");
        await Bun.write(
          executable,
          Bun.file(join(import.meta.dir, "fixtures", "sdk-retention-executable.mjs")),
        );
        await chmod(executable, 0o755);
        const events = join(root, "retention-events.jsonl");
        const home = join(root, "home", ".codex");
        const closeFailure = scenario.endsWith("-close-error");
        const keep = scenario === "default-keep";
        const mode = scenario === "delete-close-error" ? "delete" : "archive";
        const probe = await start({
          executable: "node",
          args: [
            ...(closeFailure
              ? [
                  "--import",
                  pathToFileURL(join(import.meta.dir, "fixtures/shutdown-signal.mjs")).href,
                ]
              : []),
            driverPath,
            scenario,
            executable,
          ],
          env: {
            ...env,
            CDX_CHORES_CODEX_PATH: join(root, "other-codex"),
            CDX_RETENTION_EVENTS: events,
            CDX_RETENTION_CANCEL: cancelled ? "1" : "0",
            FIXTURE_ESCALATION: closeFailure ? "deny-term" : undefined,
            CODEX_HOME: home,
          },
          timeoutMs: 7_500,
        }).completion;
        expect(probe.ok, `${lifecycleDiagnostic(probe)}\n${probe.stderr}`).toBe(true);
        if (typeof result === "string") expect(probe.stdout.trim()).toBe(result);
        else expect(probe.stdout).toMatch(result);
        const timeline = (await readFile(events, "utf8"))
          .trim()
          .split("\n")
          .map((line) => JSON.parse(line) as { event: string; home: string; cwd: string });
        expect(timeline.map((entry) => entry.event)).toEqual(
          cancelled
            ? ["exec-started"]
            : keep
              ? ["exec-started", "exec-exited"]
              : [
                  "exec-started",
                  "exec-exited",
                  "app-server-started",
                  `thread/${mode}:owned-fixture-thread`,
                ],
        );
        expect(timeline.every((entry) => entry.home === home && entry.cwd === cwd)).toBe(true);
        if (keep) {
          expect(probe.stderr).toBe("");
          return;
        }
        expect(probe.stderr).toContain("owned-fixture-thread");
        expect(probe.stderr).toContain(
          cancelled
            ? "skipped"
            : closeFailure
              ? "Fixture denied app-server SIGTERM."
              : "Fixture binary does not support retention",
        );
        if (closeFailure) {
          expect(probe.stderr).toContain(`Codex session ${mode} failed`);
          const leader = Number(await readFile(join(home, "leader.pid"), "utf8"));
          const signals = (await readFile(join(home, "signals.jsonl"), "utf8"))
            .trim()
            .split("\n")
            .map((line) => JSON.parse(line));
          expect(signals).toMatchObject([
            { pid: process.platform === "win32" ? leader : -leader, signal: "SIGTERM" },
          ]);
          await expect(readFile(join(home, "app-server-spawn"))).rejects.toMatchObject({
            code: "ENOENT",
          });
        }
      });
    });
  },
  15_000,
);

test
  .skipIf(process.platform === "win32")
  .each([
    { escalation: "allowed", signal: null, output: "fixture-answer", exitCode: 0 },
    { escalation: "undelivered", signal: null, output: "fixture-answer", exitCode: 0 },
    { escalation: "undelivered", signal: null, output: "Original helper error.", exitCode: 0 },
    ...callerCancellationSignals.flatMap((signal) => [
      { escalation: "allowed", signal, output: null, exitCode: null } as const,
      { escalation: "allowed", signal, output: "fixture-answer", exitCode: 42 } as const,
    ]),
  ] as const)(
  "SDK retention verifies its worker with $escalation escalation, signal $signal, outcome $output",
  async ({ escalation, signal, output, exitCode }) => {
    await withProbe(async (driverPath) => {
      await withShutdownFixture({}, async ({ home, options, start }) => {
        const executable = options.env?.CDX_CHORES_CODEX_PATH;
        if (!executable) throw new Error("Missing fixture executable.");
        await Bun.write(
          executable,
          Bun.file(join(import.meta.dir, "fixtures/sdk-retention-executable.mjs")),
        );
        const events = join(home, "retention-events.jsonl");
        const mode = output === "Original helper error." ? "delete" : "archive";
        const callerHandlesSignal = signal !== null && exitCode !== null;
        const scenario = mode === "delete" ? "delete-close-error" : "archive-worker";
        const caller = start({
          executable: "node",
          args: [
            "--import",
            pathToFileURL(join(import.meta.dir, "fixtures/shutdown-signal.mjs")).href,
            driverPath,
            scenario,
            executable,
          ],
          cwd: options.cwd,
          env: {
            ...options.env,
            CDX_RETENTION_EVENTS: events,
            CDX_RETENTION_WORKER: "1",
            CDX_RETENTION_RPC: signal ? "stall" : "success",
            FIXTURE_ESCALATION: escalation,
            FIXTURE_CALLER_SIGNAL: callerHandlesSignal ? signal : undefined,
          },
          timeoutMs: 7_500,
          graceMs: 600,
          cleanupMs: 1_500,
        });
        const callerExit = watchCallerExit(caller);
        let cancellationAt: number | undefined;
        if (signal) {
          const deadline = performance.now() + 3_000;
          while (
            !(await Bun.file(events).exists()) ||
            !(await Bun.file(events).text()).includes("thread/archive:")
          ) {
            if (performance.now() >= deadline)
              throw new Error("Retention request did not reach the fixture.");
            await delay(20);
          }
          cancellationAt = signalCallerGroup(caller, signal);
        }
        const result = await caller.completion;
        await checkShutdownAtExit(home, callerExit(), escalation, cancellationAt);
        expect(result.stopped).toBe(true);
        expect(result.issues).toEqual([]);
        if (signal) expect(result.reason).toBe("exit-failed");
        expect(result.signal).toBe(callerHandlesSignal ? null : signal);
        expect(result.exitCode, result.stderr).toBe(exitCode);
        const timeline = (await readFile(events, "utf8"))
          .trim()
          .split("\n")
          .map((line) => JSON.parse(line).event);
        expect(timeline).toEqual([
          "exec-started",
          "exec-exited",
          "app-server-started",
          `thread/${mode}:owned-fixture-thread`,
        ]);
        if (output !== null) expect(result.stdout.trim()).toBe(output);
        if (escalation === "undelivered") {
          expect(result.stderr).toContain(`Codex session ${mode} failed`);
          expect(result.stderr).toContain("shutdown deadline");
        } else if (callerHandlesSignal) {
          expect(result.stderr).toContain("Codex session archive failed");
          expect(result.stderr).toContain("Codex app-server was closed.");
        } else if (!signal) {
          expect(result.stderr).toBe("");
        }
      });
    });
  },
  12_000,
);
