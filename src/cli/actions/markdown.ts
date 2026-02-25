import { stat } from "node:fs/promises";

import { requireCommandAvailable } from "../deps";
import { CliError } from "../errors";
import { defaultOutputPath, resolveFromCwd } from "../fs-utils";
import { execCommand } from "../process";
import type { CliRuntime } from "../types";
import { assertNonEmpty, displayPath, ensureFileExists, printLine } from "./shared";

export interface MdToDocxOptions {
  input: string;
  output?: string;
  overwrite?: boolean;
}

export async function actionMdToDocx(runtime: CliRuntime, options: MdToDocxOptions): Promise<void> {
  const inputPath = resolveFromCwd(runtime, assertNonEmpty(options.input, "Input path"));
  const outputPath = resolveFromCwd(runtime, options.output?.trim() || defaultOutputPath(inputPath, ".docx"));
  await ensureFileExists(inputPath, "Input");
  await requireCommandAvailable("pandoc", runtime.platform);

  if (!options.overwrite) {
    try {
      await stat(outputPath);
      throw new CliError(`Output file already exists: ${outputPath}. Use --overwrite to replace it.`, {
        code: "OUTPUT_EXISTS",
        exitCode: 2,
      });
    } catch (error) {
      if (error instanceof CliError) {
        throw error;
      }
    }
  }

  const args = [inputPath, "-o", outputPath];
  const result = await execCommand("pandoc", args, { cwd: runtime.cwd });
  if (!result.ok) {
    throw new CliError(`pandoc failed (${result.code ?? "unknown"}): ${result.stderr || result.stdout}`.trim(), {
      code: "PROCESS_FAILED",
      exitCode: 1,
    });
  }

  printLine(runtime.stdout, `Wrote DOCX: ${displayPath(runtime, outputPath)}`);
}

