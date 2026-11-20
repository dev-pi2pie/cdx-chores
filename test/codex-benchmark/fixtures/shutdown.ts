import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import type {
  OwnedProcess,
  OwnedProcessOptions,
  OwnedProcessResult,
} from "../../../scripts/testing/execution/process";
import {
  isLiveProcess,
  observeProcessGroup,
} from "../../../scripts/testing/execution/process-table";
import {
  completeRejectedFixtureLaunch,
  registerFixtureProcess,
  startFixtureProcess,
} from "../../../scripts/testing/fixtures/fixture-process";
import { withRunnerFixture, type RunnerFixture } from "./runner";

interface ShutdownFixture extends RunnerFixture {
  start(options: OwnedProcessOptions): OwnedProcess;
}

export function startShutdownLiveCheck(
  { start, options }: ShutdownFixture,
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
  exercise: (fixture: ShutdownFixture) => Promise<T>,
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
            receipt = registerFixtureProcess();
            canClean = false;
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
