import { stat } from "node:fs/promises";

import { CliError } from "../../errors";
import type { NormalizeMarkdownPdfOptionsInput } from "../../markdown-pdf";

export function isNotFoundError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "ENOENT"
  );
}

export async function ensureOutputDoesNotExist(
  path: string,
  overwrite: boolean | undefined,
): Promise<void> {
  if (overwrite) {
    return;
  }

  try {
    await stat(path);
    throw new CliError(`Output file already exists: ${path}. Use --overwrite to replace it.`, {
      code: "OUTPUT_EXISTS",
      exitCode: 2,
    });
  } catch (error) {
    if (error instanceof CliError) {
      throw error;
    }
    if (isNotFoundError(error)) {
      return;
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new CliError(`Failed to inspect output file: ${path} (${message})`, {
      code: "FILE_READ_ERROR",
      exitCode: 2,
    });
  }
}

export function definedRecipeOptions(
  input: NormalizeMarkdownPdfOptionsInput,
): NormalizeMarkdownPdfOptionsInput {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  ) as NormalizeMarkdownPdfOptionsInput;
}

export async function ensureExistingFile(path: string, label: string): Promise<void> {
  let stats: Awaited<ReturnType<typeof stat>>;
  try {
    stats = await stat(path);
  } catch (error) {
    if (isNotFoundError(error)) {
      throw new CliError(`${label} file not found: ${path}`, {
        code: "FILE_NOT_FOUND",
        exitCode: 2,
      });
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new CliError(`Failed to inspect ${label.toLowerCase()} file: ${path} (${message})`, {
      code: "FILE_READ_ERROR",
      exitCode: 2,
    });
  }

  if (!stats.isFile()) {
    throw new CliError(`${label} path is not a file: ${path}`, {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }
}
