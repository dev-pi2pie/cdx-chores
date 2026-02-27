import { expect } from "bun:test";
import { rm } from "node:fs/promises";

import { CliError } from "../../src/cli/errors";
import { createCapturedRuntime } from "./cli-test-utils";

export function createActionTestRuntime(options?: Parameters<typeof createCapturedRuntime>[0]) {
  const captured = createCapturedRuntime(options);
  return {
    ...captured,
    expectNoStderr() {
      expect(captured.stderr.text).toBe("");
    },
    expectNoStdout() {
      expect(captured.stdout.text).toBe("");
    },
    expectNoOutput() {
      expect(captured.stdout.text).toBe("");
      expect(captured.stderr.text).toBe("");
    },
  };
}

export async function expectCliError(
  run: () => Promise<unknown>,
  expected: { code: string; exitCode?: number; messageIncludes?: string },
): Promise<CliError> {
  try {
    await run();
  } catch (error) {
    expect(error).toBeInstanceOf(CliError);
    const cliError = error as CliError;
    expect(cliError.code).toBe(expected.code);
    if (expected.exitCode !== undefined) {
      expect(cliError.exitCode).toBe(expected.exitCode);
    }
    if (expected.messageIncludes) {
      expect(cliError.message).toContain(expected.messageIncludes);
    }
    return cliError;
  }

  throw new Error("Expected CliError but action resolved successfully");
}

export async function removeIfPresent(path: string | undefined): Promise<void> {
  if (!path) {
    return;
  }
  await rm(path, { force: true });
}
