import {
  suggestDocumentRenameTitlesWithCodex,
  type CodexDocumentRenameResult,
} from "../../../../adapters/codex/document-rename-titles";
import {
  suggestImageRenameTitlesWithCodex,
  type CodexImageRenameResult,
} from "../../../../adapters/codex/image-rename-titles";
import type { PlannedRename, CliRuntime } from "../../../types";
import {
  selectCodexDocumentTextCandidates,
  selectCodexStaticImageCandidates,
  type RenameTitleAnalyzerSelection,
} from "./candidates";
import { startAnalyzerProgress } from "./progress";

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
