import { requireCommandAvailable } from "../../deps";
import { CliError } from "../../errors";
import { defaultOutputPath, resolveFromCwd } from "../../path-utils";
import { execCommand, type ExecCommandResult } from "../../process";
import type { CliRuntime } from "../../types";
import { assertNonEmpty, displayPath, ensureFileExists, printLine } from "../shared";
import { ensureOutputDoesNotExist } from "./common";

type MdToDocxProcessRunner = (
  command: string,
  args: string[],
  options?: { cwd?: string },
) => Promise<ExecCommandResult>;

export interface MdToDocxOptions {
  input: string;
  output?: string;
  overwrite?: boolean;
  runner?: MdToDocxProcessRunner;
}

export async function actionMdToDocx(runtime: CliRuntime, options: MdToDocxOptions): Promise<void> {
  const inputPath = resolveFromCwd(runtime, assertNonEmpty(options.input, "Input path"));
  const outputPath = resolveFromCwd(
    runtime,
    options.output?.trim() || defaultOutputPath(inputPath, ".docx"),
  );
  await ensureFileExists(inputPath, "Input");
  const runner = options.runner ?? execCommand;
  await requireCommandAvailable("pandoc", runtime.platform, runner);
  await ensureOutputDoesNotExist(outputPath, options.overwrite);

  const args = [inputPath, "-o", outputPath];
  const result = await runner("pandoc", args, { cwd: runtime.cwd });
  if (!result.ok) {
    throw new CliError(
      `pandoc failed (${result.code ?? "unknown"}): ${result.stderr || result.stdout}`.trim(),
      {
        code: "PROCESS_FAILED",
        exitCode: 1,
      },
    );
  }

  printLine(runtime.stdout, `Wrote DOCX: ${displayPath(runtime, outputPath)}`);
}
