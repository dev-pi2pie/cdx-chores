import { lstat } from "node:fs/promises";

import { resolveFromCwd } from "../../fs-utils";
import { CliError } from "../../errors";
import type { CliRuntime } from "../../types";

export type RenameCleanupPathKind = "file" | "directory";

export interface RenameCleanupPathTarget {
  kind: RenameCleanupPathKind;
  path: string;
}

export async function resolveRenameCleanupTarget(
  runtime: CliRuntime,
  inputPath: string,
): Promise<RenameCleanupPathTarget> {
  const resolvedPath = resolveFromCwd(runtime, inputPath);

  let pathStats;
  try {
    pathStats = await lstat(resolvedPath);
  } catch {
    throw new CliError(`Cleanup path not found: ${resolvedPath}`, {
      code: "FILE_NOT_FOUND",
      exitCode: 2,
    });
  }

  if (pathStats.isSymbolicLink()) {
    throw new CliError(`Symlink inputs are not supported for rename cleanup: ${resolvedPath}`, {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  if (pathStats.isFile()) {
    return { kind: "file", path: resolvedPath };
  }
  if (pathStats.isDirectory()) {
    return { kind: "directory", path: resolvedPath };
  }

  throw new CliError(`Cleanup path must be a file or directory: ${resolvedPath}`, {
    code: "INVALID_INPUT",
    exitCode: 2,
  });
}
