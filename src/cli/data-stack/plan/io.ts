import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { CliError } from "../../errors";
import { parseDataStackPlanArtifact } from "./parse";
import { serializeDataStackPlanArtifact } from "./serialize";
import type { DataStackPlanArtifact } from "./types";

export async function readDataStackPlanArtifact(path: string): Promise<DataStackPlanArtifact> {
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new CliError(`Failed to read data stack plan artifact: ${path} (${message})`, {
      code: "FILE_READ_ERROR",
      exitCode: 2,
    });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new CliError(`Invalid data stack plan artifact JSON: ${path} (${message})`, {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  return parseDataStackPlanArtifact(parsed);
}

export async function writeDataStackPlanArtifact(
  path: string,
  artifact: DataStackPlanArtifact,
  options: { overwrite?: boolean } = {},
): Promise<void> {
  const overwrite = options.overwrite ?? false;
  try {
    await stat(path);
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
    // Missing files are expected for new plan artifacts.
  }

  await mkdir(dirname(path), { recursive: true });
  try {
    await writeFile(path, serializeDataStackPlanArtifact(artifact), "utf8");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new CliError(`Failed to write file: ${path} (${message})`, {
      code: "FILE_WRITE_ERROR",
      exitCode: 2,
    });
  }
}
