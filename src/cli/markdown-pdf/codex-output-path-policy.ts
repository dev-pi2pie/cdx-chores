import { lstat, readdir } from "node:fs/promises";

import { isNotFoundError } from "../actions/markdown/common";
import { CliError } from "../errors";

export async function assertUsableCodexOutputDirectory(
  outputDirectory: string,
  options: {
    allowExistingContents?: boolean;
    failedInspectLabel: string;
    kindLabel: string;
    overwrite?: boolean;
    replacementLabel: string;
  },
): Promise<"existing" | "missing"> {
  try {
    const stats = await lstat(outputDirectory);
    if (stats.isSymbolicLink()) {
      throw new CliError(`${options.kindLabel} output directory is a symlink: ${outputDirectory}`, {
        code: "OUTPUT_SYMLINK",
        exitCode: 2,
      });
    }
    if (!stats.isDirectory()) {
      throw new CliError(
        `${options.kindLabel} output path is not a directory: ${outputDirectory}`,
        {
          code: "INVALID_INPUT",
          exitCode: 2,
        },
      );
    }
    if (!options.overwrite && !options.allowExistingContents) {
      const entries = await readdir(outputDirectory);
      if (entries.length > 0) {
        throw new CliError(
          `${options.kindLabel} output directory is not empty: ${outputDirectory}. Use --overwrite to replace ${options.replacementLabel}.`,
          {
            code: "OUTPUT_EXISTS",
            exitCode: 2,
          },
        );
      }
    }
    return "existing";
  } catch (error) {
    if (error instanceof CliError) {
      throw error;
    }
    if (isNotFoundError(error)) {
      return "missing";
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new CliError(
      `Failed to inspect ${options.failedInspectLabel}: ${outputDirectory} (${message})`,
      {
        code: "FILE_READ_ERROR",
        exitCode: 2,
      },
    );
  }
}

export async function assertWritableCodexPlannedFile(
  file: { path: string },
  options: { label: string; overwrite?: boolean },
): Promise<void> {
  try {
    const stats = await lstat(file.path);
    if (stats.isSymbolicLink()) {
      throw new CliError(
        `${options.label} is a symlink and cannot be written safely: ${file.path}`,
        {
          code: "OUTPUT_SYMLINK",
          exitCode: 2,
        },
      );
    }
    if (stats.isDirectory()) {
      throw new CliError(`${options.label} is a directory: ${file.path}`, {
        code: "INVALID_INPUT",
        exitCode: 2,
      });
    }
    if (!options.overwrite) {
      throw new CliError(
        `${options.label} already exists: ${file.path}. Use --overwrite to replace it.`,
        {
          code: "OUTPUT_EXISTS",
          exitCode: 2,
        },
      );
    }
  } catch (error) {
    if (error instanceof CliError) {
      throw error;
    }
    if (isNotFoundError(error)) {
      return;
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new CliError(`Failed to inspect ${options.label}: ${file.path} (${message})`, {
      code: "FILE_READ_ERROR",
      exitCode: 2,
    });
  }
}
