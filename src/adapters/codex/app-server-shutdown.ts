import type { ChildProcess } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const shutdownGraceMs = 1_000;
const shutdownVerificationMs = 1_000;

/** Track closure from spawn and stop the child and any process group it owns. */
export function createAppServerShutdown(child: ChildProcess, separateGroup: boolean) {
  let exited = false;
  let closing: Promise<void> | undefined;
  child.once("exit", () => {
    exited = true;
  });
  const closed = new Promise<void>((resolve) => {
    child.once("close", () => {
      exited = true;
      resolve();
    });
  });

  function kill(signal: NodeJS.Signals): void {
    const pid = child.pid;
    if (!pid || (!separateGroup && exited)) return;
    try {
      process.kill(separateGroup ? -pid : pid, signal);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
    }
  }

  async function closedBy(deadline: number): Promise<boolean> {
    const timer = new AbortController();
    try {
      return await Promise.race([
        closed.then(() => true),
        delay(Math.max(0, deadline - performance.now()), false, { signal: timer.signal }),
      ]);
    } finally {
      timer.abort();
    }
  }

  async function waitForGroupExit(groupId: number, deadline: number): Promise<void> {
    while (true) {
      try {
        process.kill(-groupId, 0);
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code === "ESRCH") return;
        if (code !== "EPERM") throw error;
      }
      if (performance.now() >= deadline)
        throw new Error(
          "Codex app-server process group did not stop before its shutdown deadline.",
        );
      await delay(20);
    }
  }

  async function stopProcess(): Promise<void> {
    child.stdin?.destroy();
    child.stdout?.destroy();
    child.stderr?.destroy();
    const graceDeadline = performance.now() + shutdownGraceMs;
    try {
      kill("SIGTERM");
      const closed = await closedBy(graceDeadline);
      const deadline = Math.min(graceDeadline, performance.now()) + shutdownVerificationMs;
      // An owned group may still contain workers after its leader has closed.
      if (!closed || separateGroup) kill("SIGKILL");
      if (!closed && !(await closedBy(deadline)))
        throw new Error("Codex app-server child did not close before its shutdown deadline.");
      if (separateGroup && child.pid) {
        await waitForGroupExit(child.pid, deadline);
      }
    } catch (error) {
      // A child whose exit we cannot confirm must not pin the caller's event loop.
      child.unref();
      throw error;
    }
  }

  return () => (closing ??= stopProcess());
}
