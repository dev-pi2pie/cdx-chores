import { lstatSync } from "node:fs";

import { mock } from "bun:test";

import type { HarnessRunnerContext } from "../context";

export function installFsPromiseMocks(context: HarnessRunnerContext): void {
  mock.module("node:fs/promises", () => ({
    rm: async (path: unknown, _options: Record<string, unknown>) => {
      context.recordRemovedPath(String(path));
      return undefined;
    },
    lstat: async (inputPath: unknown) => lstatSync(context.resolveHarnessPath(inputPath)),
    stat: async (inputPath: unknown) => {
      const resolvedPath = context.resolveHarnessPath(inputPath);
      const statExists =
        context.existingPaths.has(resolvedPath) ||
        (context.statExistsQueue.length > 0 ? context.statExistsQueue.shift() === true : false);
      if (statExists) {
        return {
          isDirectory: () => false,
          isFile: () => true,
        };
      }
      throw new Error("ENOENT");
    },
  }));
}
