import { expect } from "bun:test";
import { readdir, rm } from "node:fs/promises";
import { join } from "node:path";

import { CliError } from "../../src/cli/errors";
import { createCapturedRuntime, REPO_ROOT } from "./cli-test-utils";

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

export async function captureRenamePlanCsvSnapshot(): Promise<Set<string>> {
  const entries = await readdir(REPO_ROOT, { withFileTypes: true });
  return new Set(
    entries
      .filter((entry) => entry.isFile() && /^rename-\d{8}-\d{6}-[a-f0-9]{8}\.csv$/.test(entry.name))
      .map((entry) => join(REPO_ROOT, entry.name)),
  );
}

export async function cleanupRenamePlanCsvSinceSnapshot(snapshot: Set<string>): Promise<void> {
  const current = await captureRenamePlanCsvSnapshot();
  for (const path of current) {
    if (!snapshot.has(path)) {
      await rm(path, { force: true });
    }
  }
}
