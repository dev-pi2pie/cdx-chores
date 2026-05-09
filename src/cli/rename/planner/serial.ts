import { relative } from "node:path";

import type { RenameSerialOrder } from "../../rename-template";

import type { RenameCandidateEntry } from "./entries";
import type { PreparedRenamePattern } from "./pattern";

function compareEntriesBySerialOrder(
  a: RenameCandidateEntry,
  b: RenameCandidateEntry,
  rootDirectoryPath: string,
  order: RenameSerialOrder,
): number {
  const pathA = relative(rootDirectoryPath, a.sourcePath);
  const pathB = relative(rootDirectoryPath, b.sourcePath);

  if (order === "path_asc") {
    return pathA.localeCompare(pathB);
  }

  if (order === "path_desc") {
    return pathB.localeCompare(pathA);
  }

  const delta = a.mtimeMs - b.mtimeMs;
  if (delta !== 0) {
    return order === "mtime_asc" ? delta : -delta;
  }

  return pathA.localeCompare(pathB);
}

export function formatSerialValue(value: number, width?: number): string {
  const resolvedWidth = Math.max(width ?? 0, String(Math.max(value, 0)).length);
  return String(value).padStart(resolvedWidth, "0");
}

export function buildSerialByPath(options: {
  entries: RenameCandidateEntry[];
  rootDirectoryPath: string;
  serial: NonNullable<PreparedRenamePattern["serial"]>;
  recursive: boolean;
}): Map<string, string> {
  const groups = new Map<string, RenameCandidateEntry[]>();
  for (const entry of options.entries) {
    const key =
      options.serial.scope === "directory" && options.recursive
        ? entry.directoryPath
        : "__global__";
    const current = groups.get(key);
    if (current) {
      current.push(entry);
    } else {
      groups.set(key, [entry]);
    }
  }

  const serialByPath = new Map<string, string>();
  for (const groupEntries of groups.values()) {
    const sorted = [...groupEntries].sort((a, b) =>
      compareEntriesBySerialOrder(a, b, options.rootDirectoryPath, options.serial.order),
    );
    const maxSerialValue = options.serial.start + sorted.length - 1;
    const computedWidth = String(Math.max(maxSerialValue, 0)).length;
    const width = Math.max(options.serial.width ?? 0, computedWidth);

    for (let index = 0; index < sorted.length; index += 1) {
      const entry = sorted[index];
      if (!entry) {
        continue;
      }

      const serialValue = options.serial.start + index;
      serialByPath.set(entry.sourcePath, formatSerialValue(serialValue, width));
    }
  }

  return serialByPath;
}
