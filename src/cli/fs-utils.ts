import { mkdir, readFile, readdir, rename, stat, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join, relative, resolve } from "node:path";

import { CliError } from "./errors";
import type { CliRuntime, PlannedRename } from "./types";
import { formatUtcFileDateTime } from "../utils/datetime";
import { defaultOutputPath } from "../utils/paths";
import { slugifyName, withNumericSuffix } from "../utils/slug";

export { defaultOutputPath } from "../utils/paths";

export function resolveFromCwd(runtime: CliRuntime, filePath: string): string {
  return resolve(runtime.cwd, filePath);
}

export function formatPathForDisplay(runtime: CliRuntime, filePath: string): string {
  if (runtime.displayPathStyle === "absolute") {
    return filePath;
  }

  const relativePath = relative(runtime.cwd, filePath);
  return relativePath.length > 0 ? relativePath : ".";
}

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
    // ignore ENOENT and continue
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

export async function planBatchRename(
  runtime: CliRuntime,
  directoryInput: string,
  options: {
    prefix?: string;
    now?: Date;
    titleOverrides?: Map<string, string>;
    fileFilter?: (entryName: string) => boolean;
  } = {},
): Promise<{ directoryPath: string; plans: PlannedRename[] }> {
  const directoryPath = resolveFromCwd(runtime, directoryInput);
  const entries = await readdir(directoryPath, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => options.fileFilter?.(name) ?? true)
    .sort((a, b) => a.localeCompare(b));

  const prefix = slugifyName(options.prefix?.trim() || "file");
  const plannedTargets = new Set<string>();
  const sourcePaths = new Set<string>();
  const plans: PlannedRename[] = [];

  for (const name of files) {
    const sourcePath = join(directoryPath, name);
    sourcePaths.add(sourcePath);

    let fileStats;
    try {
      fileStats = await stat(sourcePath);
    } catch {
      continue;
    }

    const ext = extname(name).toLowerCase();
    const stem = basename(name, extname(name));
    const preferredTitle = options.titleOverrides?.get(sourcePath)?.trim();
    const slug = slugifyName(preferredTitle || stem).slice(0, 48);
    const dt = formatUtcFileDateTime(fileStats.mtime ?? options.now ?? runtime.now());

    let counter = 0;
    let candidatePath = "";
    while (true) {
      const nextName = `${withNumericSuffix(`${prefix}-${dt}-${slug}`, counter)}${ext}`;
      candidatePath = join(directoryPath, nextName);
      if (!plannedTargets.has(candidatePath)) {
        break;
      }
      counter += 1;
    }

    plannedTargets.add(candidatePath);
    plans.push({
      fromPath: sourcePath,
      toPath: candidatePath,
      changed: sourcePath !== candidatePath,
    });
  }

  return { directoryPath, plans };
}

export async function applyPlannedRenames(plans: PlannedRename[]): Promise<void> {
  const changes = plans.filter((plan) => plan.changed);
  if (changes.length === 0) {
    return;
  }

  const tempMoves: Array<{ tempPath: string; finalPath: string }> = [];

  let index = 0;
  for (const plan of changes) {
    const tempPath = `${plan.fromPath}.cdx-chores-tmp-${process.pid}-${index}`;
    await rename(plan.fromPath, tempPath);
    tempMoves.push({ tempPath, finalPath: plan.toPath });
    index += 1;
  }

  for (const move of tempMoves) {
    await rename(move.tempPath, move.finalPath);
  }
}
