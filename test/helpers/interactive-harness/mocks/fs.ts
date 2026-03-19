import { mock } from "bun:test";

import type { HarnessRunnerContext } from "../context";

export function installFsPromiseMocks(_context: HarnessRunnerContext): void {
  mock.module("node:fs/promises", () => ({
    rm: async (_path: unknown, _options: Record<string, unknown>) => {
      return undefined;
    },
    stat: async (_path: unknown) => {
      throw new Error("ENOENT");
    },
  }));
}
