import { expect } from "bun:test";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { pathToFileURL } from "node:url";
import type { OwnedProcess, OwnedProcessResult } from "../../../scripts/testing/execution/process";
import {
  isLiveProcess,
  observeProcessGroup,
  requireProcessObservation,
  type ProcessMember,
} from "../../../scripts/testing/execution/process-table";
import {
  completeRejectedFixtureLaunch,
  registerFixtureProcess,
  startFixtureProcess,
} from "../../../scripts/testing/fixtures/fixture-process";
import { withRunnerFixture, type RunnerFixture } from "./runner";

export function startShutdownLiveCheck(
  { start, options }: RunnerFixture,
  escalation: "allowed" | "denied" | "undelivered",
) {
  return start({
    executable: process.execPath,
    args: [
      "--preload",
      join(import.meta.dir, "shutdown-signal.mjs"),
      join(import.meta.dir, "runner-live-check.ts"),
      "--model",
      "model-a",
      "--effort",
      "low",
      "--session-retention",
      "archive",
    ],
    env: { ...options.env, FIXTURE_ESCALATION: escalation },
    cwd: options.cwd,
    timeoutMs: 6_000,
    graceMs: 600,
    cleanupMs: 1_500,
  });
}

export async function readSpawnedLeader(home: string) {
  const receipt = await readFile(join(home, "app-server-spawn"), "utf8");
  if (receipt === "not-started\n") return undefined;
  const pid = Number(receipt);
  if (!/^[1-9]\d*\n$/.test(receipt) || !Number.isSafeInteger(pid) || pid <= 1) {
    throw new Error("Incomplete fixture app-server spawn receipt.");
  }
  return pid;
}

async function verifyReleasedGroup(
  home: string,
  caller: OwnedProcess,
  receipt: ReturnType<typeof registerFixtureProcess>,
  observe: typeof observeProcessGroup,
) {
  let result: OwnedProcessResult;
  try {
    await writeFile(join(home, "release-shutdown"), "");
  } finally {
    caller.shutdown();
    result = await caller.completion;
  }
  if (!result.stopped) throw new Error("Fixture caller shutdown is unverified.");

  // An absent receipt after caller launch cannot prove that the app-server never started.
  const launchFailed = result.reason === "launch-failed" && result.groupId === undefined;
  const leader = launchFailed ? undefined : await readSpawnedLeader(home);
  if (leader === undefined) {
    receipt?.complete({ stopped: true, reason: "launch-rejected" });
    return;
  }
  receipt?.started(leader);
  const deadline = performance.now() + 1_000;
  while (performance.now() < deadline) {
    if (!(await observe(leader, deadline - performance.now())).some(isLiveProcess)) {
      receipt?.complete({ pid: leader, groupId: leader, stopped: true, reason: "completed" });
      return;
    }
    await delay(Math.min(20, Math.max(0, deadline - performance.now())));
  }
  throw new Error("Fixture app-server group was still live at the cleanup deadline.");
}

export function withShutdownFixture<T>(
  scenario: Parameters<typeof withRunnerFixture>[0],
  exercise: (fixture: RunnerFixture) => Promise<T>,
  observe = observeProcessGroup,
): Promise<T> {
  let canClean = true;
  return withRunnerFixture(
    scenario,
    async (fixture) => {
      let caller: OwnedProcess | undefined;
      let receipt: ReturnType<typeof registerFixtureProcess>;
      try {
        return await exercise({
          ...fixture,
          start(options) {
            if (!canClean) throw new Error("Shutdown fixture can launch only one caller.");
            canClean = false;
            receipt = registerFixtureProcess();
            try {
              caller = startFixtureProcess({
                ...options,
                env: { ...options.env, FIXTURE_RECORD_APP_SERVER: "1" },
              });
            } catch (error) {
              canClean = completeRejectedFixtureLaunch(receipt, error);
              throw error;
            }
            return caller;
          },
        });
      } finally {
        if (caller) {
          await verifyReleasedGroup(fixture.home, caller, receipt, observe);
          canClean = true;
        }
      }
    },
    () => canClean,
  );
}

export function withDispatchFixture<T>(
  scenario: Parameters<typeof withRunnerFixture>[0],
  exercise: (fixture: RunnerFixture) => Promise<T>,
): Promise<T> {
  if (scenario.closeStdinOnThreadStart === undefined) return withRunnerFixture(scenario, exercise);
  const preload = pathToFileURL(join(import.meta.dir, "shutdown-signal.mjs")).href;
  return withShutdownFixture(scenario, (fixture) =>
    exercise({
      ...fixture,
      start: (options) =>
        fixture.start({ ...options, args: ["--import", preload, ...options.args] }),
    }),
  );
}

type CallerExit = { at: number; processes: ProcessMember[] };

export function watchCallerExit({ child }: OwnedProcess) {
  let observed: CallerExit | undefined;
  let observationError: unknown;
  child.once("exit", () => {
    try {
      observed = { at: Date.now(), processes: requireProcessObservation() };
    } catch (error) {
      observationError = error;
    }
  });
  return () => {
    if (!observed) throw observationError ?? new Error("Fixture caller exit was not observed.");
    return observed;
  };
}

export const callerCancellationSignals = ["SIGHUP", "SIGINT", "SIGTERM"] as const;

export function signalCallerGroup({ child }: OwnedProcess, signal: NodeJS.Signals): number {
  const group = child.pid;
  if (
    !group ||
    group <= 1 ||
    !requireProcessObservation().some(
      (member) =>
        member.pid === group &&
        member.parentPid === process.pid &&
        member.groupId === group &&
        isLiveProcess(member),
    )
  ) {
    throw new Error("The fixture caller is not leading a live, separate process group.");
  }
  const sentAt = Date.now();
  expect(process.kill(-group, signal)).toBe(true);
  return sentAt;
}

async function readLeader(home: string) {
  const leader = Number(await readFile(join(home, "leader.pid"), "utf8"));
  if (!Number.isSafeInteger(leader) || leader <= 1) {
    throw new Error("Missing valid fixture group leader.");
  }
  return leader;
}

export async function checkShutdownAtExit(
  home: string,
  exit: CallerExit,
  escalation: "allowed" | "denied" | "undelivered" | "deny-term",
  cancellationAt?: number,
) {
  const leader = await readLeader(home);
  expect(await readSpawnedLeader(home)).toBe(leader);
  const worker = JSON.parse(await readFile(join(home, "worker.pid"), "utf8")) as {
    pid: number;
    groupId: number;
  };
  expect(worker.groupId).toBe(leader);
  expect(Number.isSafeInteger(worker.pid)).toBe(true);
  expect(worker.pid).toBeGreaterThan(1);
  expect(worker.pid).not.toBe(leader);
  const members = exit.processes
    .filter((p) => p.groupId === leader && isLiveProcess(p))
    .map((p) => p.pid)
    .sort((a, b) => a - b);
  expect(members).toEqual(
    escalation === "allowed" ? [] : [leader, worker.pid].sort((a, b) => a - b),
  );
  const signals = (await readFile(join(home, "signals.jsonl"), "utf8"))
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as { pid: number; signal: string; at: number });
  expect(signals).toMatchObject([
    { pid: -leader, signal: "SIGTERM" },
    ...(escalation === "deny-term" ? [] : [{ pid: -leader, signal: "SIGKILL" }]),
  ]);
  const lastSignal = signals.at(-1)!;
  expect(lastSignal.at).toBeGreaterThanOrEqual(signals[0]!.at);
  expect(exit.at).toBeGreaterThanOrEqual(lastSignal.at);
  expect(exit.at - signals[0]!.at).toBeLessThanOrEqual(3_000);
  if (cancellationAt !== undefined) {
    // A caller-installed handler alone could leave the RPC waiting for its own timeout.
    expect(signals[0]!.at - cancellationAt).toBeGreaterThanOrEqual(0);
    expect(signals[0]!.at - cancellationAt).toBeLessThan(4_000);
  }
}
