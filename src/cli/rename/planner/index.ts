import { lstat, readdir } from "node:fs/promises";
import { basename, dirname, extname, join } from "node:path";

import { CliError } from "../../errors";
import { resolveFromCwd } from "../../path-utils";
import { buildRenameUidBasename } from "../../rename-uid";
import { type RenameSerialOrder, type RenameSerialScope } from "../../rename-template";
import type { CliRuntime, PlannedRename, SkippedRenameItem } from "../../types";
import { slugifyName } from "../../../utils/slug";

import { collectBatchRenameEntries } from "./entries";
import { getPreparedRenamePattern, normalizePrefix } from "./pattern";
import { allocateUniqueRenamePath, renderBaseNameFromTemplate } from "./render";
import { buildSerialByPath, formatSerialValue } from "./serial";

export async function planBatchRename(
  runtime: CliRuntime,
  directoryInput: string,
  options: {
    prefix?: string;
    pattern?: string;
    serialOrder?: RenameSerialOrder;
    serialStart?: number;
    serialWidth?: number;
    serialScope?: RenameSerialScope;
    now?: Date;
    titleOverrides?: Map<string, string>;
    fileFilter?: (entryName: string) => boolean;
    recursive?: boolean;
    maxDepth?: number;
  } = {},
): Promise<{
  directoryPath: string;
  plans: PlannedRename[];
  skipped: SkippedRenameItem[];
}> {
  const directoryPath = resolveFromCwd(runtime, directoryInput);
  const recursive = options.recursive ?? false;
  const maxDepth = recursive ? (options.maxDepth ?? Number.POSITIVE_INFINITY) : 0;
  const { entries, preexistingBlockingPaths, skipped } = await collectBatchRenameEntries({
    directoryPath,
    titleOverrides: options.titleOverrides,
    fileFilter: options.fileFilter,
    recursive,
    maxDepth,
    fallbackDate: options.now ?? runtime.now(),
  });
  const prefix = normalizePrefix(options.prefix);
  const preparedPattern = getPreparedRenamePattern({
    pattern: options.pattern,
    serialOrder: options.serialOrder,
    serialStart: options.serialStart,
    serialWidth: options.serialWidth,
    serialScope: options.serialScope,
    recursive,
  });
  const serialByPath = preparedPattern.serial
    ? buildSerialByPath({
        entries,
        rootDirectoryPath: directoryPath,
        serial: preparedPattern.serial,
        recursive,
      })
    : undefined;
  const uidByPath = preparedPattern.usesUid
    ? new Map<string, string>(
        await Promise.all(
          entries.map(
            async (entry): Promise<[string, string]> => [
              entry.sourcePath,
              await buildRenameUidBasename(entry.sourcePath),
            ],
          ),
        ),
      )
    : undefined;

  const plans: PlannedRename[] = [];
  const plannedTargets = new Set(preexistingBlockingPaths);
  for (const entry of entries) {
    const baseName = renderBaseNameFromTemplate({
      template: preparedPattern.template,
      prefix,
      stem: entry.stemSlug,
      mtimeDate: entry.mtimeDate,
      serialText: serialByPath?.get(entry.sourcePath),
      uidText: uidByPath?.get(entry.sourcePath),
    });
    const candidatePath = allocateUniqueRenamePath({
      directoryPath: entry.directoryPath,
      baseName,
      ext: entry.ext,
      occupiedPaths: plannedTargets,
    });

    plannedTargets.add(candidatePath);
    plans.push({
      fromPath: entry.sourcePath,
      toPath: candidatePath,
      changed: entry.sourcePath !== candidatePath,
    });
  }

  return { directoryPath, plans, skipped };
}

export async function planSingleRename(
  runtime: CliRuntime,
  fileInput: string,
  options: {
    prefix?: string;
    pattern?: string;
    serialOrder?: RenameSerialOrder;
    serialStart?: number;
    serialWidth?: number;
    serialScope?: RenameSerialScope;
    now?: Date;
    titleOverride?: string;
  } = {},
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
  const prefix = normalizePrefix(options.prefix);
  const mtimeDate = sourceLstat.mtime ?? options.now ?? runtime.now();
  const preparedPattern = getPreparedRenamePattern({
    pattern: options.pattern,
    serialOrder: options.serialOrder,
    serialStart: options.serialStart,
    serialWidth: options.serialWidth,
    serialScope: options.serialScope,
    recursive: false,
  });
  const serialText = preparedPattern.serial
    ? formatSerialValue(preparedPattern.serial.start, preparedPattern.serial.width)
    : undefined;
  const uidText = preparedPattern.usesUid ? await buildRenameUidBasename(sourcePath) : undefined;
  const baseName = renderBaseNameFromTemplate({
    template: preparedPattern.template,
    prefix,
    stem: slug,
    mtimeDate,
    serialText,
    uidText,
  });
  const directoryEntries = await readdir(directoryPath, { withFileTypes: true });
  const occupiedPaths = new Set(
    directoryEntries
      .map((entry) => entry.name)
      .filter((entryName) => entryName !== currentName)
      .map((entryName) => join(directoryPath, entryName)),
  );
  const toPath = allocateUniqueRenamePath({
    directoryPath,
    baseName,
    ext,
    occupiedPaths,
  });

  return {
    directoryPath,
    plan: {
      fromPath: sourcePath,
      toPath,
      changed: sourcePath !== toPath,
    },
  };
}
