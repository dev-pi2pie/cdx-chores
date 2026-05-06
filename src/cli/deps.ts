import { CliError } from "./errors";
import { execCommand, type ExecCommandResult } from "./process";

type DependencyCommand = "pandoc" | "ffmpeg" | "weasyprint";
type DependencyCommandRunner = (
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
    parseVersion: (output) => {
      const infoVersion = output.match(/(?:^|\n)WeasyPrint(?:\s+version)?\s+([^\s]+)/i);
      if (infoVersion) {
        return infoVersion[1] ?? firstLine(output);
      }
      return parseFirstLineWithPattern(output, /^weasyprint(?:\s+version)?\s+([^\s]+)/i);
    },
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
): Promise<void> {
  const status = await inspectCommand(command, platform, runner);
  if (status.available) {
    return;
  }

  throw new CliError(
    `Missing required dependency: ${command}. Install suggestion: ${status.installHint}`,
    {
      code: "DEPENDENCY_MISSING",
      exitCode: 2,
    },
  );
}
