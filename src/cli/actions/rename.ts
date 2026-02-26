import { rm, stat } from "node:fs/promises";
import { basename, extname } from "node:path";

import {
  suggestDocumentRenameTitlesWithCodex,
  type CodexDocumentRenameResult,
} from "../../adapters/codex/document-rename-titles";
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

type CodexImageRenameTitleSuggester = (options: {
  imagePaths: string[];
  workingDirectory: string;
  timeoutMs?: number;
  retries?: number;
  batchSize?: number;
}) => Promise<CodexImageRenameResult>;

type CodexDocumentRenameTitleSuggester = (options: {
  documentPaths: string[];
  workingDirectory: string;
  timeoutMs?: number;
  retries?: number;
  batchSize?: number;
}) => Promise<CodexDocumentRenameResult>;

export interface RenameBatchOptions {
  directory: string;
  prefix?: string;
  profile?: string;
  dryRun?: boolean;
  recursive?: boolean;
  maxDepth?: number;
  matchRegex?: string;
  skipRegex?: string;
  ext?: string[];
  skipExt?: string[];
  codexImages?: boolean;
  codexImagesTimeoutMs?: number;
  codexImagesRetries?: number;
  codexImagesBatchSize?: number;
  codexImagesTitleSuggester?: CodexImageRenameTitleSuggester;
  codexDocs?: boolean;
  codexDocsTimeoutMs?: number;
  codexDocsRetries?: number;
  codexDocsBatchSize?: number;
  codexDocsTitleSuggester?: CodexDocumentRenameTitleSuggester;
}

export interface RenameFileOptions {
  path: string;
  prefix?: string;
  dryRun?: boolean;
  codexImages?: boolean;
  codexImagesTimeoutMs?: number;
  codexImagesRetries?: number;
  codexImagesBatchSize?: number;
  codexImagesTitleSuggester?: CodexImageRenameTitleSuggester;
  codexDocs?: boolean;
  codexDocsTimeoutMs?: number;
  codexDocsRetries?: number;
  codexDocsBatchSize?: number;
  codexDocsTitleSuggester?: CodexDocumentRenameTitleSuggester;
}

export interface RenameApplyOptions {
  csv: string;
  autoClean?: boolean;
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

const CODEX_TEXT_DOCUMENT_EXTENSIONS = new Set([
  ".md",
  ".markdown",
  ".txt",
  ".json",
  ".yaml",
  ".yml",
  ".toml",
  ".xml",
  ".html",
  ".htm",
]);
const CODEX_PDF_DOCUMENT_EXTENSIONS = new Set([".pdf"]);
const CODEX_DOCX_DOCUMENT_EXTENSIONS = new Set([".docx"]);
const CODEX_MAX_TEXT_DOCUMENT_BYTES = 512 * 1024;
const CODEX_MAX_PDF_DOCUMENT_BYTES = 20 * 1024 * 1024;
const CODEX_MAX_DOCX_DOCUMENT_BYTES = 10 * 1024 * 1024;

function isCodexDocxExperimentalEnabled(): boolean {
  return process.env.CDX_CHORES_CODEX_DOCS_DOCX_EXPERIMENTAL === "1";
}

const DEFAULT_RENAME_BATCH_EXCLUDED_BASENAMES = new Set([
  ".DS_Store",
  "Thumbs.db",
  "desktop.ini",
]);

const RENAME_BATCH_PROFILE_EXTENSIONS = {
  images: [
    ".png",
    ".jpg",
    ".jpeg",
    ".webp",
    ".gif",
    ".bmp",
    ".tif",
    ".tiff",
    ".avif",
    ".heic",
    ".heif",
    ".svg",
  ],
  media: [
    ".png",
    ".jpg",
    ".jpeg",
    ".webp",
    ".gif",
    ".bmp",
    ".tif",
    ".tiff",
    ".avif",
    ".heic",
    ".heif",
    ".svg",
    ".mp4",
    ".mov",
    ".m4v",
    ".mkv",
    ".avi",
    ".webm",
    ".mp3",
    ".wav",
    ".m4a",
    ".aac",
    ".flac",
    ".ogg",
    ".opus",
  ],
  docs: [
    ".txt",
    ".md",
    ".markdown",
    ".pdf",
    ".doc",
    ".docx",
    ".rtf",
    ".odt",
    ".csv",
    ".tsv",
    ".json",
    ".yaml",
    ".yml",
    ".toml",
    ".xml",
    ".html",
    ".htm",
  ],
} as const;

type RenameBatchProfileName = keyof typeof RENAME_BATCH_PROFILE_EXTENSIONS;

function isDefaultRenameBatchExcludedEntryName(entryName: string): boolean {
  if (entryName.startsWith(".")) {
    return true;
  }

  if (entryName.startsWith("._")) {
    return true;
  }

  return DEFAULT_RENAME_BATCH_EXCLUDED_BASENAMES.has(entryName);
}

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

function normalizeRenameBatchProfile(profile: string | undefined): Set<string> | undefined {
  const raw = profile?.trim().toLowerCase();
  if (!raw || raw === "all") {
    return undefined;
  }

  const values = RENAME_BATCH_PROFILE_EXTENSIONS[raw as RenameBatchProfileName];
  if (!values) {
    throw new CliError(
      `Invalid --profile value: ${profile}. Expected one of: all, images, media, docs`,
      {
        code: "INVALID_INPUT",
        exitCode: 2,
      },
    );
  }

  return new Set(values);
}

function normalizeRenameBatchMaxDepth(options: RenameBatchOptions): number | undefined {
  const value = options.maxDepth;
  if (value === undefined) {
    return undefined;
  }

  if (!(options.recursive ?? false)) {
    throw new CliError("--max-depth requires --recursive.", { code: "INVALID_INPUT", exitCode: 2 });
  }

  if (!Number.isFinite(value) || !Number.isInteger(value) || value < 0) {
    throw new CliError("--max-depth must be a non-negative integer.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  return value;
}

function createRenameBatchFileFilter(options: RenameBatchOptions): (entryName: string) => boolean {
  const matchRegex = compileOptionalRegex(options.matchRegex, "--match-regex");
  const skipRegex = compileOptionalRegex(options.skipRegex, "--skip-regex");
  const profileExts = normalizeRenameBatchProfile(options.profile);
  const includeExts = normalizeExtensions(options.ext);
  const excludeExts = normalizeExtensions(options.skipExt);
  const effectiveIncludeExts =
    profileExts || includeExts
      ? new Set<string>([...(profileExts ?? []), ...(includeExts ?? [])])
      : undefined;

  return (entryName: string) => {
    if (isDefaultRenameBatchExcludedEntryName(entryName)) {
      return false;
    }

    if (matchRegex && !matchRegex.test(entryName)) {
      return false;
    }

    if (skipRegex && skipRegex.test(entryName)) {
      return false;
    }

    const ext = extname(entryName).toLowerCase();
    if (effectiveIncludeExts && !effectiveIncludeExts.has(ext)) {
      return false;
    }

    if (excludeExts?.has(ext)) {
      return false;
    }

    return true;
  };
}

interface RenameTitleAnalyzerSuggestion {
  path: string;
  title: string;
}

interface RenameTitleAnalyzerSuggestionResult {
  suggestions: RenameTitleAnalyzerSuggestion[];
  errorMessage?: string;
  reasonByPath?: Map<string, string>;
}

interface RenameTitleAnalyzerSelection {
  candidateCount: number;
  eligiblePaths: string[];
  skipReasonByPath: Map<string, string>;
}

interface RenameTitleAnalyzerRunResult {
  candidateCount: number;
  eligibleCount: number;
  suggestedCount: number;
  errorMessage: string | null;
  titlesByPath?: Map<string, string>;
  reasonBySourcePath: Map<string, string>;
}

interface RenameTitleAnalyzer {
  id: string;
  summaryLabel: string;
  progressLabelForCount: (eligibleCount: number) => string;
  selectCandidates: (plans: PlannedRename[]) => Promise<RenameTitleAnalyzerSelection>;
  suggestTitles: (options: {
    paths: string[];
    workingDirectory: string;
    timeoutMs?: number;
    retries?: number;
    batchSize?: number;
  }) => Promise<RenameTitleAnalyzerSuggestionResult>;
}

async function selectCodexStaticImageCandidates(
  plans: PlannedRename[],
): Promise<RenameTitleAnalyzerSelection> {
  const eligiblePaths: string[] = [];
  let candidateCount = 0;
  const skipReasonByPath = new Map<string, string>();

  for (const plan of plans) {
    const sourcePath = plan.fromPath;
    const ext = extname(sourcePath).toLowerCase();
    if (!IMAGE_EXTENSIONS.has(ext)) {
      continue;
    }

    candidateCount += 1;

    if (!CODEX_STATIC_IMAGE_EXTENSIONS.has(ext)) {
      skipReasonByPath.set(sourcePath, "codex_skipped_non_static");
      continue;
    }

    try {
      const fileStats = await stat(sourcePath);
      if (!fileStats.isFile()) {
        skipReasonByPath.set(sourcePath, "codex_skipped_unreadable");
        continue;
      }
      if (fileStats.size > CODEX_MAX_IMAGE_BYTES) {
        skipReasonByPath.set(sourcePath, "codex_skipped_too_large");
        continue;
      }
    } catch {
      skipReasonByPath.set(sourcePath, "codex_skipped_unreadable");
      continue;
    }

    eligiblePaths.push(sourcePath);
  }

  return { candidateCount, eligiblePaths, skipReasonByPath };
}

function createCodexStaticImageTitleAnalyzer(options: {
  titleSuggester?: CodexImageRenameTitleSuggester;
}): RenameTitleAnalyzer {
  const titleSuggester = options.titleSuggester ?? suggestImageRenameTitlesWithCodex;
  return {
    id: "codex-static-image",
    summaryLabel: "Codex image titles",
    progressLabelForCount: (eligibleCount) => `Codex: analyzing ${eligibleCount} image file(s)`,
    selectCandidates: selectCodexStaticImageCandidates,
    suggestTitles: async ({ paths, workingDirectory, timeoutMs, retries, batchSize }) => {
      const result = await titleSuggester({
        imagePaths: paths,
        workingDirectory,
        timeoutMs,
        retries,
        batchSize,
      });
      return { suggestions: result.suggestions, errorMessage: result.errorMessage };
    },
  };
}

async function selectCodexDocumentTextCandidates(
  plans: PlannedRename[],
): Promise<RenameTitleAnalyzerSelection> {
  const eligiblePaths: string[] = [];
  let candidateCount = 0;
  const skipReasonByPath = new Map<string, string>();

  for (const plan of plans) {
    const sourcePath = plan.fromPath;
    const ext = extname(sourcePath).toLowerCase();
    const isTextLike = CODEX_TEXT_DOCUMENT_EXTENSIONS.has(ext);
    const isPdf = CODEX_PDF_DOCUMENT_EXTENSIONS.has(ext);
    const isDocx = CODEX_DOCX_DOCUMENT_EXTENSIONS.has(ext);
    if (!isTextLike && !isPdf && !isDocx) {
      continue;
    }

    candidateCount += 1;

    if (isDocx && !isCodexDocxExperimentalEnabled()) {
      skipReasonByPath.set(sourcePath, "docx_experimental_disabled");
      continue;
    }

    try {
      const fileStats = await stat(sourcePath);
      if (!fileStats.isFile()) {
        skipReasonByPath.set(
          sourcePath,
          isPdf ? "pdf_skipped_unreadable" : isDocx ? "docx_skipped_unreadable" : "doc_skipped_unreadable",
        );
        continue;
      }
      const sizeLimit = isPdf
        ? CODEX_MAX_PDF_DOCUMENT_BYTES
        : isDocx
          ? CODEX_MAX_DOCX_DOCUMENT_BYTES
          : CODEX_MAX_TEXT_DOCUMENT_BYTES;
      if (fileStats.size > sizeLimit) {
        skipReasonByPath.set(
          sourcePath,
          isPdf ? "pdf_skipped_too_large" : isDocx ? "docx_skipped_too_large" : "doc_skipped_too_large",
        );
        continue;
      }
    } catch {
      skipReasonByPath.set(
        sourcePath,
        isPdf ? "pdf_skipped_unreadable" : isDocx ? "docx_skipped_unreadable" : "doc_skipped_unreadable",
      );
      continue;
    }

    eligiblePaths.push(sourcePath);
  }

  return { candidateCount, eligiblePaths, skipReasonByPath };
}

function createCodexDocumentTextTitleAnalyzer(options: {
  titleSuggester?: CodexDocumentRenameTitleSuggester;
}): RenameTitleAnalyzer {
  const titleSuggester = options.titleSuggester ?? suggestDocumentRenameTitlesWithCodex;
  return {
    id: "codex-document-text",
    summaryLabel: "Codex doc titles",
    progressLabelForCount: (eligibleCount) => `Codex: analyzing ${eligibleCount} document file(s)`,
    selectCandidates: selectCodexDocumentTextCandidates,
    suggestTitles: async ({ paths, workingDirectory, timeoutMs, retries, batchSize }) => {
      const result = await titleSuggester({
        documentPaths: paths,
        workingDirectory,
        timeoutMs,
        retries,
        batchSize,
      });
      return {
        suggestions: result.suggestions,
        errorMessage: result.errorMessage,
        reasonByPath: result.reasons ? new Map(result.reasons.map((item) => [item.path, item.reason])) : undefined,
      };
    },
  };
}

function startAnalyzerProgress(
  runtime: CliRuntime,
  label: string,
): { stop: (status: "done" | "fallback") => void } {
  const stream = runtime.stdout as NodeJS.WritableStream & { isTTY?: boolean };

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

async function runRenameTitleAnalyzer(
  runtime: CliRuntime,
  plans: PlannedRename[],
  analyzer: RenameTitleAnalyzer,
  options: {
    timeoutMs?: number;
    retries?: number;
    batchSize?: number;
  },
): Promise<RenameTitleAnalyzerRunResult> {
  const selection = await analyzer.selectCandidates(plans);
  const reasonBySourcePath = new Map(selection.skipReasonByPath);
  let errorMessage: string | null = null;
  let titlesByPath: Map<string, string> | undefined;
  let suggestedCount = 0;

  if (selection.eligiblePaths.length > 0) {
    const progress = startAnalyzerProgress(runtime, analyzer.progressLabelForCount(selection.eligiblePaths.length));
    const result = await analyzer.suggestTitles({
      paths: selection.eligiblePaths,
      workingDirectory: runtime.cwd,
      timeoutMs: options.timeoutMs,
      retries: options.retries,
      batchSize: options.batchSize,
    });
    progress.stop(result.errorMessage ? "fallback" : "done");
    errorMessage = result.errorMessage ?? null;

    if (result.suggestions.length > 0) {
      titlesByPath = new Map(result.suggestions.map((item) => [item.path, item.title]));
      suggestedCount = result.suggestions.length;
    }

    if (result.reasonByPath) {
      for (const [path, reason] of result.reasonByPath) {
        if (titlesByPath?.has(path)) {
          continue;
        }
        reasonBySourcePath.set(path, reason);
      }
    }

    for (const path of selection.eligiblePaths) {
      if (titlesByPath?.has(path)) {
        continue;
      }
      if (reasonBySourcePath.has(path)) {
        continue;
      }
      reasonBySourcePath.set(path, errorMessage ? "codex_fallback_error" : "codex_no_suggestion");
    }
  }

  return {
    candidateCount: selection.candidateCount,
    eligibleCount: selection.eligiblePaths.length,
    suggestedCount,
    errorMessage,
    titlesByPath,
    reasonBySourcePath,
  };
}

export async function actionRenameBatch(
  runtime: CliRuntime,
  options: RenameBatchOptions,
): Promise<{ changedCount: number; totalCount: number; directoryPath: string; planCsvPath?: string }> {
  const directory = assertNonEmpty(options.directory, "Directory path");
  const maxDepth = normalizeRenameBatchMaxDepth(options);
  const fileFilter = createRenameBatchFileFilter(options);
  const initial = await planBatchRename(runtime, directory, {
    prefix: options.prefix,
    now: runtime.now(),
    fileFilter,
    recursive: options.recursive,
    maxDepth,
  });
  const directoryPath = initial.directoryPath;
  const skipped = initial.skipped;

  let titleOverrides: Map<string, string> | undefined;
  let codexImageCount = 0;
  let codexEligibleStaticImageCount = 0;
  let codexImageSuggestedCount = 0;
  let codexImageErrorMessage: string | null = null;
  let codexImageSummaryLabel = "Codex image titles";
  let codexImageTitlesByPath: Map<string, string> | undefined;
  let codexDocCount = 0;
  let codexEligibleDocCount = 0;
  let codexDocSuggestedCount = 0;
  let codexDocErrorMessage: string | null = null;
  let codexDocSummaryLabel = "Codex doc titles";
  let codexDocTitlesByPath: Map<string, string> | undefined;
  const rowReasonBySourcePath = new Map<string, string>();

  if (options.codexImages ?? false) {
    const codexAnalyzer = createCodexStaticImageTitleAnalyzer({
      titleSuggester: options.codexImagesTitleSuggester,
    });
    codexImageSummaryLabel = codexAnalyzer.summaryLabel;
    const codexRun = await runRenameTitleAnalyzer(runtime, initial.plans, codexAnalyzer, {
      timeoutMs: options.codexImagesTimeoutMs,
      retries: options.codexImagesRetries,
      batchSize: options.codexImagesBatchSize,
    });
    codexImageCount = codexRun.candidateCount;
    codexEligibleStaticImageCount = codexRun.eligibleCount;
    codexImageSuggestedCount = codexRun.suggestedCount;
    codexImageErrorMessage = codexRun.errorMessage;
    codexImageTitlesByPath = codexRun.titlesByPath;
    for (const [path, reason] of codexRun.reasonBySourcePath) {
      rowReasonBySourcePath.set(path, reason);
    }
    if (codexImageTitlesByPath && codexImageTitlesByPath.size > 0) {
      titleOverrides = new Map(codexImageTitlesByPath);
    }
  }

  if (options.codexDocs ?? false) {
    const codexDocAnalyzer = createCodexDocumentTextTitleAnalyzer({
      titleSuggester: options.codexDocsTitleSuggester,
    });
    codexDocSummaryLabel = codexDocAnalyzer.summaryLabel;
    const codexDocRun = await runRenameTitleAnalyzer(runtime, initial.plans, codexDocAnalyzer, {
      timeoutMs: options.codexDocsTimeoutMs,
      retries: options.codexDocsRetries,
      batchSize: options.codexDocsBatchSize,
    });
    codexDocCount = codexDocRun.candidateCount;
    codexEligibleDocCount = codexDocRun.eligibleCount;
    codexDocSuggestedCount = codexDocRun.suggestedCount;
    codexDocErrorMessage = codexDocRun.errorMessage;
    codexDocTitlesByPath = codexDocRun.titlesByPath;
    for (const [path, reason] of codexDocRun.reasonBySourcePath) {
      rowReasonBySourcePath.set(path, reason);
    }
    if (codexDocTitlesByPath && codexDocTitlesByPath.size > 0) {
      titleOverrides = new Map([...(titleOverrides ?? []), ...codexDocTitlesByPath]);
    }
  }

  const codexTitlesByPath =
    titleOverrides && titleOverrides.size > 0 ? new Map(titleOverrides) : undefined;

  const { plans } = titleOverrides
    ? await planBatchRename(runtime, directory, {
        prefix: options.prefix,
        now: runtime.now(),
        titleOverrides,
        fileFilter,
        recursive: options.recursive,
        maxDepth,
      })
    : initial;

  const totalCount = plans.length;
  const changedCount = plans.filter((plan) => plan.changed).length;
  let planCsvPath: string | undefined;

  printLine(runtime.stdout, `Directory: ${displayPath(runtime, directoryPath)}`);
  printLine(runtime.stdout, `Files found: ${totalCount}`);
  printLine(runtime.stdout, `Files to rename: ${changedCount}`);
  if (skipped.length > 0) {
    printLine(runtime.stdout, `Entries skipped: ${skipped.length}`);
  }
  if (options.codexImages ?? false) {
    printLine(
      runtime.stdout,
      `${codexImageSummaryLabel}: ${codexImageSuggestedCount}/${codexImageCount} image file(s) suggested${codexImageErrorMessage ? " (fallback used for others)" : ""}`,
    );
    if (totalCount > 0 && codexImageCount === 0) {
      printLine(
        runtime.stdout,
        "Codex note: no supported static image files in scope; other file types use deterministic rename.",
      );
    } else if (codexImageCount > 0 && codexEligibleStaticImageCount === 0 && !codexImageErrorMessage) {
      printLine(
        runtime.stdout,
        "Codex note: image files were found, but none were eligible static-image inputs (see preview/CSV reasons).",
      );
    }
    if (codexImageErrorMessage && codexImageCount > 0) {
      printLine(runtime.stdout, `Codex note: ${codexImageErrorMessage}`);
    }
  }
  if (options.codexDocs ?? false) {
    printLine(
      runtime.stdout,
      `${codexDocSummaryLabel}: ${codexDocSuggestedCount}/${codexDocCount} document file(s) suggested${codexDocErrorMessage ? " (fallback used for others)" : ""}`,
    );
    if (totalCount > 0 && codexDocCount === 0) {
      printLine(
        runtime.stdout,
        "Codex note: no supported document files in scope for --codex-docs; other file types use deterministic rename.",
      );
    } else if (codexDocCount > 0 && codexEligibleDocCount === 0 && !codexDocErrorMessage) {
      printLine(
        runtime.stdout,
        "Codex note: document files were found, but none were eligible document inputs (see preview/CSV reasons).",
      );
    }
    if (codexDocErrorMessage && codexDocCount > 0) {
      printLine(runtime.stdout, `Codex note: ${codexDocErrorMessage}`);
    }
  }
  printLine(runtime.stdout);

  for (const plan of plans) {
    printLine(runtime.stdout, formatRenamePreviewLine(plan));
  }
  for (const item of skipped) {
    printLine(runtime.stdout, `- ${displayPath(runtime, item.path)} (skipped: ${item.reason})`);
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
      reasonBySourcePath: rowReasonBySourcePath,
      skippedItems: skipped,
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
  const initial = await planSingleRename(runtime, inputPath, {
    prefix: options.prefix,
    now: runtime.now(),
  });
  const directoryPath = initial.directoryPath;
  let plan = initial.plan;
  let codexImageCount = 0;
  let codexEligibleStaticImageCount = 0;
  let codexImageSuggestedCount = 0;
  let codexImageErrorMessage: string | null = null;
  let codexImageTitlesByPath: Map<string, string> | undefined;
  let codexImageSummaryLabel = "Codex image titles";
  let codexDocCount = 0;
  let codexEligibleDocCount = 0;
  let codexDocSuggestedCount = 0;
  let codexDocErrorMessage: string | null = null;
  let codexDocTitlesByPath: Map<string, string> | undefined;
  let codexDocSummaryLabel = "Codex doc titles";
  const rowReasonBySourcePath = new Map<string, string>();

  if (options.codexImages ?? false) {
    const codexAnalyzer = createCodexStaticImageTitleAnalyzer({
      titleSuggester: options.codexImagesTitleSuggester,
    });
    codexImageSummaryLabel = codexAnalyzer.summaryLabel;
    const codexRun = await runRenameTitleAnalyzer(runtime, [initial.plan], codexAnalyzer, {
      timeoutMs: options.codexImagesTimeoutMs,
      retries: options.codexImagesRetries,
      batchSize: options.codexImagesBatchSize,
    });
    codexImageCount = codexRun.candidateCount;
    codexEligibleStaticImageCount = codexRun.eligibleCount;
    codexImageSuggestedCount = codexRun.suggestedCount;
    codexImageErrorMessage = codexRun.errorMessage;
    codexImageTitlesByPath = codexRun.titlesByPath;
    for (const [path, reason] of codexRun.reasonBySourcePath) {
      rowReasonBySourcePath.set(path, reason);
    }
  }

  if (options.codexDocs ?? false) {
    const codexDocAnalyzer = createCodexDocumentTextTitleAnalyzer({
      titleSuggester: options.codexDocsTitleSuggester,
    });
    codexDocSummaryLabel = codexDocAnalyzer.summaryLabel;
    const codexDocRun = await runRenameTitleAnalyzer(runtime, [initial.plan], codexDocAnalyzer, {
      timeoutMs: options.codexDocsTimeoutMs,
      retries: options.codexDocsRetries,
      batchSize: options.codexDocsBatchSize,
    });
    codexDocCount = codexDocRun.candidateCount;
    codexEligibleDocCount = codexDocRun.eligibleCount;
    codexDocSuggestedCount = codexDocRun.suggestedCount;
    codexDocErrorMessage = codexDocRun.errorMessage;
    codexDocTitlesByPath = codexDocRun.titlesByPath;
    for (const [path, reason] of codexDocRun.reasonBySourcePath) {
      rowReasonBySourcePath.set(path, reason);
    }
  }

  const codexTitlesByPath = new Map<string, string>([
    ...(codexImageTitlesByPath ?? []),
    ...(codexDocTitlesByPath ?? []),
  ]);
  const titleOverride = codexTitlesByPath.get(initial.plan.fromPath);
  if (titleOverride) {
    const replanned = await planSingleRename(runtime, inputPath, {
      prefix: options.prefix,
      now: runtime.now(),
      titleOverride,
    });
    plan = replanned.plan;
  }

  printLine(runtime.stdout, `Directory: ${displayPath(runtime, directoryPath)}`);
  printLine(runtime.stdout, `File: ${displayPath(runtime, plan.fromPath)}`);
  if (options.codexImages ?? false) {
    printLine(
      runtime.stdout,
      `${codexImageSummaryLabel}: ${codexImageSuggestedCount}/${codexImageCount} image file(s) suggested${codexImageErrorMessage ? " (fallback used for others)" : ""}`,
    );
    if (codexImageCount === 0) {
      printLine(
        runtime.stdout,
        "Codex note: this file is not a supported static image input; deterministic rename is used.",
      );
    } else if (codexEligibleStaticImageCount === 0 && !codexImageErrorMessage) {
      printLine(
        runtime.stdout,
        "Codex note: this image file is not an eligible static-image input (for example GIF, too large, or unreadable).",
      );
    }
    if (codexImageErrorMessage && codexImageCount > 0) {
      printLine(runtime.stdout, `Codex note: ${codexImageErrorMessage}`);
    }
  }
  if (options.codexDocs ?? false) {
    printLine(
      runtime.stdout,
      `${codexDocSummaryLabel}: ${codexDocSuggestedCount}/${codexDocCount} document file(s) suggested${codexDocErrorMessage ? " (fallback used for others)" : ""}`,
    );
    if (codexDocCount === 0) {
      printLine(
        runtime.stdout,
        "Codex note: this file is not a supported document input for --codex-docs; deterministic rename is used.",
      );
    } else if (rowReasonBySourcePath.get(plan.fromPath) === "docx_experimental_disabled") {
      printLine(
        runtime.stdout,
        "Codex note: DOCX semantic titles are experimental and currently disabled (set CDX_CHORES_CODEX_DOCS_DOCX_EXPERIMENTAL=1 to opt in).",
      );
    } else if (codexEligibleDocCount === 0 && !codexDocErrorMessage) {
      printLine(
        runtime.stdout,
        "Codex note: this document file is not an eligible document input (for example too large or unreadable).",
      );
    }
    if (codexDocErrorMessage && codexDocCount > 0) {
      printLine(runtime.stdout, `Codex note: ${codexDocErrorMessage}`);
    }
  }
  printLine(runtime.stdout);
  printLine(runtime.stdout, formatRenamePreviewLine(plan));

  if (options.dryRun ?? false) {
    const ext = extname(plan.fromPath);
    const stem = basename(plan.fromPath, ext);
    const sourceTitle = codexTitlesByPath.get(plan.fromPath) ?? stem;
    const cleanedStemBySourcePath = new Map<string, string>([
      [plan.fromPath, slugifyName(sourceTitle).slice(0, 48)],
    ]);
    const { rows } = createRenamePlanCsvRows({
      runtime,
      plans: [plan],
      cleanedStemBySourcePath,
      aiNameBySourcePath: codexTitlesByPath.size > 0 ? codexTitlesByPath : undefined,
      reasonBySourcePath: rowReasonBySourcePath,
      aiProvider: "codex",
      aiModel: "auto",
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
  if (options.autoClean ?? false) {
    await rm(result.csvPath, { force: true });
    printLine(runtime.stdout, "Plan CSV auto-cleaned.");
  }

  return result;
}
