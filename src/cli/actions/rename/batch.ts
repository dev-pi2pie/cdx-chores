import { CliError } from "../../errors";
import { resolveAutoCodexFlagsForPaths, resolveCodexFlagsFromCliOptions } from "../../rename-interactive-router";
import {
  type RenameSerialOrder,
  type RenameSerialScope,
  type TimestampTimezone,
} from "../../rename-template";
import { applyPlannedRenames } from "../../rename/apply";
import { planBatchRename } from "../../rename/planner";
import type { CliRuntime } from "../../types";
import {
  type CodexDocumentRenameTitleSuggester,
  type CodexImageRenameTitleSuggester,
  printRenameBatchCodexSummary,
  runRenameCodexAnalysis,
} from "./codex";
import {
  createRenameBatchFileFilter,
  normalizeRenameBatchMaxDepth,
} from "./filters";
import {
  resolveEffectivePattern,
  writeBatchRenameDryRunPlanCsv,
} from "./plan-output";
import {
  printRenameBatchApplyFooter,
  printRenameBatchDryRunFooter,
  printRenameBatchPreview,
} from "./reporting";
import { assertNonEmpty, displayPath, printLine } from "../shared";

export interface RenameBatchOptions {
  directory: string;
  prefix?: string;
  pattern?: string;
  serialOrder?: RenameSerialOrder;
  serialStart?: number;
  serialWidth?: number;
  serialScope?: RenameSerialScope;
  timestampTimezone?: TimestampTimezone;
  profile?: string;
  dryRun?: boolean;
  previewSkips?: "summary" | "detailed";
  recursive?: boolean;
  maxDepth?: number;
  matchRegex?: string;
  skipRegex?: string;
  ext?: string[];
  skipExt?: string[];
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

function normalizeRenamePreviewSkipsMode(
  mode: RenameBatchOptions["previewSkips"],
): "summary" | "detailed" {
  if (mode === undefined || mode === "summary") {
    return "summary";
  }
  if (mode === "detailed") {
    return "detailed";
  }
  throw new CliError(`Invalid --preview-skips value: ${mode}. Expected one of: summary, detailed`, {
    code: "INVALID_INPUT",
    exitCode: 2,
  });
}

export async function actionRenameBatch(
  runtime: CliRuntime,
  options: RenameBatchOptions,
): Promise<{
  changedCount: number;
  totalCount: number;
  directoryPath: string;
  planCsvPath?: string;
}> {
  const directory = assertNonEmpty(options.directory, "Directory path");
  const previewSkips = normalizeRenamePreviewSkipsMode(options.previewSkips);
  const maxDepth = normalizeRenameBatchMaxDepth(options);
  const fileFilter = createRenameBatchFileFilter(options);
  const effectivePattern = resolveEffectivePattern(options.pattern, options.timestampTimezone);
  const initial = await planBatchRename(runtime, directory, {
    prefix: options.prefix,
    pattern: effectivePattern,
    serialOrder: options.serialOrder,
    serialStart: options.serialStart,
    serialWidth: options.serialWidth,
    serialScope: options.serialScope,
    now: runtime.now(),
    fileFilter,
    recursive: options.recursive,
    maxDepth,
  });
  const directoryPath = initial.directoryPath;
  const skipped = initial.skipped;
  const effectiveCodexFlags = resolveCodexFlagsFromCliOptions({
    cli: {
      codex: options.codex,
      codexImages: options.codexImages,
      codexDocs: options.codexDocs,
    },
    fallbackAuto: resolveAutoCodexFlagsForPaths(initial.plans.map((plan) => plan.fromPath)),
  });
  const codexAnalysis = await runRenameCodexAnalysis(runtime, initial.plans, {
    effectiveFlags: effectiveCodexFlags,
    cli: {
      codex: options.codex,
      codexImages: options.codexImages,
      codexImagesTimeoutMs: options.codexImagesTimeoutMs,
      codexImagesRetries: options.codexImagesRetries,
      codexImagesBatchSize: options.codexImagesBatchSize,
      codexImagesTitleSuggester: options.codexImagesTitleSuggester,
      codexDocs: options.codexDocs,
      codexDocsTimeoutMs: options.codexDocsTimeoutMs,
      codexDocsRetries: options.codexDocsRetries,
      codexDocsBatchSize: options.codexDocsBatchSize,
      codexDocsTitleSuggester: options.codexDocsTitleSuggester,
    },
  });
  const titleOverrides =
    codexAnalysis.titlesByPath.size > 0 ? new Map(codexAnalysis.titlesByPath) : undefined;
  const codexTitlesByPath =
    codexAnalysis.titlesByPath.size > 0 ? new Map(codexAnalysis.titlesByPath) : undefined;

  const { plans } = titleOverrides
    ? await planBatchRename(runtime, directory, {
        prefix: options.prefix,
        pattern: effectivePattern,
        serialOrder: options.serialOrder,
        serialStart: options.serialStart,
        serialWidth: options.serialWidth,
        serialScope: options.serialScope,
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
  printRenameBatchCodexSummary(runtime, {
    analysis: codexAnalysis,
    totalCount,
    codexRequested: options.codex ?? false,
  });
  printLine(runtime.stdout);

  const { truncated } = printRenameBatchPreview(runtime, {
    plans,
    skipped,
    previewSkips,
    dryRun: options.dryRun ?? false,
  });

  if (options.dryRun ?? false) {
    planCsvPath = await writeBatchRenameDryRunPlanCsv(runtime, {
      plans,
      skippedItems: skipped,
      codexTitlesByPath,
      reasonBySourcePath: codexAnalysis.reasonBySourcePath,
      effectivePattern,
    });

    printRenameBatchDryRunFooter(runtime, {
      planCsvPath,
      truncated,
    });
    return { changedCount, totalCount, directoryPath, planCsvPath };
  }

  await applyPlannedRenames(plans);
  printRenameBatchApplyFooter(runtime, changedCount);

  return { changedCount, totalCount, directoryPath };
}
