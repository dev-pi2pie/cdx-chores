import type { HarnessRunnerContext } from "../context";

interface RenameCleanupEvidenceGroup {
  pattern: string;
  count: number;
  examples: string[];
}

interface RenameCleanupEvidence {
  targetKind: string;
  targetPath: string;
  totalCandidateCount: number;
  sampledCount: number;
  sampleNames: string[];
  groupedPatterns: RenameCleanupEvidenceGroup[];
}

interface RenameCleanupCollectOptions {
  path?: unknown;
  recursive?: unknown;
  maxDepth?: unknown;
  matchRegex?: unknown;
  skipRegex?: unknown;
  ext?: unknown;
  skipExt?: unknown;
  sampleLimit?: unknown;
  groupLimit?: unknown;
  examplesPerGroup?: unknown;
  onProgress?: ((phase: string) => void) | undefined;
}

interface RenameCleanupSuggestOptions {
  evidence?: {
    targetKind?: unknown;
    totalCandidateCount?: unknown;
    sampledCount?: unknown;
    sampleNames?: unknown;
    groupedPatterns?: Array<{
      pattern?: unknown;
      count?: unknown;
      examples?: unknown;
    }>;
  };
}

function createDefaultRenameCleanupEvidence(inputPath: string): RenameCleanupEvidence {
  if (inputPath === "docs") {
    return {
      targetKind: "directory",
      targetPath: "docs",
      totalCandidateCount: 3,
      sampledCount: 3,
      sampleNames: ["app-00001.log", "app-00002.log", "app-00003.log"],
      groupedPatterns: [
        {
          pattern: "app-{serial}.log",
          count: 3,
          examples: ["app-00001.log", "app-00002.log", "app-00003.log"],
        },
      ],
    };
  }

  return {
    targetKind: "file",
    targetPath: inputPath,
    totalCandidateCount: 1,
    sampledCount: 1,
    sampleNames: [inputPath],
    groupedPatterns: [
      {
        pattern: "file.txt",
        count: 1,
        examples: [inputPath],
      },
    ],
  };
}

export function createRenameActionMocks(context: HarnessRunnerContext) {
  return {
    actionRenameBatch: async (_runtime: unknown, options: Record<string, unknown>) => {
      context.recordAction("rename:batch", options);
      return {
        changedCount: 0,
        totalCount: 0,
        directoryPath: String(options.directory ?? ""),
      };
    },
    actionRenameFile: async (_runtime: unknown, options: Record<string, unknown>) => {
      context.recordAction("rename:file", options);
      return {
        changed: false,
        filePath: context.resolveHarnessPath(options.path),
        directoryPath: context.directoryPathForFile(options.path),
      };
    },
    actionRenameApply: async (_runtime: unknown, options: Record<string, unknown>) => {
      context.recordAction("rename:apply", options);
      if (context.scenario.renameApplyErrorMessage) {
        throw new Error(context.scenario.renameApplyErrorMessage);
      }

      return {
        csvPath: String(options.csv ?? ""),
        appliedCount: 1,
        totalRows: 1,
        skippedCount: 0,
      };
    },
    actionRenameCleanup: async (_runtime: unknown, options: Record<string, unknown>) => {
      context.recordAction("rename:cleanup", options);
      if (String(options.path ?? "") === "docs") {
        return {
          kind: "directory",
          changedCount: 2,
          totalCount: 3,
          directoryPath: context.resolveHarnessPath("docs"),
          planCsvPath: "plans/cleanup.csv",
        };
      }

      return {
        kind: "file",
        changed: false,
        filePath: context.resolveHarnessPath(options.path),
        directoryPath: context.directoryPathForFile(options.path),
      };
    },
    resolveRenameCleanupTarget: async (_runtime: unknown, inputPath: unknown) => {
      if (String(inputPath ?? "") === "docs") {
        return { kind: "directory", path: "docs" };
      }

      return { kind: "file", path: String(inputPath ?? "") };
    },
    collectRenameCleanupAnalyzerEvidence: async (
      _runtime: unknown,
      options: RenameCleanupCollectOptions,
    ) => {
      if (context.scenario.captureCleanupCollectInput) {
        context.recordAction("rename:cleanup:collect-evidence", {
          path: options.path,
          recursive: options.recursive,
          maxDepth: options.maxDepth,
          matchRegex: options.matchRegex,
          skipRegex: options.skipRegex,
          ext: options.ext,
          skipExt: options.skipExt,
          sampleLimit: options.sampleLimit,
          groupLimit: options.groupLimit,
          examplesPerGroup: options.examplesPerGroup,
        });
      }

      options.onProgress?.("sampling");
      if (context.scenario.cleanupAnalyzerEvidence) {
        options.onProgress?.("grouping");
        return context.scenario.cleanupAnalyzerEvidence;
      }

      const inputPath = String(options.path ?? "");
      options.onProgress?.("grouping");
      return createDefaultRenameCleanupEvidence(inputPath);
    },
    suggestRenameCleanupWithCodex: async (options: RenameCleanupSuggestOptions) => {
      if (context.scenario.captureCleanupSuggestInput) {
        context.recordAction("rename:cleanup:codex-suggest", {
          targetKind: options.evidence?.targetKind,
          totalCandidateCount: options.evidence?.totalCandidateCount,
          sampledCount: options.evidence?.sampledCount,
          sampleNames: options.evidence?.sampleNames,
          groupedPatterns: Array.isArray(options.evidence?.groupedPatterns)
            ? options.evidence.groupedPatterns.map((group) => ({
                pattern: group.pattern,
                count: group.count,
                examples: group.examples,
              }))
            : [],
        });
      }

      if (context.scenario.cleanupAnalyzerErrorMessage) {
        return { errorMessage: context.scenario.cleanupAnalyzerErrorMessage };
      }

      return {
        suggestion:
          context.scenario.cleanupAnalyzerSuggestion ?? {
            recommendedHints: ["serial"],
            recommendedStyle: "slug",
            confidence: 0.86,
            reasoningSummary:
              "Most sampled names differ only by trailing counters.",
          },
      };
    },
    writeRenameCleanupAnalysisCsv: async () => {
      const csvPath =
        context.scenario.cleanupAnalysisReportPath ??
        "reports/cleanup-analysis.csv";
      context.recordAction("rename:cleanup:analysis-report", { csvPath });
      return csvPath;
    },
  };
}
