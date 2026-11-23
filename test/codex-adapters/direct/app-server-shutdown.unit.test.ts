import { expect, mock, spyOn, test } from "bun:test";
import type { ChildProcess } from "node:child_process";
import { EventEmitter } from "node:events";

import { createAppServerShutdown } from "../../../src/adapters/codex/app-server-shutdown";

test.each([
  { denied: "SIGTERM", separateGroup: true },
  { denied: "SIGKILL", separateGroup: true },
  { denied: "SIGTERM", separateGroup: false },
] as const)(
  "verifies shutdown after $denied denial (separate group: $separateGroup)",
  async ({ denied, separateGroup }) => {
    const child = Object.assign(new EventEmitter(), { pid: 12345, unref: mock(() => {}) });
    const signals: Parameters<typeof process.kill>[1][] = [];
    let groupExited = false;
    const kill = spyOn(process, "kill").mockImplementation((pid, signal) => {
      expect(pid).toBe(separateGroup ? -child.pid : child.pid);
      signals.push(signal);
      if (signal === "SIGTERM") queueMicrotask(() => child.emit("close", 0, null));
      if (signal === denied) {
        queueMicrotask(() => {
          groupExited = true;
        });
        throw Object.assign(new Error("Signal denied."), { code: "EPERM" });
      }
      if (groupExited) throw Object.assign(new Error("Group gone."), { code: "ESRCH" });
      return true;
    });
    try {
      const shutdown = createAppServerShutdown(child as unknown as ChildProcess, separateGroup);
      await expect(shutdown()).resolves.toBeUndefined();
      if (separateGroup) {
        expect(signals.slice(0, 2)).toEqual(["SIGTERM", "SIGKILL"]);
        expect(signals.at(-1)).toBe(0);
        expect(groupExited).toBe(true);
      } else {
        expect(signals).toEqual(["SIGTERM"]);
      }
      expect(child.unref).not.toHaveBeenCalled();
    } finally {
      kill.mockRestore();
    }
  },
);

test("preserves the signal denial when a direct child never closes", async () => {
  const child = Object.assign(new EventEmitter(), { pid: 12345, unref: mock(() => {}) });
  const denial = Object.assign(new Error("Signal denied."), { code: "EPERM" });
  const kill = spyOn(process, "kill").mockImplementation(() => {
    throw denial;
  });
  try {
    const shutdown = createAppServerShutdown(child as unknown as ChildProcess, false);
    await expect(shutdown()).rejects.toBe(denial);
    expect(kill.mock.calls).toEqual([
      [child.pid, "SIGTERM"],
      [child.pid, "SIGKILL"],
    ]);
    expect(child.unref).toHaveBeenCalledTimes(1);
  } finally {
    kill.mockRestore();
  }
});
