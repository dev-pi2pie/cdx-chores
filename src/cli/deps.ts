import { CliError } from "./errors";
import { execCommand, type ExecCommandResult } from "./process";

export type DependencyCommand = "pandoc" | "ffmpeg" | "weasyprint" | "fc-list" | "fc-query";
export type DependencyCommandRunner = (
  command: string,
  args: string[],
  options?: { cwd?: string },
) => Promise<ExecCommandResult>;
type DependencyProbe = {
  args: string[];
  output: (result: ExecCommandResult) => string;
};
type DependencyDescriptor = {
  installHints: Partial<Record<NodeJS.Platform, string>> & { default: string };
  probes: DependencyProbe[];
  parseVersion: (output: string) => string | null;
};

export interface CommandStatus {
  name: string;
  available: boolean;
  version: string | null;
  installHint: string;
}

export type CommandVersionRequirementStatus =
  | "satisfied"
  | "missing"
  | "unsupported"
  | "unverified";

export interface CommandVersionRequirement {
  status: CommandVersionRequirementStatus;
  available: boolean;
  version: string | null;
  minimumVersion: string;
}

function firstLine(output: string): string {
  return output.split(/\r?\n/, 1)[0]?.trim() ?? "";
}

function parseFirstLineWithPattern(output: string, pattern: RegExp): string | null {
  const line = firstLine(output);
  if (!line) {
    return null;
  }
  const matched = line.match(pattern);
  return matched?.[1] ?? line;
}

const commandOutput = (result: ExecCommandResult) => result.stdout || result.stderr;

function parseWeasyPrintVersion(output: string): string | null {
  const directVersion = output.match(/(?:^|\n)\s*WeasyPrint\s+version:?\s+([^\s]+)/i);
  if (directVersion) {
    return directVersion[1] ?? firstLine(output);
  }

  const infoVersion = output.match(/(?:^|\n)\s*Version:\s*([^\s]+)/i);
  if (infoVersion) {
    return infoVersion[1] ?? firstLine(output);
  }

  return parseFirstLineWithPattern(output, /^weasyprint\s+([^\s:]+)/i);
}

function parseFontconfigVersion(output: string): string | null {
  return parseFirstLineWithPattern(output, /^fontconfig\s+version\s+([^\s]+)/i);
}

const DEPENDENCIES: Record<DependencyCommand, DependencyDescriptor> = {
  pandoc: {
    installHints: {
      darwin: "brew install pandoc",
      win32: "Install via winget/choco (example: winget install --id JohnMacFarlane.Pandoc)",
      default: "Install via your package manager (examples: apt/dnf/pacman) for pandoc",
    },
    probes: [{ args: ["--version"], output: commandOutput }],
    parseVersion: (output) => parseFirstLineWithPattern(output, /^pandoc\s+([^\s]+)/i),
  },
  ffmpeg: {
    installHints: {
      darwin: "brew install ffmpeg",
      win32: "Install via winget/choco (example: winget install Gyan.FFmpeg)",
      default: "Install via your package manager (examples: apt/dnf/pacman) for ffmpeg",
    },
    probes: [{ args: ["-version"], output: commandOutput }],
    parseVersion: (output) => parseFirstLineWithPattern(output, /^ffmpeg version\s+([^\s]+)/i),
  },
  weasyprint: {
    installHints: {
      darwin: "brew install weasyprint",
      win32:
        "Install WeasyPrint with pipx or pip, then ensure platform rendering libraries are available",
      default:
        "Install WeasyPrint via your package manager or pipx, including platform rendering libraries",
    },
    probes: [
      { args: ["--info"], output: commandOutput },
      { args: ["--version"], output: commandOutput },
    ],
    parseVersion: parseWeasyPrintVersion,
  },
  "fc-list": {
    installHints: {
      darwin: "brew install fontconfig",
      win32: "Install fontconfig and ensure fc-list is on PATH",
      default: "Install fontconfig via your package manager",
    },
    probes: [{ args: ["--version"], output: commandOutput }],
    parseVersion: parseFontconfigVersion,
  },
  "fc-query": {
    installHints: {
      darwin: "brew install fontconfig",
      win32: "Install fontconfig and ensure fc-query is on PATH",
      default: "Install fontconfig via your package manager",
    },
    probes: [{ args: ["--version"], output: commandOutput }],
    parseVersion: parseFontconfigVersion,
  },
};

function installHintFor(command: DependencyCommand, platform: NodeJS.Platform): string {
  const descriptor = DEPENDENCIES[command];
  return descriptor.installHints[platform] ?? descriptor.installHints.default;
}

async function probeDependency(
  command: DependencyCommand,
  runner: DependencyCommandRunner,
): Promise<{ ok: boolean; output: string }> {
  const descriptor = DEPENDENCIES[command];
  let lastOutput = "";

  for (const probe of descriptor.probes) {
    const result = await runner(command, probe.args);
    const output = probe.output(result);
    if (result.ok) {
      return { ok: true, output };
    }
    lastOutput = output;
  }

  return { ok: false, output: lastOutput };
}

export async function inspectCommand(
  command: DependencyCommand,
  platform: NodeJS.Platform,
  runner: DependencyCommandRunner = execCommand,
): Promise<CommandStatus> {
  try {
    const result = await probeDependency(command, runner);
    return {
      name: command,
      available: result.ok,
      version: result.ok ? DEPENDENCIES[command].parseVersion(result.output) : null,
      installHint: installHintFor(command, platform),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/ENOENT|not found/i.test(message)) {
      return {
        name: command,
        available: false,
        version: null,
        installHint: installHintFor(command, platform),
      };
    }
    throw new CliError(`Failed to inspect dependency '${command}': ${message}`, {
      code: "DEPENDENCY_CHECK_FAILED",
      exitCode: 2,
    });
  }
}

export async function requireCommandAvailable(
  command: DependencyCommand,
  platform: NodeJS.Platform,
  runner: DependencyCommandRunner = execCommand,
): Promise<CommandStatus> {
  const status = await inspectCommand(command, platform, runner);
  if (status.available) {
    return status;
  }

  throw new CliError(
    `Missing required dependency: ${command}. Install suggestion: ${status.installHint}`,
    {
      code: "DEPENDENCY_MISSING",
      exitCode: 2,
    },
  );
}

function parseDottedNumericVersion(version: string): number[] | null {
  if (!/^\d+(?:\.\d+)*$/u.test(version)) {
    return null;
  }

  const components = version.split(".").map(Number);
  return components.every((component) => Number.isSafeInteger(component)) ? components : null;
}

function compareDottedNumericVersions(actual: number[], minimum: number[]): number {
  const componentCount = Math.max(actual.length, minimum.length);
  for (let index = 0; index < componentCount; index += 1) {
    const actualComponent = actual[index] ?? 0;
    const minimumComponent = minimum[index] ?? 0;
    if (actualComponent !== minimumComponent) {
      return actualComponent > minimumComponent ? 1 : -1;
    }
  }
  return 0;
}

export function assessCommandMinimumVersion(
  status: CommandStatus,
  minimumVersion: string,
): CommandVersionRequirement {
  if (!status.available) {
    return {
      status: "missing",
      available: false,
      version: null,
      minimumVersion,
    };
  }

  const actual = status.version ? parseDottedNumericVersion(status.version) : null;
  const minimum = parseDottedNumericVersion(minimumVersion);
  if (!actual || !minimum) {
    return {
      status: "unverified",
      available: true,
      version: status.version,
      minimumVersion,
    };
  }

  return {
    status: compareDottedNumericVersions(actual, minimum) >= 0 ? "satisfied" : "unsupported",
    available: true,
    version: status.version,
    minimumVersion,
  };
}

export function requireCommandMinimumVersion(
  status: CommandStatus,
  minimumVersion: string,
  capability: string,
): void {
  const requirement = assessCommandMinimumVersion(status, minimumVersion);
  if (requirement.status === "satisfied") {
    return;
  }

  if (requirement.status === "unsupported") {
    throw new CliError(
      `Unsupported dependency version: ${status.name} ${requirement.version}. ${capability} requires ${status.name} ${minimumVersion} or newer.`,
      {
        code: "DEPENDENCY_VERSION_UNSUPPORTED",
        exitCode: 2,
      },
    );
  }

  if (requirement.status === "unverified") {
    const detected = requirement.version ? ` Detected output: ${requirement.version}.` : "";
    throw new CliError(
      `Unable to verify the ${status.name} version.${detected} ${capability} requires ${status.name} ${minimumVersion} or newer.`,
      {
        code: "DEPENDENCY_VERSION_UNKNOWN",
        exitCode: 2,
      },
    );
  }

  throw new CliError(
    `Missing required dependency: ${status.name}. Install suggestion: ${status.installHint}`,
    {
      code: "DEPENDENCY_MISSING",
      exitCode: 2,
    },
  );
}
