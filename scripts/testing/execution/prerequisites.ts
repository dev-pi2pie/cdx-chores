import { fileURLToPath } from "node:url";

import { startOwnedProcess, type OwnedProcessOptions, type OwnedProcessResult } from "./process.ts";
import { SUITE_POLICIES } from "../suites/suite-policy.ts";
import type { Suite } from "../suites/selection.ts";

export interface SuitePreflightOptions {
  suite: Suite;
  repoRoot: string;
  bunExecutable: string;
  env: NodeJS.ProcessEnv;
  /** Explicit, read-only DuckDB cache source; never installed as the child's HOME. */
  sourceHome?: string;
  signal?: AbortSignal;
}

/** Internal dependency injection for bounded fixtures; never exposed as runner arguments. */
export interface PreflightLauncher {
  run(options: OwnedProcessOptions): Promise<OwnedProcessResult>;
}

export interface SuitePreflightResult {
  process: OwnedProcessResult;
  versions?: Record<string, string>;
  error?: string;
}

/** Version-only diagnostics cannot contain personal paths, terminal escapes or raw tool output. */
export function parsePreflightReport(
  stdout: string,
  suite: Suite,
): {
  versions?: Record<string, string>;
  error?: string;
} {
  try {
    const report: unknown = JSON.parse(stdout);
    if (!report || typeof report !== "object" || Array.isArray(report)) throw new Error();
    const value = report as Record<string, unknown>;
    if (value.schema !== 1 || value.suite !== suite) throw new Error();
    if (typeof value.error === "string") {
      // Only fixed identifiers from the declared registry may cross the boundary.
      if (!SUITE_POLICIES[suite].prerequisites.includes(value.error)) throw new Error();
      return { error: `Required prerequisite is unavailable: ${value.error}.` };
    }
    if (!value.versions || typeof value.versions !== "object" || Array.isArray(value.versions))
      throw new Error();
    const versions = value.versions as Record<string, unknown>;
    const keys = SUITE_POLICIES[suite].versionKeys;
    if (Object.keys(versions).length !== keys.length) throw new Error();
    for (const key of keys) {
      if (
        typeof versions[key] !== "string" ||
        !/^\d+(?:\.\d+)+(?:[-+][A-Za-z0-9.-]+)?$/.test(versions[key])
      )
        throw new Error();
    }
    return { versions: versions as Record<string, string> };
  } catch {
    return { error: "Prerequisite probe returned an invalid report." };
  }
}

/** Await verified process-group completion before allowing any test launch. */
export async function runSuitePreflight(
  options: SuitePreflightOptions,
  launcher: PreflightLauncher = { run: (value) => startOwnedProcess(value).completion },
): Promise<SuitePreflightResult> {
  const policy = SUITE_POLICIES[options.suite];
  const result = await launcher.run({
    executable: options.bunExecutable,
    args: [
      fileURLToPath(new URL("./prerequisite-probe.ts", import.meta.url)),
      options.suite,
      ...(options.suite === "app" && options.sourceHome ? [options.sourceHome] : []),
    ],
    cwd: options.repoRoot,
    env: { ...options.env },
    ...policy.preflight,
    signal: options.signal,
    maxOutputBytes: 64 * 1024,
  });
  const report = parsePreflightReport(result.stdout, options.suite);
  // Raw launch/native diagnostics may contain source-home paths. The owning
  // lifecycle's fixed issues and validated protocol preserve useful diagnostics.
  const process = { ...result, stdout: "", stderr: "" };
  if (!result.ok || !result.stopped) {
    const prerequisiteError = report.error?.startsWith("Required prerequisite is unavailable:")
      ? report.error
      : undefined;
    return { process, error: prerequisiteError ?? `Prerequisite probe failed (${result.reason}).` };
  }
  return { process, ...report };
}
