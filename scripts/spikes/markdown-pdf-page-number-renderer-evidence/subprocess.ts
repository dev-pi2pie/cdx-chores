import { spawnSync } from "node:child_process";
import { devNull } from "node:os";
import { basename } from "node:path";

import type {
  CommandRequest,
  CommandResult,
  CommandRunner,
  EvidenceFailure,
  EvidenceStage,
} from "./contract";
import { commandTimeoutMs, maximumOutputBytes, repoRoot } from "./contract";

export function safeSubprocessEnvironment(pathPrefix?: string): NodeJS.ProcessEnv {
  const delimiter = process.platform === "win32" ? ";" : ":";
  const inheritedKeys = [
    "COMSPEC",
    "DYLD_FALLBACK_LIBRARY_PATH",
    "LANG",
    "LC_ALL",
    "LD_LIBRARY_PATH",
    "REQUESTS_CA_BUNDLE",
    "SSL_CERT_DIR",
    "SSL_CERT_FILE",
    "SYSTEMROOT",
    "TMPDIR",
    "WINDIR",
  ] as const;
  const environment: NodeJS.ProcessEnv = {
    PATH: pathPrefix
      ? `${pathPrefix}${delimiter}${process.env.PATH ?? ""}`
      : (process.env.PATH ?? ""),
    PIP_CONFIG_FILE: devNull,
    PIP_DISABLE_PIP_VERSION_CHECK: "1",
    PIP_NO_INPUT: "1",
    PYTHONNOUSERSITE: "1",
  };
  for (const key of inheritedKeys) {
    if (process.env[key] !== undefined) environment[key] = process.env[key];
  }
  return environment;
}

function truncateOutput(value: string): { value: string; truncated: boolean } {
  const bytes = Buffer.from(value);
  if (bytes.byteLength <= maximumOutputBytes) return { value, truncated: false };
  return {
    value: Buffer.from(bytes.subarray(0, maximumOutputBytes)).toString("utf8"),
    truncated: true,
  };
}

export const defaultCommandRunner: CommandRunner = async (request) => {
  const executable = request.argv[0];
  if (!executable) throw new Error("Command request must include an executable.");
  const result = spawnSync(executable, request.argv.slice(1), {
    cwd: request.cwd,
    env: request.env,
    encoding: "utf8",
    timeout: request.timeoutMs,
    maxBuffer: request.maximumOutputBytes,
    windowsHide: true,
  });
  const stdout = truncateOutput(result.stdout ?? "");
  const stderr = truncateOutput(result.stderr ?? "");
  return {
    exitCode: result.status,
    stdout: stdout.value,
    stderr: stderr.value,
    errorCode: (result.error as NodeJS.ErrnoException | undefined)?.code,
    timedOut: result.error?.name === "ETIMEDOUT",
    outputTruncated:
      stdout.truncated ||
      stderr.truncated ||
      (result.error as NodeJS.ErrnoException | undefined)?.code === "ENOBUFS",
  };
};

export function commandRequest(
  stage: EvidenceStage,
  argv: readonly string[],
  input: Partial<Pick<CommandRequest, "candidateId" | "scenarioId" | "env">> = {},
): CommandRequest {
  return {
    argv,
    cwd: repoRoot,
    timeoutMs: commandTimeoutMs,
    maximumOutputBytes,
    stage,
    env: safeSubprocessEnvironment(),
    ...input,
  };
}

function commandFailure(
  request: CommandRequest,
  result: CommandResult,
): EvidenceFailure | undefined {
  if (result.exitCode === 0 && !result.timedOut && !result.outputTruncated) return undefined;
  const detail = `${result.stderr}\n${result.stdout}`;
  let classification: EvidenceFailure["classification"];
  if (["EACCES", "ENOENT", "ENOEXEC"].includes(result.errorCode ?? "")) {
    classification = "executable-launch-failure";
  } else if (/fontconfig|font discovery|fontconfig error|no fonts?/iu.test(detail)) {
    classification = "font-discovery-failure";
  } else if (/pango|cairo|gobject|harfbuzz|native librar/iu.test(detail)) {
    classification = "native-library-failure";
  } else if (request.stage === "dependency-install" || request.stage === "environment-inspection") {
    classification = "dependency-failure";
  } else if (request.stage === "contract-render") {
    classification = "contract-failure";
  } else if (
    request.stage === "doctor" ||
    request.stage === "actual-launch" ||
    request.stage === "png-render"
  ) {
    classification = "executable-launch-failure";
  } else {
    classification = "setup-failure";
  }
  const condition = result.timedOut
    ? "timed out"
    : result.outputTruncated
      ? "exceeded bounded output"
      : `exited ${result.exitCode ?? "without status"}`;
  return {
    stage: request.stage,
    classification,
    candidateId: request.candidateId,
    scenarioId: request.scenarioId,
    message: `${basename(request.argv[0] ?? "command")} ${condition}`,
  };
}

export async function runChecked(
  runner: CommandRunner,
  request: CommandRequest,
): Promise<{ result: CommandResult; failure?: EvidenceFailure }> {
  let result: CommandResult;
  try {
    result = await runner(request);
  } catch (error) {
    const commandError = error as NodeJS.ErrnoException;
    result = {
      exitCode: null,
      stdout: "",
      stderr: error instanceof Error ? error.message : String(error),
      errorCode: commandError.code,
    };
  }
  return { result, failure: commandFailure(request, result) };
}

export function environmentExecutable(environmentDirectory: string, command: string): string {
  return process.platform === "win32"
    ? `${environmentDirectory}/Scripts/${command}.exe`
    : `${environmentDirectory}/bin/${command}`;
}

export function candidateEnvironmentScript(): string {
  return [
    "import json, platform",
    "import fontTools, pydyf, weasyprint",
    "from weasyprint.text.ffi import pango",
    "print(json.dumps({",
    '  "python": platform.python_version(),',
    '  "weasyprint": weasyprint.__version__,',
    '  "pydyf": pydyf.__version__,',
    '  "fontTools": fontTools.__version__,',
    '  "pango": ".".join(str(part) for part in (lambda value: (value // 10000, (value // 100) % 100, value % 100))(pango.pango_version())),',
    "}, sort_keys=True))",
  ].join("\n");
}
