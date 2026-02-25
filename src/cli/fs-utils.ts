import { lstat, mkdir, readFile, readdir, rename, stat, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join, relative, resolve } from "node:path";

import { CliError } from "./errors";
import type { CliRuntime, PlannedRename, SkippedRenameItem } from "./types";
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
    recursive?: boolean;
    maxDepth?: number;
  } = {},
): Promise<{ directoryPath: string; plans: PlannedRename[]; skipped: SkippedRenameItem[] }> {
  const directoryPath = resolveFromCwd(runtime, directoryInput);
  const skipped: SkippedRenameItem[] = [];
  const files: Array<{ directoryPath: string; name: string }> = [];
  const recursive = options.recursive ?? false;
  const maxDepth = recursive ? (options.maxDepth ?? Number.POSITIVE_INFINITY) : 0;

  const visitDirectory = async (currentDirectoryPath: string, depth: number): Promise<void> => {
    const entries = await readdir(currentDirectoryPath, { withFileTypes: true });
    const sortedEntries = [...entries].sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of sortedEntries) {
      const entryPath = join(currentDirectoryPath, entry.name);

      if (entry.isSymbolicLink()) {
        skipped.push({ path: entryPath, reason: "symlink" });
        continue;
      }

      if (entry.isDirectory()) {
        if (recursive && depth < maxDepth) {
          await visitDirectory(entryPath, depth + 1);
        }
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      if (!(options.fileFilter?.(entry.name) ?? true)) {
        continue;
      }

      files.push({ directoryPath: currentDirectoryPath, name: entry.name });
    }
  };

  await visitDirectory(directoryPath, 0);

  const prefix = slugifyName(options.prefix?.trim() || "file");
  const plannedTargets = new Set<string>();
  const plans: PlannedRename[] = [];

  for (const file of files) {
    const sourcePath = join(file.directoryPath, file.name);

    let fileStats;
    try {
      fileStats = await stat(sourcePath);
    } catch {
      continue;
    }

    const ext = extname(file.name).toLowerCase();
    const stem = basename(file.name, extname(file.name));
    const preferredTitle = options.titleOverrides?.get(sourcePath)?.trim();
    const slug = slugifyName(preferredTitle || stem).slice(0, 48);
    const dt = formatUtcFileDateTime(fileStats.mtime ?? options.now ?? runtime.now());

    let counter = 0;
    let candidatePath = "";
    while (true) {
      const nextName = `${withNumericSuffix(`${prefix}-${dt}-${slug}`, counter)}${ext}`;
      candidatePath = join(file.directoryPath, nextName);
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

  return { directoryPath, plans, skipped };
}

export async function planSingleRename(
  runtime: CliRuntime,
  fileInput: string,
  options: { prefix?: string; now?: Date; titleOverride?: string } = {},
): Promise<{ directoryPath: string; plan: PlannedRename }> {
  const sourcePath = resolveFromCwd(runtime, fileInput);

  let sourceLstat;
  try {
    sourceLstat = await lstat(sourcePath);
  } catch {
    throw new CliError(`Input file not found: ${sourcePath}`, {
      code: "FILE_NOT_FOUND",
      exitCode: 2,
    });
  }

  if (sourceLstat.isSymbolicLink()) {
    throw new CliError(`Symlink inputs are not supported for rename file: ${sourcePath}`, {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  if (!sourceLstat.isFile()) {
    throw new CliError(`Input file not found: ${sourcePath}`, {
      code: "FILE_NOT_FOUND",
      exitCode: 2,
    });
  }

  const directoryPath = dirname(sourcePath);
  const currentName = basename(sourcePath);
  const ext = extname(currentName).toLowerCase();
  const stem = basename(currentName, extname(currentName));
  const preferredTitle = options.titleOverride?.trim();
  const slug = slugifyName(preferredTitle || stem).slice(0, 48);
  const prefix = slugifyName(options.prefix?.trim() || "file");
  const dt = formatUtcFileDateTime(sourceLstat.mtime ?? options.now ?? runtime.now());

  const entries = await readdir(directoryPath, { withFileTypes: true });
  const occupiedNames = new Set(
    entries.map((entry) => entry.name).filter((entryName) => entryName !== currentName),
  );

  let counter = 0;
  let nextName = currentName;
  while (true) {
    nextName = `${withNumericSuffix(`${prefix}-${dt}-${slug}`, counter)}${ext}`;
    if (!occupiedNames.has(nextName)) {
      break;
    }
    counter += 1;
  }

  const toPath = join(directoryPath, nextName);
  return {
    directoryPath,
    plan: {
      fromPath: sourcePath,
      toPath,
      changed: sourcePath !== toPath,
    },
  };
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
