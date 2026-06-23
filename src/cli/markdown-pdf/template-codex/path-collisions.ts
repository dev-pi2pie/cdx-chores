import { lstat, readdir, stat } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";

import { CliError } from "../../errors";
import { isNotFoundError } from "../../actions/markdown/common";

export function sameResolvedPath(left: string | undefined, right: string | undefined): boolean {
  return Boolean(left && right && resolve(left) === resolve(right));
}

export function assertPathInsideDirectory(input: {
  directory: string;
  directoryLabel: string;
  path: string;
  pathLabel: string;
}): void {
  const relativePath = relative(input.directory, input.path);
  if (relativePath.length > 0 && !relativePath.startsWith("..") && !isAbsolute(relativePath)) {
    return;
  }
  throw new CliError(`${input.pathLabel} must be inside ${input.directoryLabel}.`, {
    code: "INVALID_INPUT",
    exitCode: 2,
  });
}

async function existingPathIdentity(
  path: string | undefined,
): Promise<{ dev: number; ino: number } | undefined> {
  if (!path) {
    return undefined;
  }
  try {
    const stats = await stat(path);
    return { dev: stats.dev, ino: stats.ino };
  } catch (error) {
    if (isNotFoundError(error)) {
      return undefined;
    }
    throw error;
  }
}

function samePathIdentity(
  left: { dev: number; ino: number } | undefined,
  right: { dev: number; ino: number } | undefined,
): boolean {
  return Boolean(left && right && left.dev === right.dev && left.ino === right.ino);
}

export function assertDifferentResolvedPaths(input: {
  left: string | undefined;
  leftLabel: string;
  right: string | undefined;
  rightLabel: string;
}): void {
  if (!sameResolvedPath(input.left, input.right)) {
    return;
  }
  throw new CliError(`${input.leftLabel} cannot be the same path as ${input.rightLabel}.`, {
    code: "INVALID_INPUT",
    exitCode: 2,
  });
}

export async function assertDifferentExistingFiles(input: {
  left: string | undefined;
  leftLabel: string;
  right: string | undefined;
  rightLabel: string;
}): Promise<void> {
  const [leftIdentity, rightIdentity] = await Promise.all([
    existingPathIdentity(input.left),
    existingPathIdentity(input.right),
  ]);
  if (!samePathIdentity(leftIdentity, rightIdentity)) {
    return;
  }
  throw new CliError(`${input.leftLabel} cannot be the same file as ${input.rightLabel}.`, {
    code: "INVALID_INPUT",
    exitCode: 2,
  });
}

export async function assertDistinctPathPairs(
  pairs: Array<{
    left: string | undefined;
    leftLabel: string;
    right: string | undefined;
    rightLabel: string;
  }>,
): Promise<void> {
  for (const pair of pairs) {
    assertDifferentResolvedPaths(pair);
    await assertDifferentExistingFiles(pair);
  }
}

export async function assertUsableTemplateCodexOutputDirectory(
  outputDirectory: string,
  options: { overwrite?: boolean },
): Promise<"existing" | "missing"> {
  try {
    const stats = await lstat(outputDirectory);
    if (stats.isSymbolicLink()) {
      throw new CliError(`Template output directory is a symlink: ${outputDirectory}`, {
        code: "OUTPUT_SYMLINK",
        exitCode: 2,
      });
    }
    if (!stats.isDirectory()) {
      throw new CliError(`Template output path is not a directory: ${outputDirectory}`, {
        code: "INVALID_INPUT",
        exitCode: 2,
      });
    }
    if (!options.overwrite) {
      const entries = await readdir(outputDirectory);
      if (entries.length > 0) {
        throw new CliError(
          `Template output directory is not empty: ${outputDirectory}. Use --overwrite to replace recipe files.`,
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
      `Failed to inspect template output directory: ${outputDirectory} (${message})`,
      {
        code: "FILE_READ_ERROR",
        exitCode: 2,
      },
    );
  }
}
