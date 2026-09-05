import { fileURLToPath } from "node:url";

import { type OwnedProcessOptions } from "../../scripts/testing/process.ts";

import { startFixtureProcess } from "../../scripts/testing/fixture-process.ts";

export type NativeRequirement = "duckdb" | "excel" | "sqlite";
export type NativeReadiness = Record<NativeRequirement, boolean>;

/** Test seam permits bounded synthetic child programs without loading native code. */
export async function probeNativePrerequisites(
  overrides: Partial<OwnedProcessOptions> = {},
): Promise<NativeReadiness> {
  const result = await startFixtureProcess({
    executable: process.execPath,
    args: [fileURLToPath(new URL("./native-prerequisite-probe.ts", import.meta.url))],
    cwd: fileURLToPath(new URL("../..", import.meta.url)),
    // Preserve the same existing DuckDB cache as the consuming integration test.
    // No Codex configuration, credentials, or arbitrary loader options are inherited.
    env: { PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR },
    timeoutMs: 2500,
    graceMs: 250,
    cleanupMs: 1500,
    maxOutputBytes: 4096,
    ...overrides,
  }).completion;
  if (!result.ok) {
    throw new Error(
      `Native prerequisite probe failed: ${JSON.stringify({
        reason: result.reason,
        groupId: result.groupId,
        exitCode: result.exitCode,
        signal: result.signal,
        stopped: result.stopped,
        issues: result.issues,
      })}`,
    );
  }
  let value: unknown;
  try {
    value = JSON.parse(result.stdout);
  } catch {
    throw new Error("Native prerequisite probe returned an invalid readiness report.");
  }
  if (
    typeof value !== "object" ||
    value === null ||
    !["duckdb", "excel", "sqlite"].every(
      (key) => typeof (value as Record<string, unknown>)[key] === "boolean",
    )
  ) {
    throw new Error("Native prerequisite probe returned an invalid readiness report.");
  }
  return value as NativeReadiness;
}

export function createNativePrerequisiteCheck(probe = probeNativePrerequisites) {
  let readiness: Promise<NativeReadiness> | undefined;
  return async (requirement: NativeRequirement): Promise<void> => {
    readiness ??= probe();
    const available = await readiness;
    if (!available.duckdb || !available[requirement]) {
      throw new Error(
        `Required native prerequisite unavailable: ${!available.duckdb ? "duckdb" : requirement}. ` +
          "Integration coverage requires the installed runtime and existing extension cache; no installation was attempted.",
      );
    }
  };
}

/** Only integration consumers call this; importing support never probes prerequisites. */
export const requireNativePrerequisites = createNativePrerequisiteCheck();
