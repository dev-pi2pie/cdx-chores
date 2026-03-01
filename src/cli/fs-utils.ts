import { lstat, mkdir, readFile, readdir, rename, stat, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join, relative, resolve } from "node:path";

import { CliError } from "./errors";
import {
  type RenameSerialOrder,
  type RenameSerialScope,
  normalizeSerialPlaceholderInTemplate,
  parseSerialToken,
} from "./rename-template";
import type { CliRuntime, PlannedRename, SkippedRenameItem } from "./types";
import {
  formatLocalFileDateTime,
  formatLocalFileDateTime12Hour,
  formatLocalFileDateTimeISO,
  formatUtcFileDateTime,
  formatUtcFileDateTime12Hour,
  formatUtcFileDateTimeISO,
} from "../utils/datetime";
import { defaultOutputPath } from "../utils/paths";
import { slugifyName, withNumericSuffix } from "../utils/slug";

export { defaultOutputPath } from "../utils/paths";

const RENAME_TEMPLATE_DEFAULT = "{prefix}-{timestamp}-{stem}";
const RENAME_TEMPLATE_TOKEN_PATTERN = /\{([^{}]+)\}/g;
const RENAME_TEMPLATE_SIMPLE_TOKENS = new Set([
  "prefix",
  "timestamp",
  "timestamp_local",
  "timestamp_utc",
  "timestamp_local_iso",
  "timestamp_utc_iso",
  "timestamp_local_12h",
  "timestamp_utc_12h",
  "date",
  "date_local",
  "date_utc",
  "stem",
]);

interface RenamePatternOptions {
  pattern?: string;
  serialOrder?: RenameSerialOrder;
  serialStart?: number;
  serialWidth?: number;
  serialScope?: RenameSerialScope;
  recursive?: boolean;
}

interface PreparedRenamePattern {
  template: string;
  serial?: {
    order: RenameSerialOrder;
    start: number;
    width?: number;
    scope: RenameSerialScope;
  };
}

interface RenameCandidateEntry {
  sourcePath: string;
  directoryPath: string;
  currentName: string;
  ext: string;
  stemSlug: string;
  mtimeDate: Date;
  mtimeMs: number;
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatUtcDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizePrefix(prefix: string | undefined): string {
  const trimmed = (prefix ?? "").trim();
  if (!trimmed) {
    return "";
  }
  return slugifyName(trimmed);
}

function ensureValidTemplateBraces(template: string): void {
  let inToken = false;
  for (const char of template) {
    if (char === "{") {
      if (inToken) {
        throw new CliError("Invalid --pattern: nested '{' is not supported.", {
          code: "INVALID_INPUT",
          exitCode: 2,
        });
      }
      inToken = true;
      continue;
    }
    if (char === "}") {
      if (!inToken) {
        throw new CliError("Invalid --pattern: unmatched '}' found.", {
          code: "INVALID_INPUT",
          exitCode: 2,
        });
      }
      inToken = false;
    }
  }
  if (inToken) {
    throw new CliError("Invalid --pattern: missing closing '}'.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }
}

function parseTemplateTokens(template: string): string[] {
  const tokens: string[] = [];
  for (const match of template.matchAll(RENAME_TEMPLATE_TOKEN_PATTERN)) {
    const token = (match[1] ?? "").trim();
    if (!token) {
      throw new CliError("Invalid --pattern: empty placeholder '{}'.", {
        code: "INVALID_INPUT",
        exitCode: 2,
      });
    }
    tokens.push(token);
  }
  return tokens;
}

function getPreparedRenamePattern(options: RenamePatternOptions): PreparedRenamePattern {
  const template = (options.pattern ?? RENAME_TEMPLATE_DEFAULT).trim();
  if (!template) {
    throw new CliError("Invalid --pattern: template cannot be empty.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  ensureValidTemplateBraces(template);
  const tokens = parseTemplateTokens(template);

  const serialTokens = tokens.filter((token) => token === "serial" || token.startsWith("serial_"));
  if (serialTokens.length > 1) {
    throw new CliError(
      "Invalid --pattern: only one {serial...} placeholder is supported per template.",
      {
        code: "INVALID_INPUT",
        exitCode: 2,
      },
    );
  }
  let serial:
    | {
        order: RenameSerialOrder;
        start: number;
        width?: number;
        scope: RenameSerialScope;
      }
    | undefined;
  let normalizedTemplate = template;

  if (serialTokens.length > 0) {
    let parsed;
    try {
      parsed = parseSerialToken(serialTokens[0] ?? "serial");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new CliError(`Invalid --pattern serial token: ${message}`, {
        code: "INVALID_INPUT",
        exitCode: 2,
      });
    }

    const start = options.serialStart ?? parsed.start;
    if (!Number.isInteger(start) || start < 0) {
      throw new CliError("Invalid --serial-start: must be a non-negative integer.", {
        code: "INVALID_INPUT",
        exitCode: 2,
      });
    }

    const width = options.serialWidth ?? parsed.width;
    if (width !== undefined && (!Number.isInteger(width) || width <= 0)) {
      throw new CliError("Invalid --serial-width: must be a positive integer.", {
        code: "INVALID_INPUT",
        exitCode: 2,
      });
    }

    const order = options.serialOrder ?? parsed.order;
    const scope = options.serialScope ?? "global";

    serial = { order, start, width, scope };
    normalizedTemplate = normalizeSerialPlaceholderInTemplate({
      template,
      serial: {
        order: serial.order,
        start: serial.start,
        width: serial.width,
      },
      includeDefaults: true,
    });
  }

  const normalizedTokens = parseTemplateTokens(normalizedTemplate);
  for (const token of normalizedTokens) {
    if (RENAME_TEMPLATE_SIMPLE_TOKENS.has(token)) {
      continue;
    }
    if (token === "serial" || token.startsWith("serial_")) {
      try {
        parseSerialToken(token);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new CliError(`Invalid --pattern serial token: ${message}`, {
          code: "INVALID_INPUT",
          exitCode: 2,
        });
      }
      continue;
    }
    throw new CliError(
      `Invalid --pattern placeholder: {${token}}. Allowed placeholders: {prefix}, {timestamp}, {timestamp_local}, {timestamp_utc}, {timestamp_local_iso}, {timestamp_utc_iso}, {timestamp_local_12h}, {timestamp_utc_12h}, {date}, {date_local}, {date_utc}, {stem}, {serial...}.`,
      {
        code: "INVALID_INPUT",
        exitCode: 2,
      },
    );
  }

  return { template: normalizedTemplate, serial };
}

function normalizeRenderedBaseName(value: string, fallback = "file"): string {
  const sanitized = value
    .replace(/[\p{Cc}<>:"/\\|?*]/gu, "-")
    .replace(/\s+/g, " ")
    .replace(/--+/g, "-")
    .replace(/__+/g, "_")
    .replace(/-_+/g, "-")
    .replace(/_-+/g, "-")
    .replace(/^[-_.\s]+|[-_.\s]+$/g, "");
  return sanitized || fallback;
}

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

function buildSerialByPath(options: {
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
      const serialText = String(serialValue).padStart(width, "0");
      serialByPath.set(entry.sourcePath, serialText);
    }
  }

  return serialByPath;
}

function renderBaseNameFromTemplate(options: {
  template: string;
  prefix: string;
  stem: string;
  mtimeDate: Date;
  serialText?: string;
}): string {
  const timestampUtc = formatUtcFileDateTime(options.mtimeDate);
  const timestampLocal = formatLocalFileDateTime(options.mtimeDate);
  const timestampUtcIso = formatUtcFileDateTimeISO(options.mtimeDate);
  const timestampLocalIso = formatLocalFileDateTimeISO(options.mtimeDate);
  const timestampUtc12Hour = formatUtcFileDateTime12Hour(options.mtimeDate);
  const timestampLocal12Hour = formatLocalFileDateTime12Hour(options.mtimeDate);
  const dateLocal = formatLocalDate(options.mtimeDate);
  const dateUtc = formatUtcDate(options.mtimeDate);

  const rendered = options.template.replace(
    RENAME_TEMPLATE_TOKEN_PATTERN,
    (_, rawToken: string) => {
      const token = rawToken.trim();
      switch (token) {
        case "prefix":
          return options.prefix;
        case "timestamp":
        case "timestamp_utc":
          return timestampUtc;
        case "timestamp_local":
          return timestampLocal;
        case "timestamp_utc_iso":
          return timestampUtcIso;
        case "timestamp_local_iso":
          return timestampLocalIso;
        case "timestamp_utc_12h":
          return timestampUtc12Hour;
        case "timestamp_local_12h":
          return timestampLocal12Hour;
        case "date":
        case "date_local":
          return dateLocal;
        case "date_utc":
          return dateUtc;
        case "stem":
          return options.stem;
        default:
          if (token === "serial" || token.startsWith("serial_")) {
            return options.serialText ?? "";
          }
          return "";
      }
    },
  );

  return normalizeRenderedBaseName(rendered);
}

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

  const prefix = normalizePrefix(options.prefix);
  const preparedPattern = getPreparedRenamePattern({
    pattern: options.pattern,
    serialOrder: options.serialOrder,
    serialStart: options.serialStart,
    serialWidth: options.serialWidth,
    serialScope: options.serialScope,
    recursive,
  });
  const plannedTargets = new Set<string>();
  const plans: PlannedRename[] = [];
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
    const mtimeDate = fileStats.mtime ?? options.now ?? runtime.now();
    entries.push({
      sourcePath,
      directoryPath: file.directoryPath,
      currentName: file.name,
      ext,
      stemSlug,
      mtimeDate,
      mtimeMs: mtimeDate.getTime(),
    });
  }

  const serialByPath = preparedPattern.serial
    ? buildSerialByPath({
        entries,
        rootDirectoryPath: directoryPath,
        serial: preparedPattern.serial,
        recursive,
      })
    : undefined;

  for (const entry of entries) {
    const baseName = renderBaseNameFromTemplate({
      template: preparedPattern.template,
      prefix,
      stem: entry.stemSlug,
      mtimeDate: entry.mtimeDate,
      serialText: serialByPath?.get(entry.sourcePath),
    });

    let counter = 0;
    let candidatePath = "";
    while (true) {
      const nextName = `${withNumericSuffix(baseName, counter)}${entry.ext}`;
      candidatePath = join(entry.directoryPath, nextName);
      if (!plannedTargets.has(candidatePath)) {
        break;
      }
      counter += 1;
    }

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

  const entries = await readdir(directoryPath, { withFileTypes: true });
  const occupiedNames = new Set(
    entries.map((entry) => entry.name).filter((entryName) => entryName !== currentName),
  );

  let counter = 0;
  let nextName = currentName;
  const serialText = preparedPattern.serial
    ? String(preparedPattern.serial.start).padStart(
        Math.max(
          preparedPattern.serial.width ?? 0,
          String(Math.max(preparedPattern.serial.start, 0)).length,
        ),
        "0",
      )
    : undefined;
  const baseName = renderBaseNameFromTemplate({
    template: preparedPattern.template,
    prefix,
    stem: slug,
    mtimeDate,
    serialText,
  });
  while (true) {
    nextName = `${withNumericSuffix(baseName, counter)}${ext}`;
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
