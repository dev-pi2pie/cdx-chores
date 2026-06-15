import { constants } from "node:fs";
import { lstat, mkdir, open, readFile } from "node:fs/promises";
import { dirname } from "node:path";

import { CliError } from "./errors";

export async function readTextFileRequired(path: string): Promise<string> {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new CliError(`Failed to read file: ${path} (${message})`, {
      code: "FILE_READ_ERROR",
      exitCode: 2,
    });
  }
}

export async function ensureParentDir(path: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
}

export async function writeTextFileSafe(
  path: string,
  content: string,
  options: { overwrite?: boolean } = {},
): Promise<void> {
  const overwrite = options.overwrite ?? false;
  try {
    const outputStats = await lstat(path);
    if (outputStats.isSymbolicLink()) {
      throw new CliError(`Output path is a symlink and cannot be written safely: ${path}`, {
        code: "OUTPUT_SYMLINK",
        exitCode: 2,
      });
    }
    if (!overwrite) {
      throw new CliError(`Output file already exists: ${path}. Use --overwrite to replace it.`, {
        code: "OUTPUT_EXISTS",
        exitCode: 2,
      });
    }
  } catch (error) {
    if (error instanceof CliError) {
      throw error;
    }
  }

  await ensureParentDir(path);
  const noFollow = constants.O_NOFOLLOW ?? 0;
  const flags = overwrite
    ? constants.O_WRONLY | constants.O_CREAT | constants.O_TRUNC | noFollow
    : constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | noFollow;
  let handle;
  try {
    handle = await open(path, flags, 0o666);
    await handle.writeFile(content, "utf8");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new CliError(`Failed to write file: ${path} (${message})`, {
      code: "FILE_WRITE_ERROR",
      exitCode: 2,
    });
  } finally {
    await handle?.close();
  }
}
