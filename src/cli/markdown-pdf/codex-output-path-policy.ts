import { lstat, readdir } from "node:fs/promises";
import { dirname, isAbsolute, join, parse, relative, resolve, sep } from "node:path";

import { isNotFoundError } from "../actions/markdown/common";
import { CliError } from "../errors";

function isInsideDirectory(input: { directory: string; path: string }): boolean {
  const relativePath = relative(input.directory, input.path);
  return relativePath.length === 0 || (!relativePath.startsWith("..") && !isAbsolute(relativePath));
}

async function assertNoSymlinkParentSegments(input: {
  label: string;
  parentRootDirectory?: string;
  path: string;
}): Promise<void> {
  const absolutePath = resolve(input.path);
  const parentDirectory = dirname(absolutePath);
  const preferredRoot = input.parentRootDirectory ? resolve(input.parentRootDirectory) : undefined;
  const root =
    preferredRoot && isInsideDirectory({ directory: preferredRoot, path: parentDirectory })
      ? preferredRoot
      : parse(parentDirectory).root;
  const relativeParentDirectory = relative(root, parentDirectory);

  let currentPath = root;
  for (const segment of ["", ...relativeParentDirectory.split(sep).filter(Boolean)]) {
    if (segment) {
      currentPath = join(currentPath, segment);
    }
    try {
      const stats = await lstat(currentPath);
      if (stats.isSymbolicLink()) {
        throw new CliError(
          `${input.label} parent directory is a symlink and cannot be written safely: ${currentPath}`,
          {
            code: "OUTPUT_SYMLINK",
            exitCode: 2,
          },
        );
      }
      if (!stats.isDirectory()) {
        throw new CliError(`${input.label} parent path is not a directory: ${currentPath}`, {
          code: "INVALID_INPUT",
          exitCode: 2,
        });
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
        `Failed to inspect ${input.label} parent path: ${currentPath} (${message})`,
        {
          code: "FILE_READ_ERROR",
          exitCode: 2,
        },
      );
    }
  }
}

export async function assertUsableCodexOutputDirectory(
  outputDirectory: string,
  options: {
    allowExistingContents?: boolean;
    failedInspectLabel: string;
    kindLabel: string;
    overwrite?: boolean;
    parentRootDirectory?: string;
    replacementLabel: string;
  },
): Promise<"existing" | "missing"> {
  await assertNoSymlinkParentSegments({
    label: `${options.kindLabel} output directory`,
    parentRootDirectory: options.parentRootDirectory,
    path: outputDirectory,
  });
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
  options: { label: string; overwrite?: boolean; parentRootDirectory?: string },
): Promise<void> {
  await assertNoSymlinkParentSegments({
    label: options.label,
    parentRootDirectory: options.parentRootDirectory,
    path: file.path,
  });
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
    if (stats.nlink > 1) {
      throw new CliError(
        `${options.label} is hard-linked and cannot be overwritten safely: ${file.path}`,
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
    throw new CliError(`Failed to inspect ${options.label}: ${file.path} (${message})`, {
      code: "FILE_READ_ERROR",
      exitCode: 2,
    });
  }
}
