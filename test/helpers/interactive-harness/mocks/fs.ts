import { mock } from "bun:test";

import type { HarnessRunnerContext } from "../context";

export function installFsPromiseMocks(context: HarnessRunnerContext): void {
  mock.module("node:fs/promises", () => ({
    rm: async (_path: unknown, _options: Record<string, unknown>) => {
      return undefined;
    },
    stat: async (inputPath: unknown) => {
      const resolvedPath = context.resolveHarnessPath(inputPath);
      if (context.existingPaths.has(resolvedPath)) {
        return {
          isDirectory: () => false,
          isFile: () => true,
        };
      }
      throw new Error("ENOENT");
    },
  }));
}
