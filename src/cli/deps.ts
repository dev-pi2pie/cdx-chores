import { CliError } from "./errors";
import { execCommand } from "./process";

export interface CommandStatus {
  name: string;
  available: boolean;
  version: string | null;
  installHint: string;
}

function installHintFor(command: "pandoc" | "ffmpeg", platform: NodeJS.Platform): string {
  if (platform === "darwin") {
    return command === "pandoc" ? "brew install pandoc" : "brew install ffmpeg";
  }

  if (platform === "win32") {
    return command === "pandoc"
      ? "Install via winget/choco (example: winget install --id JohnMacFarlane.Pandoc)"
      : "Install via winget/choco (example: winget install Gyan.FFmpeg)";
  }

  return command === "pandoc"
    ? "Install via your package manager (examples: apt/dnf/pacman) for pandoc"
    : "Install via your package manager (examples: apt/dnf/pacman) for ffmpeg";
}

function parseVersion(command: "pandoc" | "ffmpeg", output: string): string | null {
  const firstLine = output.split(/\r?\n/, 1)[0]?.trim() ?? "";
  if (!firstLine) {
    return null;
  }

  if (command === "pandoc") {
    const matched = firstLine.match(/^pandoc\s+([^\s]+)/i);
    return matched?.[1] ?? firstLine;
  }

  if (command === "ffmpeg") {
    const matched = firstLine.match(/^ffmpeg version\s+([^\s]+)/i);
    return matched?.[1] ?? firstLine;
  }

  return firstLine;
}

export async function inspectCommand(
  command: "pandoc" | "ffmpeg",
  platform: NodeJS.Platform,
): Promise<CommandStatus> {
  try {
    const result = await execCommand(command, command === "pandoc" ? ["--version"] : ["-version"]);
    return {
      name: command,
      available: result.ok,
      version: result.ok ? parseVersion(command, result.stdout || result.stderr) : null,
      installHint: installHintFor(command, platform),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/ENOENT/i.test(message)) {
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
  command: "pandoc" | "ffmpeg",
  platform: NodeJS.Platform,
): Promise<void> {
  const status = await inspectCommand(command, platform);
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

