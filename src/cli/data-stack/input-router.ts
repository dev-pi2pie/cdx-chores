import { lstat, readdir } from "node:fs/promises";
import { basename, join, matchesGlob, relative } from "node:path";

import { CliError } from "../errors";
import { detectDataStackInputFormat, isSupportedDataStackDiscoveryPath } from "./formats";
import type { DataStackInputFormat } from "./types";

export interface DataStackNormalizedInputFile {
  format: DataStackInputFormat;
  path: string;
  sourceIndex: number;
  sourceKind: "directory" | "file";
  sourcePath: string;
}

export interface ResolveDataStackInputSourcesOptions {
  inputFormat?: DataStackInputFormat;
  maxDepth?: number;
  outputPath?: string;
  pattern?: string;
  recursive?: boolean;
  sources: string[];
}

function isHiddenName(name: string): boolean {
  return name.startsWith(".");
}

function matchesDirectoryPattern(relativePath: string, pattern: string): boolean {
  const normalized = relativePath.replaceAll("\\", "/");
  return matchesGlob(normalized, pattern) || matchesGlob(basename(normalized), pattern);
}

async function collectDirectoryCandidatePaths(options: {
  directoryPath: string;
  maxDepth?: number;
  outputPath?: string;
  pattern?: string;
  recursive?: boolean;
}): Promise<string[]> {
  const collected: string[] = [];

  async function walk(currentPath: string, depth: number): Promise<void> {
    const entries = await readdir(currentPath, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));

    for (const entry of entries) {
      if (isHiddenName(entry.name)) {
        continue;
      }

      const entryPath = join(currentPath, entry.name);
      if (entry.isDirectory()) {
        if ((options.recursive ?? false) && (options.maxDepth === undefined || depth < options.maxDepth)) {
          await walk(entryPath, depth + 1);
        }
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      if (options.outputPath && entryPath === options.outputPath) {
        continue;
      }

      const relativePath = relative(options.directoryPath, entryPath);
      if (options.pattern) {
        if (!matchesDirectoryPattern(relativePath, options.pattern)) {
          continue;
        }
      } else if (!isSupportedDataStackDiscoveryPath(entryPath)) {
        continue;
      }

      collected.push(entryPath);
    }
  }

  await walk(options.directoryPath, 0);
  return collected;
}

export async function resolveDataStackInputSources(
  options: ResolveDataStackInputSourcesOptions,
): Promise<{ files: DataStackNormalizedInputFile[] }> {
  if (options.maxDepth !== undefined && !(options.recursive ?? false)) {
    throw new CliError("--max-depth requires --recursive.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  const files: DataStackNormalizedInputFile[] = [];
  const seenPaths = new Set<string>();

  for (const [sourceIndex, sourcePath] of options.sources.entries()) {
    let sourceStats;
    try {
      sourceStats = await lstat(sourcePath);
    } catch {
      throw new CliError(`Input source not found: ${sourcePath}`, {
        code: "FILE_NOT_FOUND",
        exitCode: 2,
      });
    }

    if (sourceStats.isFile()) {
      if (seenPaths.has(sourcePath)) {
        continue;
      }

      files.push({
        format: detectDataStackInputFormat(sourcePath, options.inputFormat),
        path: sourcePath,
        sourceIndex,
        sourceKind: "file",
        sourcePath,
      });
      seenPaths.add(sourcePath);
      continue;
    }

    if (!sourceStats.isDirectory()) {
      throw new CliError(`Unsupported input source kind: ${sourcePath}. Use files or directories only.`, {
        code: "INVALID_INPUT",
        exitCode: 2,
      });
    }

    const candidatePaths = await collectDirectoryCandidatePaths({
      directoryPath: sourcePath,
      maxDepth: options.maxDepth,
      outputPath: options.outputPath,
      pattern: options.pattern,
      recursive: options.recursive,
    });

    for (const candidatePath of candidatePaths) {
      if (seenPaths.has(candidatePath)) {
        continue;
      }

      files.push({
        format: detectDataStackInputFormat(candidatePath, options.inputFormat),
        path: candidatePath,
        sourceIndex,
        sourceKind: "directory",
        sourcePath,
      });
      seenPaths.add(candidatePath);
    }
  }

  if (files.length === 0) {
    throw new CliError("No stackable input files matched the provided sources.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  return { files };
}
