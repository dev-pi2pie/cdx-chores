import { stat } from "node:fs/promises";

import { ensureExistingFile } from "../actions/markdown/common";
import { CliError } from "../errors";
import { resolveFromCwd } from "../path-utils";
import type { CliRuntime } from "../types";

export function normalizeOptionalText(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

export function normalizeTextList(values: string[] | undefined): string[] {
  return (values ?? []).map((value) => value.trim()).filter((value) => value.length > 0);
}

export function resolveOptionalPath(
  runtime: CliRuntime,
  value: string | undefined,
): string | undefined {
  const normalized = normalizeOptionalText(value);
  return normalized ? resolveFromCwd(runtime, normalized) : undefined;
}

async function existingPathIdentity(path: string): Promise<{ dev: number; ino: number }> {
  const stats = await stat(path);
  return { dev: stats.dev, ino: stats.ino };
}

function samePathIdentity(
  left: { dev: number; ino: number },
  right: { dev: number; ino: number },
): boolean {
  return left.dev === right.dev && left.ino === right.ino;
}

export async function resolveOptionalMarkdownInputPath(
  runtime: CliRuntime,
  options: { input?: string; positionalInput?: string },
): Promise<string | undefined> {
  const resolvedOptionInput = resolveOptionalPath(runtime, options.input);
  const resolvedPositionalInput = resolveOptionalPath(runtime, options.positionalInput);

  if (resolvedOptionInput && resolvedPositionalInput) {
    await Promise.all([
      ensureExistingFile(resolvedOptionInput, "Markdown input"),
      ensureExistingFile(resolvedPositionalInput, "Markdown input"),
    ]);
    const [optionIdentity, positionalIdentity] = await Promise.all([
      existingPathIdentity(resolvedOptionInput),
      existingPathIdentity(resolvedPositionalInput),
    ]);
    if (!samePathIdentity(optionIdentity, positionalIdentity)) {
      throw new CliError("Positional input and --input must refer to the same Markdown file.", {
        code: "INVALID_INPUT",
        exitCode: 2,
      });
    }
  }

  const inputPath = resolvedOptionInput ?? resolvedPositionalInput;
  if (inputPath) {
    await ensureExistingFile(inputPath, "Markdown input");
  }
  return inputPath;
}
