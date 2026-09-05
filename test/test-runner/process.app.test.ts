import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import {
  startOwnedProcess,
  type OwnedProcess,
  type OwnedProcessOptions,
  type OwnedProcessResult,
} from "../../scripts/testing/execution/process.ts";
import { observeProcessGroup } from "../../scripts/testing/execution/process-table.ts";
import { runAfterPreflight } from "../../scripts/testing/execution/preflight.ts";
import { REPO_ROOT, withTempFixtureDir } from "../helpers/cli-test-utils";

const subject = join(import.meta.dir, "fixtures/process-subject.cjs");
const limits = { timeoutMs: 2500, graceMs: 250, cleanupMs: 1500 };
const options = (
  mode: string,
  overrides: Partial<OwnedProcessOptions> = {},
): OwnedProcessOptions => ({
  executable: "node",
  args: [subject, mode],
  cwd: REPO_ROOT,
  env: { PATH: process.env.PATH },
  ...limits,
  ...overrides,
});

async function ready(process: OwnedProcess): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    let output = "";
    process.child.stdout.on("data", (chunk: Buffer) => {
      output += chunk.toString();
      if (output.includes("ready:")) resolve();
    });
    void process.completion.then(() => reject(new Error("Subject ended before becoming ready.")));
  });
}

async function assertStopped(result: OwnedProcessResult): Promise<void> {
  expect(result.stopped).toBe(true);
  expect(result.groupId).toBe(result.pid);
  const remaining = await observeProcessGroup(result.groupId!, 500);
  expect(remaining.filter((member) => !member.state.startsWith("Z"))).toEqual([]);
}

function assertSuccessful(result: OwnedProcessResult): void {
  const { reason, exitCode, signal, stopped, issues, signals } = result;
  expect(result.ok, JSON.stringify({ reason, exitCode, signal, stopped, issues, signals })).toBe(
    true,
  );
}

function startSurvivor(afterExit: "normal" | "unavailable" | "replacement" = "normal") {
  let exited = false;
  let released = false;
  const owned = startOwnedProcess(options("survivor", { graceMs: 100, cleanupMs: 600 }), {
    observe: async (groupId, timeoutMs) => {
      if (exited && afterExit === "unavailable") throw new Error("observation denied after exit");
      if (exited && afterExit === "replacement") {
        return [{ pid: groupId, parentPid: 1, groupId, state: "S", executable: "unrelated" }];
      }
      const members = await observeProcessGroup(groupId, timeoutMs);
      if (
        !released &&
        members.some((member) => member.pid !== groupId && !member.state.startsWith("Z"))
      ) {
        released = true;
        owned.child.stdin.end("release\n");
      }
      return members;
    },
  });
  owned.child.once("exit", () => {
    exited = true;
  });
  return owned;
}

describe("owned process lifecycle", () => {
  test("refreshes a live snapshot delivered after direct-child exit", async () => {
    let terminating = false;
    let heldSnapshot = false;
    const owned = startOwnedProcess(options("held-server"), {
      observe: async (groupId, timeoutMs) => {
        const members = await observeProcessGroup(groupId, timeoutMs);
        if (terminating && !heldSnapshot && members.some((member) => member.pid === groupId)) {
          heldSnapshot = true;
          await new Promise<void>((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error("Fixture did not exit.")), timeoutMs);
            owned.child.once("exit", () => {
              clearTimeout(timer);
              resolve();
            });
            owned.child.stdin.end("release\n");
          });
        }
        return members;
      },
    });
    owned.child.stdout.on("data", (chunk: Buffer) => {
      if (chunk.toString().includes("terminating")) terminating = true;
    });
    await ready(owned);
    owned.shutdown();
    const result = await owned.completion;
    expect(heldSnapshot).toBe(true);
    assertSuccessful(result);
    expect(result.exitCode).toBe(0);
    expect(result.signals.map((entry) => entry.signal)).toEqual(["SIGTERM"]);
    await assertStopped(result);
  });

  test("retains ownership after an empty snapshot while the direct child is alive", async () => {
    let observations = 0;
    const process = startOwnedProcess(options("server"), {
      observe: async (groupId, timeoutMs) => {
        observations++;
        if (observations === 1) return [];
        return observeProcessGroup(groupId, timeoutMs);
      },
    });
    await ready(process);
    process.shutdown();
    const result = await process.completion;
    expect(observations).toBeGreaterThan(1);
    assertSuccessful(result);
    expect(result.issues).toEqual([]);
    expect(result.signals.map((entry) => entry.signal)).toEqual(["SIGTERM"]);
    await assertStopped(result);
  });

  test("captures output and verifies normal exit without sending signals", async () => {
    const result = await startOwnedProcess(options("exit")).completion;
    assertSuccessful(result);
    expect(result.stdout).toBe("finished\n");
    expect(result.reason).toBe("completed");
    expect(result.signals).toEqual([]);
    await assertStopped(result);
  });

  test("preserves the subject's nonzero exit without calling it a cleanup failure", async () => {
    const result = await startOwnedProcess(options("fail")).completion;
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("exit-failed");
    expect(result.exitCode).toBe(7);
    expect(result.stderr).toBe("subject failure\n");
    expect(result.issues).toEqual([]);
    await assertStopped(result);
  });

  test.each(["server", "launcher"])("allows expected graceful shutdown of %s", async (mode) => {
    const process = startOwnedProcess(options(mode));
    await ready(process);
    expect((await observeProcessGroup(process.child.pid!, 499.5)).length).toBeGreaterThan(0);
    process.shutdown();
    process.shutdown();
    const result = await process.completion;
    assertSuccessful(result);
    expect(result.reason).toBe("shutdown");
    expect(result.escalated).toBe(false);
    expect(result.signals.map((entry) => entry.signal)).toEqual(["SIGTERM"]);
    await assertStopped(result);
  });

  test("waits for a normally draining descendant after launcher exit", async () => {
    const result = await startOwnedProcess(options("delayed-child")).completion;
    assertSuccessful(result);
    expect(result.signals).toEqual([]);
    await assertStopped(result);
  });

  test("fails and recovers a resistant descendant after its launcher exits", async () => {
    const result = await startSurvivor().completion;
    expect(result.ok).toBe(false);
    expect(result.exitCode).toBe(0);
    expect(result.escalated).toBe(true);
    expect(result.issues).toContain("Owned descendants outlived the normal completion allowance.");
    expect(result.signals.map((entry) => entry.signal)).toEqual(["SIGTERM", "SIGKILL"]);
    expect(
      result.observations.some((sample) =>
        sample.members.some((member) => member.pid !== result.pid),
      ),
    ).toBe(true);
    await assertStopped(result);
  });

  test("preserves a timeout reason when forced termination is required", async () => {
    const result = await startOwnedProcess(options("resist", { timeoutMs: 200 })).completion;
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("timeout");
    expect(result.escalated).toBe(true);
    expect(result.elapsedMs).toBeLessThan(2000);
    await assertStopped(result);
  });

  test("cancels owned test work and preserves unrelated process ownership", async () => {
    const unrelated = startOwnedProcess(options("server"));
    const abort = new AbortController();
    const process = startOwnedProcess(options("launcher", { signal: abort.signal }));
    const failures: unknown[] = [];
    try {
      await Promise.all([ready(process), ready(unrelated)]);
      abort.abort();
      const result = await process.completion;
      expect(result.reason).toBe("cancelled");
      expect(result.ok).toBe(false);
      await assertStopped(result);
      expect(
        (await observeProcessGroup(unrelated.child.pid!, 500)).some(
          (member) => member.pid === unrelated.child.pid,
        ),
      ).toBe(true);
    } catch (error) {
      failures.push(error);
    } finally {
      abort.abort();
      await process.completion;
      unrelated.shutdown();
      try {
        assertSuccessful(await unrelated.completion);
      } catch (error) {
        failures.push(error);
      }
    }
    if (failures.length === 1) throw failures[0];
    if (failures.length > 1) throw new AggregateError(failures, "Test and server cleanup failed.");
  });

  test("a hanging synchronous preflight cannot launch the subsequent command", async () => {
    await withTempFixtureDir("process-preflight", async (root) => {
      const marker = join(root, "probe.pid");
      const launched = join(root, "execution.pid");
      const { preflight, execution } = await runAfterPreflight({
        preflight: options("native-hang", {
          args: [subject, "native-hang", marker],
          cwd: root,
          timeoutMs: 300,
        }),
        execution: options("mark", { args: [subject, "mark", launched], cwd: root }),
      });
      expect(existsSync(marker)).toBe(true);
      expect(preflight.reason).toBe("timeout");
      expect(execution).toBeNull();
      expect(existsSync(launched)).toBe(false);
      await assertStopped(preflight);
    });
  });

  test("cancellation during a running preflight prevents subsequent launch", async () => {
    await withTempFixtureDir("process-preflight-cancel", async (root) => {
      const marker = join(root, "probe.pid");
      const launched = join(root, "execution.pid");
      const abort = new AbortController();
      const sequence = runAfterPreflight({
        preflight: options("hang", { args: [subject, "hang", marker], cwd: root }),
        execution: options("mark", { args: [subject, "mark", launched], cwd: root }),
        signal: abort.signal,
      });
      try {
        const deadline = performance.now() + 1000;
        while (!existsSync(marker) && performance.now() < deadline) await delay(10);
        expect(existsSync(marker)).toBe(true);
      } finally {
        abort.abort();
        await sequence;
      }
      const { preflight, execution } = await sequence;
      expect(preflight.reason).toBe("cancelled");
      expect(preflight.signals.map((entry) => entry.signal)).toEqual(["SIGTERM"]);
      expect(execution).toBeNull();
      expect(existsSync(launched)).toBe(false);
      await assertStopped(preflight);
    });
  });

  test("a passing preflight runs and awaits the actual subsequent command", async () => {
    await withTempFixtureDir("process-preflight-success", async (root) => {
      const launched = join(root, "execution.pid");
      const result = await runAfterPreflight({
        preflight: options("exit"),
        execution: options("mark", { args: [subject, "mark", launched], cwd: root }),
      });
      expect(result.preflight.ok).toBe(true);
      expect(result.execution?.ok).toBe(true);
      expect(existsSync(launched)).toBe(true);
      await assertStopped(result.execution!);
    });
  });

  test("rejects pre-aborted work before starting any process", () => {
    const abort = new AbortController();
    abort.abort();
    expect(() => startOwnedProcess(options("exit", { signal: abort.signal }))).toThrow(
      "cancelled before",
    );
  });

  test("reports launch failure without inventing a process identity", async () => {
    const result = await startOwnedProcess(
      options("exit", {
        executable: join(REPO_ROOT, "test/test-runner/does-not-exist"),
      }),
    ).completion;
    expect(result.reason).toBe("launch-failed");
    expect(result.ok).toBe(false);
    expect(result.pid).toBeUndefined();
    expect(result.groupId).toBeUndefined();
    expect(result.stopped).toBe(true);
  });

  test("bounds captured output and stops the producer", async () => {
    const result = await startOwnedProcess(options("flood", { maxOutputBytes: 128 })).completion;
    expect(result.reason).toBe("output-limit");
    expect(Buffer.byteLength(result.stdout) + Buffer.byteLength(result.stderr)).toBe(128);
    await assertStopped(result);
  });

  test("fails explicitly when process-state observation is unavailable", async () => {
    const process = startOwnedProcess(options("server"), {
      observe: async () => {
        throw new Error("observation denied");
      },
    });
    try {
      const result = await process.completion;
      expect(result.ok).toBe(false);
      expect(result.reason).toBe("unverified");
      expect(result.stopped).toBe(false);
      expect(result.issues).toContain("Required process-state observation is unavailable.");
    } finally {
      process.shutdown();
      const result = await process.completion;
      expect(
        (await observeProcessGroup(result.pid!, 500)).filter(
          (member) => !member.state.startsWith("Z"),
        ),
      ).toEqual([]);
    }
  });

  test.each(["unavailable", "replacement"] as const)(
    "hands back unresolved descendants when observation is %s",
    async (mode) => {
      const owned = startSurvivor(mode);
      try {
        const result = await owned.completion;
        expect(result.ok).toBe(false);
        expect(result.stopped).toBe(false);
        expect(result.reason).toBe("unverified");
        expect(result.exitCode).toBe(0);
        expect(result.signals).toEqual([]);
        expect(result.groupId).toBe(result.pid);
        expect(result.issues).toContain(
          mode === "unavailable"
            ? "Required process-state observation is unavailable."
            : "Owned process group continuity is unverified.",
        );
      } finally {
        // The deliberately unavailable observer cannot authorize cleanup. The
        // fixture owner obtains fresh evidence of its exact child before recovery.
        const result = await owned.completion;
        const descendant = Number(/child:(\d+)/.exec(result.stdout)?.[1]);
        const members = await observeProcessGroup(result.groupId!, 500);
        if (members.some((member) => member.pid === descendant && !member.state.startsWith("Z"))) {
          process.kill(-result.groupId!, "SIGKILL");
        }
        const deadline = performance.now() + 1000;
        while (
          (await observeProcessGroup(result.groupId!, 500)).some(
            (member) => !member.state.startsWith("Z"),
          ) &&
          performance.now() < deadline
        )
          await delay(10);
        expect(
          (await observeProcessGroup(result.groupId!, 500)).filter(
            (member) => !member.state.startsWith("Z"),
          ),
        ).toEqual([]);
      }
    },
  );

  test("does not send a signal after the termination budget has expired", async () => {
    const owned = startOwnedProcess(options("exit", { graceMs: 10, cleanupMs: 30 }), {
      observe: async () => {
        await delay(60);
        throw new Error("slow observation");
      },
    });
    owned.shutdown();
    const result = await owned.completion;
    expect(result.ok).toBe(false);
    expect(result.signals).toEqual([]);
    expect(result.issues).toContain(
      "Owned process completion could not be verified within the cleanup allowance.",
    );
    expect(
      (await observeProcessGroup(result.pid!, 500)).filter(
        (member) => !member.state.startsWith("Z"),
      ),
    ).toEqual([]);
  });
});
