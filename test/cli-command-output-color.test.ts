import { describe, expect, test } from "bun:test";
import { Command } from "commander";

import { configureCliProgramOutput, styleCommanderErrorOutput } from "../src/cli/program/output";
import { getFormattedVersionLabel } from "../src/cli/program/version";
import type { CliRuntime } from "../src/cli/types";
import { createCapturedRuntime, runCli } from "./helpers/cli-test-utils";

const ANSI_PATTERN = new RegExp(String.raw`\u001B\[[0-9;]*m`, "g");

function setTty(stream: NodeJS.WritableStream, isTTY: boolean): void {
  (stream as NodeJS.WritableStream & { isTTY?: boolean }).isTTY = isTTY;
}

function createRuntime(options: {
  colorEnabled?: boolean;
  stderrIsTTY: boolean;
  stdoutIsTTY: boolean;
}): ReturnType<typeof createCapturedRuntime> {
  const captured = createCapturedRuntime({ colorEnabled: options.colorEnabled });
  setTty(captured.runtime.stdout, options.stdoutIsTTY);
  setTty(captured.runtime.stderr, options.stderrIsTTY);
  return captured;
}

function createProgram(runtime: CliRuntime): Command {
  const program = new Command();
  configureCliProgramOutput(program, runtime);
  program
    .name("cdx-chores")
    .description("CLI chores toolkit for file/media/document workflow helpers")
    .showHelpAfterError()
    .exitOverride()
    .version(getFormattedVersionLabel(runtime))
    .option("--known", "Known option");
  return program;
}

async function parseUnknownOption(runtime: CliRuntime): Promise<void> {
  const program = createProgram(runtime);
  await expect(program.parseAsync(["node", "cdx-chores", "--unknown"])).rejects.toMatchObject({
    code: "commander.unknownOption",
    exitCode: 1,
  });
}

describe("CLI Commander output presentation", () => {
  test("routes help to the injected stdout stream", () => {
    const { runtime, stdout, stderr } = createRuntime({
      stderrIsTTY: true,
      stdoutIsTTY: true,
    });
    const program = createProgram(runtime);

    program.outputHelp();

    expect(stdout.text).toContain("Usage: cdx-chores [options]");
    expect(stdout.text).toContain("--known");
    expect(stderr.text).toBe("");
  });

  test("uses injected stdout eligibility for version presentation", async () => {
    const eligible = createRuntime({ stderrIsTTY: false, stdoutIsTTY: true });
    await expect(
      createProgram(eligible.runtime).parseAsync(["node", "cdx-chores", "--version"]),
    ).rejects.toMatchObject({ code: "commander.version", exitCode: 0 });
    expect(eligible.stdout.text).toMatch(ANSI_PATTERN);

    const redirected = createRuntime({ stderrIsTTY: true, stdoutIsTTY: false });
    await expect(
      createProgram(redirected.runtime).parseAsync(["node", "cdx-chores", "--version"]),
    ).rejects.toMatchObject({ code: "commander.version", exitCode: 0 });
    expect(redirected.stdout.text).not.toMatch(ANSI_PATTERN);
    expect(redirected.stderr.text).toBe("");
  });

  test("routes parser errors and help-after-error to injected stderr", async () => {
    const { runtime, stdout, stderr } = createRuntime({
      stderrIsTTY: false,
      stdoutIsTTY: true,
    });

    await parseUnknownOption(runtime);

    expect(stdout.text).toBe("");
    expect(stderr.text).toStartWith("error: unknown option '--unknown'\n");
    expect(stderr.text).toContain("\n\nUsage: cdx-chores [options]");
    expect(stderr.text).toContain("Usage: cdx-chores [options]");
    expect(stderr.text).toContain("--known");
    expect(stderr.text).not.toMatch(ANSI_PATTERN);
  });

  test("bolds and colors only the leading parser error label on eligible stderr", async () => {
    const { runtime, stderr } = createRuntime({ stderrIsTTY: true, stdoutIsTTY: false });

    await parseUnknownOption(runtime);

    expect(stderr.text).toStartWith(
      "\u001b[1m\u001b[31merror:\u001b[39m\u001b[22m unknown option '--unknown'\n",
    );
    expect(stderr.text.replace(ANSI_PATTERN, "")).toStartWith(
      "error: unknown option '--unknown'\n",
    );
    expect(stderr.text.slice(stderr.text.indexOf(" unknown option"))).not.toMatch(ANSI_PATTERN);
  });

  test("keeps parser output plain when runtime color is disabled", async () => {
    const { runtime, stderr } = createRuntime({
      colorEnabled: false,
      stderrIsTTY: true,
      stdoutIsTTY: false,
    });

    await parseUnknownOption(runtime);

    expect(stderr.text).toStartWith("error: unknown option '--unknown'");
    expect(stderr.text).not.toMatch(ANSI_PATTERN);
  });

  test("leaves unexpected Commander output shapes unchanged", () => {
    const { runtime } = createRuntime({ stderrIsTTY: true, stdoutIsTTY: false });
    const unexpected = "Error: unexpected parser shape\n";

    expect(styleCommanderErrorOutput(runtime, unexpected)).toBe(unexpected);
  });

  test("keeps canonical root parser output and help plain when stderr is redirected", () => {
    const result = runCli(["--codex-timeout", "2m"]);

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toStartWith("error: unknown option '--codex-timeout'\n\n");
    expect(result.stderr).toContain("Usage: cdx-chores [options] [command]");
    expect(result.stderr).toContain("Commands:");
    expect(result.stderr).not.toMatch(ANSI_PATTERN);
  });

  test("respects NO_COLOR and --no-color for root parser errors", () => {
    const noColorEnv = runCli(["--codex-timeout", "2m"], undefined, { NO_COLOR: "1" });
    const noColorFlag = runCli(["--no-color", "--codex-timeout", "2m"]);

    expect(noColorEnv.exitCode).toBe(1);
    expect(noColorEnv.stderr).toStartWith("error: unknown option '--codex-timeout'");
    expect(noColorEnv.stderr).not.toMatch(ANSI_PATTERN);
    expect(noColorFlag.exitCode).toBe(1);
    expect(noColorFlag.stderr).toStartWith("error: unknown option '--codex-timeout'");
    expect(noColorFlag.stderr).not.toMatch(ANSI_PATTERN);
  });

  test("leaves non-Commander CLI errors unlabeled", () => {
    const result = runCli(["data", "stack", "missing-source.csv"]);

    expect(result.exitCode).toBe(2);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("--output is required for data stack runs.\n");
  });

  test("preserves no-argument non-TTY routing before Commander setup", () => {
    const result = runCli([]);

    expect(result.exitCode).toBe(2);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe(
      "No arguments provided and interactive mode requires a TTY. Use --help for commands.\n",
    );
  });
});
