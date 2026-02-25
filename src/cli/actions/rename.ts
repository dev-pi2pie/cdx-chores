import { stat } from "node:fs/promises";
import { basename, extname } from "node:path";

import {
  suggestImageRenameTitlesWithCodex,
  type CodexImageRenameResult,
} from "../../adapters/codex/image-rename-titles";
import { slugifyName } from "../../utils/slug";
import { CliError } from "../errors";
import { applyRenamePlanCsv, createRenamePlanCsvRows, writeRenamePlanCsv } from "../rename-plan-csv";
import { applyPlannedRenames, planBatchRename, planSingleRename } from "../fs-utils";
import type { CliRuntime, PlannedRename } from "../types";
import { assertNonEmpty, displayPath, printLine } from "./shared";

function formatRenamePreviewLine(plan: PlannedRename): string {
  const fromName = basename(plan.fromPath);
  const toName = basename(plan.toPath);
  return plan.changed ? `- ${fromName} -> ${toName}` : `- ${fromName} (unchanged)`;
}

export interface RenameBatchOptions {
  directory: string;
  prefix?: string;
  dryRun?: boolean;
  matchRegex?: string;
  skipRegex?: string;
  ext?: string[];
  skipExt?: string[];
  codex?: boolean;
  codexTimeoutMs?: number;
  codexRetries?: number;
  codexBatchSize?: number;
  codexTitleSuggester?: (options: {
    imagePaths: string[];
    workingDirectory: string;
    timeoutMs?: number;
    retries?: number;
    batchSize?: number;
  }) => Promise<CodexImageRenameResult>;
}

export interface RenameFileOptions {
  path: string;
  prefix?: string;
  dryRun?: boolean;
}

export interface RenameApplyOptions {
  csv: string;
}

const IMAGE_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".bmp",
  ".tif",
  ".tiff",
  ".avif",
]);

// Keep Codex local-image requests conservative to avoid hard failures on very large files.
const CODEX_MAX_IMAGE_BYTES = 20 * 1024 * 1024;

// GIFs are often animated/non-static; skip Codex assist and keep deterministic rename behavior.
const CODEX_STATIC_IMAGE_EXTENSIONS = new Set(
  [...IMAGE_EXTENSIONS].filter((ext) => ext !== ".gif"),
);

function compileOptionalRegex(
  value: string | undefined,
  label: "--match-regex" | "--skip-regex",
): RegExp | undefined {
  const pattern = value?.trim();
  if (!pattern) {
    return undefined;
  }

  try {
    return new RegExp(pattern);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new CliError(`Invalid ${label}: ${message}`, { code: "INVALID_INPUT", exitCode: 2 });
  }
}

function normalizeExtensions(values: string[] | undefined): Set<string> | undefined {
  if (!values || values.length === 0) {
    return undefined;
  }

  const normalized = values
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.length > 0)
    .map((value) => (value.startsWith(".") ? value : `.${value}`));

  if (normalized.length === 0) {
    return undefined;
  }

  return new Set(normalized);
}

function createRenameBatchFileFilter(options: RenameBatchOptions): (entryName: string) => boolean {
  const matchRegex = compileOptionalRegex(options.matchRegex, "--match-regex");
  const skipRegex = compileOptionalRegex(options.skipRegex, "--skip-regex");
  const includeExts = normalizeExtensions(options.ext);
  const excludeExts = normalizeExtensions(options.skipExt);

  return (entryName: string) => {
    if (matchRegex && !matchRegex.test(entryName)) {
      return false;
    }

    if (skipRegex && skipRegex.test(entryName)) {
      return false;
    }

    const ext = extname(entryName).toLowerCase();
    if (includeExts && !includeExts.has(ext)) {
      return false;
    }

    if (excludeExts?.has(ext)) {
      return false;
    }

    return true;
  };
}

async function selectCodexAssistImagePaths(plans: PlannedRename[]): Promise<string[]> {
  const imagePaths: string[] = [];

  for (const plan of plans) {
    const sourcePath = plan.fromPath;
    const ext = extname(sourcePath).toLowerCase();
    if (!CODEX_STATIC_IMAGE_EXTENSIONS.has(ext)) {
      continue;
    }

    try {
      const fileStats = await stat(sourcePath);
      if (!fileStats.isFile()) {
        continue;
      }
      if (fileStats.size > CODEX_MAX_IMAGE_BYTES) {
        continue;
      }
    } catch {
      continue;
    }

    imagePaths.push(sourcePath);
  }

  return imagePaths;
}

function startCodexProgress(
  runtime: CliRuntime,
  imageCount: number,
): { stop: (status: "done" | "fallback") => void } {
  const stream = runtime.stdout as NodeJS.WritableStream & { isTTY?: boolean };
  const label = `Codex: analyzing ${imageCount} image file(s)`;

  if (!stream.isTTY) {
    printLine(runtime.stdout, `${label}...`);
    return { stop: () => {} };
  }

  const frames = ["-", "\\", "|", "/"];
  let frameIndex = 0;
  const render = () => {
    const frame = frames[frameIndex % frames.length] ?? "-";
    frameIndex += 1;
    stream.write(`\r${label}... ${frame}`);
  };

  render();
  const timer = setInterval(render, 120);

  return {
    stop: (status) => {
      clearInterval(timer);
      stream.write(`\r${label}... ${status === "done" ? "done" : "fallback"}\n`);
    },
  };
}

export async function actionRenameBatch(
  runtime: CliRuntime,
  options: RenameBatchOptions,
): Promise<{ changedCount: number; totalCount: number; directoryPath: string; planCsvPath?: string }> {
  const directory = assertNonEmpty(options.directory, "Directory path");
  const fileFilter = createRenameBatchFileFilter(options);
  const initial = await planBatchRename(runtime, directory, {
    prefix: options.prefix,
    now: runtime.now(),
    fileFilter,
  });
  const directoryPath = initial.directoryPath;

  let titleOverrides: Map<string, string> | undefined;
  let codexImageCount = 0;
  let codexSuggestedCount = 0;
  let codexErrorMessage: string | null = null;
  let codexTitlesByPath: Map<string, string> | undefined;

  if (options.codex ?? false) {
    const imagePaths = await selectCodexAssistImagePaths(initial.plans);
    codexImageCount = imagePaths.length;

    if (imagePaths.length > 0) {
      const codexTitleSuggester = options.codexTitleSuggester ?? suggestImageRenameTitlesWithCodex;
      const progress = startCodexProgress(runtime, imagePaths.length);
      const codexResult = await codexTitleSuggester({
        imagePaths,
        workingDirectory: runtime.cwd,
        timeoutMs: options.codexTimeoutMs,
        retries: options.codexRetries,
        batchSize: options.codexBatchSize,
      });
      progress.stop(codexResult.errorMessage ? "fallback" : "done");
      codexErrorMessage = codexResult.errorMessage ?? null;

      if (codexResult.suggestions.length > 0) {
        codexTitlesByPath = new Map(codexResult.suggestions.map((item) => [item.path, item.title]));
        titleOverrides = new Map(codexResult.suggestions.map((item) => [item.path, item.title]));
        codexSuggestedCount = codexResult.suggestions.length;
      }
    }
  }

  const { plans } = titleOverrides
    ? await planBatchRename(runtime, directory, {
        prefix: options.prefix,
        now: runtime.now(),
        titleOverrides,
        fileFilter,
      })
    : initial;

  const totalCount = plans.length;
  const changedCount = plans.filter((plan) => plan.changed).length;
  let planCsvPath: string | undefined;

  printLine(runtime.stdout, `Directory: ${displayPath(runtime, directoryPath)}`);
  printLine(runtime.stdout, `Files found: ${totalCount}`);
  printLine(runtime.stdout, `Files to rename: ${changedCount}`);
  if (options.codex ?? false) {
    printLine(
      runtime.stdout,
      `Codex image titles: ${codexSuggestedCount}/${codexImageCount} image file(s) suggested${codexErrorMessage ? " (fallback used for others)" : ""}`,
    );
    if (codexErrorMessage && codexImageCount > 0) {
      printLine(runtime.stdout, `Codex note: ${codexErrorMessage}`);
    }
  }
  printLine(runtime.stdout);

  for (const plan of plans) {
    printLine(runtime.stdout, formatRenamePreviewLine(plan));
  }

  if (options.dryRun ?? false) {
    const cleanedStemBySourcePath = new Map<string, string>();
    for (const plan of plans) {
      const ext = extname(plan.fromPath);
      const stem = basename(plan.fromPath, ext);
      const sourceTitle = codexTitlesByPath?.get(plan.fromPath) ?? stem;
      cleanedStemBySourcePath.set(plan.fromPath, slugifyName(sourceTitle).slice(0, 48));
    }

    const { rows } = createRenamePlanCsvRows({
      runtime,
      plans,
      cleanedStemBySourcePath,
      aiNameBySourcePath: codexTitlesByPath,
      aiProvider: "codex",
      aiModel: "auto",
    });
    planCsvPath = await writeRenamePlanCsv(runtime, rows);

    printLine(runtime.stdout);
    printLine(runtime.stdout, `Plan CSV: ${displayPath(runtime, planCsvPath)}`);
    printLine(runtime.stdout, "Dry run only. No files were renamed.");
    return { changedCount, totalCount, directoryPath, planCsvPath };
  }

  await applyPlannedRenames(plans);
  printLine(runtime.stdout);
  printLine(runtime.stdout, `Renamed ${changedCount} file(s).`);

  return { changedCount, totalCount, directoryPath };
}

export async function actionRenameFile(
  runtime: CliRuntime,
  options: RenameFileOptions,
): Promise<{ changed: boolean; filePath: string; directoryPath: string; planCsvPath?: string }> {
  const inputPath = assertNonEmpty(options.path, "File path");
  const { directoryPath, plan } = await planSingleRename(runtime, inputPath, {
    prefix: options.prefix,
    now: runtime.now(),
  });

  printLine(runtime.stdout, `Directory: ${displayPath(runtime, directoryPath)}`);
  printLine(runtime.stdout, `File: ${displayPath(runtime, plan.fromPath)}`);
  printLine(runtime.stdout);
  printLine(runtime.stdout, formatRenamePreviewLine(plan));

  if (options.dryRun ?? false) {
    const ext = extname(plan.fromPath);
    const stem = basename(plan.fromPath, ext);
    const cleanedStemBySourcePath = new Map<string, string>([
      [plan.fromPath, slugifyName(stem).slice(0, 48)],
    ]);
    const { rows } = createRenamePlanCsvRows({
      runtime,
      plans: [plan],
      cleanedStemBySourcePath,
    });
    const planCsvPath = await writeRenamePlanCsv(runtime, rows);

    printLine(runtime.stdout);
    printLine(runtime.stdout, `Plan CSV: ${displayPath(runtime, planCsvPath)}`);
    printLine(runtime.stdout, "Dry run only. No files were renamed.");
    return { changed: plan.changed, filePath: plan.fromPath, directoryPath, planCsvPath };
  }

  await applyPlannedRenames([plan]);
  printLine(runtime.stdout);
  if (plan.changed) {
    printLine(runtime.stdout, "Renamed 1 file(s).");
  } else {
    printLine(runtime.stdout, "No rename needed.");
  }

  return { changed: plan.changed, filePath: plan.fromPath, directoryPath };
}

export async function actionRenameApply(
  runtime: CliRuntime,
  options: RenameApplyOptions,
): Promise<{ csvPath: string; appliedCount: number; totalRows: number; skippedCount: number }> {
  const csv = assertNonEmpty(options.csv, "Rename plan CSV path");
  const result = await applyRenamePlanCsv(runtime, csv);

  printLine(runtime.stdout, `Plan CSV: ${displayPath(runtime, result.csvPath)}`);
  printLine(runtime.stdout, `Rows in plan: ${result.totalRows}`);
  printLine(runtime.stdout, `Rows applied: ${result.appliedCount}`);
  printLine(runtime.stdout, `Rows skipped: ${result.skippedCount}`);

  return result;
}
