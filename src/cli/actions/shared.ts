import { stat } from "node:fs/promises";

import { CliError } from "../errors";
import { formatPathForDisplay } from "../path-utils";
import type { CliRuntime } from "../types";

export function printLine(stream: NodeJS.WritableStream, line = ""): void {
  stream.write(`${line}\n`);
}

export function displayPath(runtime: CliRuntime, path: string): string {
  return formatPathForDisplay(runtime, path);
}

export function assertNonEmpty(value: string | undefined, label: string): string {
  const next = value?.trim() ?? "";
  if (!next) {
    throw new CliError(`${label} is required.`, {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }
  return next;
}

export async function ensureFileExists(path: string, label: string): Promise<void> {
  try {
    const fileStats = await stat(path);
    if (!fileStats.isFile()) {
      throw new Error("not a file");
    }
  } catch {
    throw new CliError(`${label} file not found: ${path}`, {
      code: "FILE_NOT_FOUND",
      exitCode: 2,
    });
  }
}
