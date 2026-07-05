import { lstat, readdir } from "node:fs/promises";

import { isNotFoundError } from "../actions/markdown/common";
import { CliError } from "../errors";
import { assertNoSymlinkPathParents } from "../file-io";

export async function assertUsableCodexOutputDirectory(
  outputDirectory: string,
  options: {
    allowExistingContents?: boolean;
    displayPath?: (path: string) => string;
    failedInspectLabel: string;
    kindLabel: string;
    overwrite?: boolean;
    parentRootDirectory?: string;
    replacementLabel: string;
    sanitizeMessage?: (message: string) => string;
  },
): Promise<"existing" | "missing"> {
  await assertNoSymlinkPathParents({
    displayPath: options.displayPath,
    label: `${options.kindLabel} output directory`,
    parentRootDirectory: options.parentRootDirectory,
    path: outputDirectory,
    sanitizeMessage: options.sanitizeMessage,
  });
  const displayOutputDirectory = options.displayPath?.(outputDirectory) ?? outputDirectory;
  try {
    const stats = await lstat(outputDirectory);
    if (stats.isSymbolicLink()) {
      throw new CliError(
        `${options.kindLabel} output directory is a symlink: ${displayOutputDirectory}`,
        {
          code: "OUTPUT_SYMLINK",
          exitCode: 2,
        },
      );
    }
    if (!stats.isDirectory()) {
      throw new CliError(
        `${options.kindLabel} output path is not a directory: ${displayOutputDirectory}`,
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
          `${options.kindLabel} output directory is not empty: ${displayOutputDirectory}. Use --overwrite to replace ${options.replacementLabel}.`,
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
      `Failed to inspect ${options.failedInspectLabel}: ${displayOutputDirectory} (${options.sanitizeMessage?.(message) ?? message})`,
      {
        code: "FILE_READ_ERROR",
        exitCode: 2,
      },
    );
  }
}

export async function assertWritableCodexPlannedFile(
  file: { path: string },
  options: {
    displayPath?: (path: string) => string;
    label: string;
    overwrite?: boolean;
    parentRootDirectory?: string;
    sanitizeMessage?: (message: string) => string;
  },
): Promise<void> {
  await assertNoSymlinkPathParents({
    displayPath: options.displayPath,
    label: options.label,
    parentRootDirectory: options.parentRootDirectory,
    path: file.path,
    sanitizeMessage: options.sanitizeMessage,
  });
  const displayFilePath = options.displayPath?.(file.path) ?? file.path;
  try {
    const stats = await lstat(file.path);
    if (stats.isSymbolicLink()) {
      throw new CliError(
        `${options.label} is a symlink and cannot be written safely: ${displayFilePath}`,
        {
          code: "OUTPUT_SYMLINK",
          exitCode: 2,
        },
      );
    }
    if (stats.isDirectory()) {
      throw new CliError(`${options.label} is a directory: ${displayFilePath}`, {
        code: "INVALID_INPUT",
        exitCode: 2,
      });
    }
    if (!options.overwrite) {
      throw new CliError(
        `${options.label} already exists: ${displayFilePath}. Use --overwrite to replace it.`,
        {
          code: "OUTPUT_EXISTS",
          exitCode: 2,
        },
      );
    }
    if (stats.nlink > 1) {
      throw new CliError(
        `${options.label} is hard-linked and cannot be overwritten safely: ${displayFilePath}`,
        {
          code: "INVALID_INPUT",
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
    throw new CliError(
      `Failed to inspect ${options.label}: ${displayFilePath} (${options.sanitizeMessage?.(message) ?? message})`,
      {
        code: "FILE_READ_ERROR",
        exitCode: 2,
      },
    );
  }
}
