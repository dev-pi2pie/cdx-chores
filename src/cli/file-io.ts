import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
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
    if (!overwrite) {
      await stat(path);
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
  try {
    await writeFile(path, content, "utf8");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new CliError(`Failed to write file: ${path} (${message})`, {
      code: "FILE_WRITE_ERROR",
      exitCode: 2,
    });
  }
}
