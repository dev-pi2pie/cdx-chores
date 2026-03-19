import { Command } from "commander";

import { resolveCliColorEnabled } from "./cli/colors";
import { registerCliCommands } from "./cli/commands";
import { toCliError } from "./cli/errors";
import { runInteractiveMode } from "./cli/interactive";
import { getFormattedVersionLabel } from "./cli/program/version";
import type { CliRuntime, RunCliOptions } from "./cli/types";

interface NormalizedCliArgv {
  argv: string[];
  colorEnabled: boolean;
  displayPathStyle: CliRuntime["displayPathStyle"];
}

function createRuntime(options: RunCliOptions): CliRuntime {
  return {
    cwd: options.cwd ?? process.cwd(),
    colorEnabled: options.colorEnabled ?? true,
    now: options.now ?? (() => new Date()),
    platform: options.platform ?? process.platform,
    stdout: options.stdout ?? process.stdout,
    stderr: options.stderr ?? process.stderr,
    stdin: options.stdin ?? process.stdin,
    displayPathStyle: options.displayPathStyle ?? "relative",
  };
}

function normalizeCliArgv(argv: string[]): NormalizedCliArgv {
  const normalized = argv.slice(0, 2);
  let displayPathStyle: CliRuntime["displayPathStyle"] = "relative";
  let noColorFlag = false;

  for (const arg of argv.slice(2)) {
    if (arg === "--absolute" || arg === "--abs") {
      displayPathStyle = "absolute";
      continue;
    }

    if (arg === "--no-color") {
      noColorFlag = true;
      continue;
    }

    if (arg === "-V") {
      normalized.push("-v");
      continue;
    }

    normalized.push(arg);
  }

  return {
    argv: normalized,
    colorEnabled: resolveCliColorEnabled({ noColorFlag }),
    displayPathStyle,
  };
}

export async function runCli(
  argv: string[] = process.argv,
  runtime: RunCliOptions = {},
): Promise<void> {
  const normalized = normalizeCliArgv(argv);
  const cliRuntime = createRuntime(runtime);
  cliRuntime.colorEnabled = normalized.colorEnabled && (runtime.colorEnabled ?? true);
  cliRuntime.displayPathStyle = runtime.displayPathStyle ?? normalized.displayPathStyle;
  const args = normalized.argv.slice(2);

  if (args.length === 0) {
    if (!cliRuntime.stdin.isTTY) {
      cliRuntime.stderr.write(
        "No arguments provided and interactive mode requires a TTY. Use --help for commands.\n",
      );
      process.exitCode = 2;
      return;
    }

    try {
      await runInteractiveMode(cliRuntime);
    } catch (error) {
      const cliError = toCliError(error);
      cliRuntime.stderr.write(`${cliError.message}\n`);
      process.exitCode = cliError.exitCode;
    }
    return;
  }

  const program = new Command();
  program
    .name("cdx-chores")
    .description("CLI chores toolkit for file/media/document workflow helpers")
    .showHelpAfterError()
    .option("--absolute, --abs", "Show absolute paths in CLI output", false)
    .option("--no-color", "Disable ANSI colors", false)
    .version(getFormattedVersionLabel(cliRuntime.colorEnabled), "-v, --version", "Show version information");

  registerCliCommands(program, cliRuntime);

  try {
    await program.parseAsync(normalized.argv);
  } catch (error) {
    const cliError = toCliError(error);
    cliRuntime.stderr.write(`${cliError.message}\n`);
    process.exitCode = cliError.exitCode;
  }
}
