import { stat } from "node:fs/promises";
import { extname } from "node:path";

import {
  suggestDocumentRenameTitlesWithCodex,
  type CodexDocumentRenameResult,
} from "../../../adapters/codex/document-rename-titles";
import {
  suggestImageRenameTitlesWithCodex,
  type CodexImageRenameResult,
} from "../../../adapters/codex/image-rename-titles";
import type { PlannedRename, CliRuntime } from "../../types";
import { printLine } from "../shared";

export type CodexImageRenameTitleSuggester = (options: {
  imagePaths: string[];
  workingDirectory: string;
  timeoutMs?: number;
  retries?: number;
  batchSize?: number;
}) => Promise<CodexImageRenameResult>;

export type CodexDocumentRenameTitleSuggester = (options: {
  documentPaths: string[];
  workingDirectory: string;
  timeoutMs?: number;
  retries?: number;
  batchSize?: number;
}) => Promise<CodexDocumentRenameResult>;

export interface RenameCodexCliOptions {
  codex?: boolean;
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

export interface RenameCodexEffectiveFlags {
  codexImages: boolean;
  codexDocs: boolean;
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

interface RenameCodexChannelResult {
  summaryLabel: string;
  candidateCount: number;
  eligibleCount: number;
  suggestedCount: number;
  errorMessage: string | null;
  titlesByPath?: Map<string, string>;
}

export interface RenameCodexAnalysisResult {
  effectiveFlags: RenameCodexEffectiveFlags;
  image?: RenameCodexChannelResult;
  doc?: RenameCodexChannelResult;
  titlesByPath: Map<string, string>;
  reasonBySourcePath: Map<string, string>;
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

const CODEX_MAX_IMAGE_BYTES = 20 * 1024 * 1024;
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

    try {
      const fileStats = await stat(sourcePath);
      if (!fileStats.isFile()) {
        skipReasonByPath.set(
          sourcePath,
          isPdf
            ? "pdf_skipped_unreadable"
            : isDocx
              ? "docx_skipped_unreadable"
              : "doc_skipped_unreadable",
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
          isPdf
            ? "pdf_skipped_too_large"
            : isDocx
              ? "docx_skipped_too_large"
              : "doc_skipped_too_large",
        );
        continue;
      }
    } catch {
      skipReasonByPath.set(
        sourcePath,
        isPdf
          ? "pdf_skipped_unreadable"
          : isDocx
            ? "docx_skipped_unreadable"
            : "doc_skipped_unreadable",
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
        reasonByPath: result.reasons
          ? new Map(result.reasons.map((item) => [item.path, item.reason]))
          : undefined,
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
    const progress = startAnalyzerProgress(
      runtime,
      analyzer.progressLabelForCount(selection.eligiblePaths.length),
    );
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

export async function runRenameCodexAnalysis(
  runtime: CliRuntime,
  plans: PlannedRename[],
  options: {
    effectiveFlags: RenameCodexEffectiveFlags;
    cli: RenameCodexCliOptions;
  },
): Promise<RenameCodexAnalysisResult> {
  let image: RenameCodexChannelResult | undefined;
  let doc: RenameCodexChannelResult | undefined;
  const reasonBySourcePath = new Map<string, string>();

  if (options.effectiveFlags.codexImages) {
    const analyzer = createCodexStaticImageTitleAnalyzer({
      titleSuggester: options.cli.codexImagesTitleSuggester,
    });
    const run = await runRenameTitleAnalyzer(runtime, plans, analyzer, {
      timeoutMs: options.cli.codexImagesTimeoutMs,
      retries: options.cli.codexImagesRetries,
      batchSize: options.cli.codexImagesBatchSize,
    });
    image = {
      summaryLabel: analyzer.summaryLabel,
      candidateCount: run.candidateCount,
      eligibleCount: run.eligibleCount,
      suggestedCount: run.suggestedCount,
      errorMessage: run.errorMessage,
      titlesByPath: run.titlesByPath,
    };
    for (const [path, reason] of run.reasonBySourcePath) {
      reasonBySourcePath.set(path, reason);
    }
  }

  if (options.effectiveFlags.codexDocs) {
    const analyzer = createCodexDocumentTextTitleAnalyzer({
      titleSuggester: options.cli.codexDocsTitleSuggester,
    });
    const run = await runRenameTitleAnalyzer(runtime, plans, analyzer, {
      timeoutMs: options.cli.codexDocsTimeoutMs,
      retries: options.cli.codexDocsRetries,
      batchSize: options.cli.codexDocsBatchSize,
    });
    doc = {
      summaryLabel: analyzer.summaryLabel,
      candidateCount: run.candidateCount,
      eligibleCount: run.eligibleCount,
      suggestedCount: run.suggestedCount,
      errorMessage: run.errorMessage,
      titlesByPath: run.titlesByPath,
    };
    for (const [path, reason] of run.reasonBySourcePath) {
      reasonBySourcePath.set(path, reason);
    }
  }

  return {
    effectiveFlags: options.effectiveFlags,
    image,
    doc,
    titlesByPath: new Map<string, string>([
      ...(image?.titlesByPath ?? []),
      ...(doc?.titlesByPath ?? []),
    ]),
    reasonBySourcePath,
  };
}

export function printRenameBatchCodexSummary(
  runtime: CliRuntime,
  options: {
    analysis: RenameCodexAnalysisResult;
    totalCount: number;
    codexRequested: boolean;
  },
): void {
  if (options.analysis.effectiveFlags.codexImages && options.analysis.image) {
    const image = options.analysis.image;
    printLine(
      runtime.stdout,
      `${image.summaryLabel}: ${image.suggestedCount}/${image.candidateCount} image file(s) suggested${image.errorMessage ? " (fallback used for others)" : ""}`,
    );
    if (options.totalCount > 0 && image.candidateCount === 0) {
      printLine(
        runtime.stdout,
        "Codex note: no supported static image files in scope; other file types use deterministic rename.",
      );
    } else if (image.candidateCount > 0 && image.eligibleCount === 0 && !image.errorMessage) {
      printLine(
        runtime.stdout,
        "Codex note: image files were found, but none were eligible static-image inputs (see preview/CSV reasons).",
      );
    }
    if (image.errorMessage && image.candidateCount > 0) {
      printLine(runtime.stdout, `Codex note: ${image.errorMessage}`);
    }
  }

  if (options.analysis.effectiveFlags.codexDocs && options.analysis.doc) {
    const doc = options.analysis.doc;
    printLine(
      runtime.stdout,
      `${doc.summaryLabel}: ${doc.suggestedCount}/${doc.candidateCount} document file(s) suggested${doc.errorMessage ? " (fallback used for others)" : ""}`,
    );
    if (options.totalCount > 0 && doc.candidateCount === 0) {
      printLine(
        runtime.stdout,
        "Codex note: no supported document files in scope for --codex-docs; other file types use deterministic rename.",
      );
    } else if (doc.candidateCount > 0 && doc.eligibleCount === 0 && !doc.errorMessage) {
      printLine(
        runtime.stdout,
        "Codex note: document files were found, but none were eligible document inputs (see preview/CSV reasons).",
      );
    }
    if (doc.errorMessage && doc.candidateCount > 0) {
      printLine(runtime.stdout, `Codex note: ${doc.errorMessage}`);
    }
  }

  if (
    options.codexRequested &&
    !options.analysis.effectiveFlags.codexImages &&
    !options.analysis.effectiveFlags.codexDocs
  ) {
    printLine(
      runtime.stdout,
      "Codex note: no supported Codex analyzer inputs are in scope; deterministic rename is used.",
    );
  }
}

export function printRenameFileCodexSummary(
  runtime: CliRuntime,
  options: {
    analysis: RenameCodexAnalysisResult;
    sourcePath: string;
    codexRequested: boolean;
  },
): void {
  if (options.analysis.effectiveFlags.codexImages && options.analysis.image) {
    const image = options.analysis.image;
    printLine(
      runtime.stdout,
      `${image.summaryLabel}: ${image.suggestedCount}/${image.candidateCount} image file(s) suggested${image.errorMessage ? " (fallback used for others)" : ""}`,
    );
    if (image.candidateCount === 0) {
      printLine(
        runtime.stdout,
        "Codex note: this file is not a supported static image input; deterministic rename is used.",
      );
    } else if (image.eligibleCount === 0 && !image.errorMessage) {
      printLine(
        runtime.stdout,
        "Codex note: this image file is not an eligible static-image input (for example GIF, too large, or unreadable).",
      );
    }
    if (image.errorMessage && image.candidateCount > 0) {
      printLine(runtime.stdout, `Codex note: ${image.errorMessage}`);
    }
  }

  if (options.analysis.effectiveFlags.codexDocs && options.analysis.doc) {
    const doc = options.analysis.doc;
    printLine(
      runtime.stdout,
      `${doc.summaryLabel}: ${doc.suggestedCount}/${doc.candidateCount} document file(s) suggested${doc.errorMessage ? " (fallback used for others)" : ""}`,
    );
    if (doc.candidateCount === 0) {
      printLine(
        runtime.stdout,
        "Codex note: this file is not a supported document input for --codex-docs; deterministic rename is used.",
      );
    } else if (doc.eligibleCount === 0 && !doc.errorMessage) {
      printLine(
        runtime.stdout,
        "Codex note: this document file is not an eligible document input (for example too large or unreadable).",
      );
    }
    if (doc.errorMessage && doc.candidateCount > 0) {
      printLine(runtime.stdout, `Codex note: ${doc.errorMessage}`);
    }
  }

  if (
    options.codexRequested &&
    !options.analysis.effectiveFlags.codexImages &&
    !options.analysis.effectiveFlags.codexDocs
  ) {
    printLine(
      runtime.stdout,
      "Codex note: this file is not a supported Codex analyzer input; deterministic rename is used.",
    );
  }
}
