import { CodexAppServer } from "../../adapters/codex/app-server";
import { resolveDiscoveryExecutable } from "../../adapters/codex/discovery/executable";
import { isRecord } from "../../adapters/codex/discovery/transport";

const minimumVersion = "0.170.0";
const initializeTimeoutMs = 5_000;
const executableHint =
  "Install the Codex binary or set CDX_CHORES_CODEX_PATH to a working executable.";

export interface CodexBenchmarkPrerequisites {
  status: "met" | "unverified" | "failed";
  version: string | null;
  minimumVersion: string;
  detail: string;
}

function assessInitializedVersion(userAgent: unknown): CodexBenchmarkPrerequisites {
  const match =
    typeof userAgent === "string"
      ? /^[^/\s]+\/((\d+)\.(\d+)\.(\d+)(-[\w.-]+)?(?:\+[\w.-]+)?)(?:\s|$)/u.exec(userAgent)
      : null;
  if (!match) {
    return {
      status: "unverified",
      version: null,
      minimumVersion,
      detail: `App-server initialized but did not report a recognizable version. Use Codex ${minimumVersion} or newer.`,
    };
  }
  const [, version, major, minor, patch, prerelease] = match;
  const actual = [Number(major), Number(minor), Number(patch)];
  const minimum = minimumVersion.split(".").map(Number);
  const difference = actual.map((part, index) => part - (minimum[index] ?? 0)).find(Boolean) ?? 0;
  const met =
    actual.every(Number.isSafeInteger) && (difference > 0 || (difference === 0 && !prerelease));
  return {
    status: met ? "met" : "unverified",
    version: version ?? null,
    minimumVersion,
    detail: met
      ? "Local app-server initialization succeeded."
      : `App-server initialized. Use Codex ${minimumVersion} or newer to verify version support.`,
  };
}

export async function inspectCodexBenchmark(
  cwd: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<CodexBenchmarkPrerequisites> {
  const serverEnv = { ...env };
  let executable: string;
  try {
    executable = resolveDiscoveryExecutable(serverEnv);
  } catch {
    return { status: "failed", version: null, minimumVersion, detail: executableHint };
  }

  let server: CodexAppServer | undefined;
  let readiness: CodexBenchmarkPrerequisites;
  try {
    server = new CodexAppServer(executable, cwd, serverEnv);
    const result = await server.initialize(initializeTimeoutMs);
    if (!isRecord(result)) throw new Error("Invalid app-server initialization response.");
    readiness = assessInitializedVersion(result.userAgent);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    readiness = {
      status: "failed",
      version: null,
      minimumVersion,
      detail:
        code === "ENOENT" || code === "ENOTDIR" || code === "EACCES"
          ? executableHint
          : "App-server initialization failed. Run the selected Codex executable with `app-server` to diagnose startup.",
    };
  }
  try {
    await server?.close();
  } catch {
    const detail =
      "App-server shutdown failed. Check whether the selected Codex process is still running.";
    return {
      ...readiness,
      status: "failed",
      detail: readiness.status === "failed" ? readiness.detail + " " + detail : detail,
    };
  }
  return readiness;
}
