import { readdir, stat } from "node:fs/promises";
import { basename, extname, join } from "node:path";

import type { SkippedRenameItem } from "../../types";
import { slugifyName } from "../../../utils/slug";

export interface RenameCandidateEntry {
  sourcePath: string;
  directoryPath: string;
  ext: string;
  stemSlug: string;
  mtimeDate: Date;
  mtimeMs: number;
}

interface CollectBatchRenameEntriesOptions {
  directoryPath: string;
  titleOverrides?: Map<string, string>;
  fileFilter?: (entryName: string) => boolean;
  recursive: boolean;
  maxDepth: number;
  fallbackDate: Date;
}

export async function collectBatchRenameEntries(
  options: CollectBatchRenameEntriesOptions,
): Promise<{
  entries: RenameCandidateEntry[];
  preexistingBlockingPaths: Set<string>;
  skipped: SkippedRenameItem[];
}> {
  const skipped: SkippedRenameItem[] = [];
  const files: Array<{ directoryPath: string; name: string }> = [];
  const preexistingBlockingPaths = new Set<string>();

  const visitDirectory = async (currentDirectoryPath: string, depth: number): Promise<void> => {
    const directoryEntries = await readdir(currentDirectoryPath, { withFileTypes: true });
    const sortedEntries = [...directoryEntries].sort((a, b) => a.name.localeCompare(b.name));

    for (const directoryEntry of sortedEntries) {
      const entryPath = join(currentDirectoryPath, directoryEntry.name);

      if (directoryEntry.isSymbolicLink()) {
        preexistingBlockingPaths.add(entryPath);
        skipped.push({ path: entryPath, reason: "symlink" });
        continue;
      }

      if (directoryEntry.isDirectory()) {
        preexistingBlockingPaths.add(entryPath);
        if (options.recursive && depth < options.maxDepth) {
          await visitDirectory(entryPath, depth + 1);
        }
        continue;
      }

      if (!directoryEntry.isFile()) {
        preexistingBlockingPaths.add(entryPath);
        continue;
      }

      if (!(options.fileFilter?.(directoryEntry.name) ?? true)) {
        preexistingBlockingPaths.add(entryPath);
        continue;
      }

      files.push({ directoryPath: currentDirectoryPath, name: directoryEntry.name });
    }
  };

  await visitDirectory(options.directoryPath, 0);

  const entries: RenameCandidateEntry[] = [];
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
    const stemSlug = slugifyName(preferredTitle || stem).slice(0, 48);
    const mtimeDate = fileStats.mtime ?? options.fallbackDate;
    entries.push({
      sourcePath,
      directoryPath: file.directoryPath,
      ext,
      stemSlug,
      mtimeDate,
      mtimeMs: mtimeDate.getTime(),
    });
  }

  return { entries, preexistingBlockingPaths, skipped };
}
