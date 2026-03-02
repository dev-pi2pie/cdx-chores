import { resolveAutoCodexFlagsForFilePath, resolveCodexFlagsFromCliOptions } from "../../rename-interactive-router";
import {
  type RenameSerialOrder,
  type RenameSerialScope,
  type TimestampTimezone,
} from "../../rename-template";
import { applyPlannedRenames, planSingleRename } from "../../fs-utils";
import type { CliRuntime } from "../../types";
import {
  type CodexDocumentRenameTitleSuggester,
  type CodexImageRenameTitleSuggester,
  printRenameFileCodexSummary,
  runRenameCodexAnalysis,
} from "./codex";
import {
  resolveEffectivePattern,
  writeSingleRenameDryRunPlanCsv,
} from "./plan-output";
import {
  printRenameFileApplyFooter,
  printRenameFileDryRunFooter,
  printRenameFilePreview,
} from "./reporting";
import { assertNonEmpty, displayPath, printLine } from "../shared";

export interface RenameFileOptions {
  path: string;
  prefix?: string;
  pattern?: string;
  codex?: boolean;
  serialOrder?: RenameSerialOrder;
  serialStart?: number;
  serialWidth?: number;
  serialScope?: RenameSerialScope;
  timestampTimezone?: TimestampTimezone;
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

export async function actionRenameFile(
  runtime: CliRuntime,
  options: RenameFileOptions,
): Promise<{ changed: boolean; filePath: string; directoryPath: string; planCsvPath?: string }> {
  const inputPath = assertNonEmpty(options.path, "File path");
  const effectivePattern = resolveEffectivePattern(options.pattern, options.timestampTimezone);
  const initial = await planSingleRename(runtime, inputPath, {
    prefix: options.prefix,
    pattern: effectivePattern,
    serialOrder: options.serialOrder,
    serialStart: options.serialStart,
    serialWidth: options.serialWidth,
    serialScope: options.serialScope,
    now: runtime.now(),
  });
  const effectiveCodexFlags = resolveCodexFlagsFromCliOptions({
    cli: {
      codex: options.codex,
      codexImages: options.codexImages,
      codexDocs: options.codexDocs,
    },
    fallbackAuto: resolveAutoCodexFlagsForFilePath(initial.plan.fromPath),
  });
  const directoryPath = initial.directoryPath;
  let plan = initial.plan;
  const codexAnalysis = await runRenameCodexAnalysis(runtime, [initial.plan], {
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
  const codexTitlesByPath = new Map<string, string>(codexAnalysis.titlesByPath);
  const titleOverride = codexTitlesByPath.get(initial.plan.fromPath);
  if (titleOverride) {
    const replanned = await planSingleRename(runtime, inputPath, {
      prefix: options.prefix,
      pattern: effectivePattern,
      serialOrder: options.serialOrder,
      serialStart: options.serialStart,
      serialWidth: options.serialWidth,
      serialScope: options.serialScope,
      now: runtime.now(),
      titleOverride,
    });
    plan = replanned.plan;
  }

  printLine(runtime.stdout, `Directory: ${displayPath(runtime, directoryPath)}`);
  printLine(runtime.stdout, `File: ${displayPath(runtime, plan.fromPath)}`);
  printRenameFileCodexSummary(runtime, {
    analysis: codexAnalysis,
    sourcePath: plan.fromPath,
    codexRequested: options.codex ?? false,
  });
  printRenameFilePreview(runtime, plan);

  if (options.dryRun ?? false) {
    const planCsvPath = await writeSingleRenameDryRunPlanCsv(runtime, {
      plan,
      codexTitlesByPath,
      reasonBySourcePath: codexAnalysis.reasonBySourcePath,
      effectivePattern,
    });

    printRenameFileDryRunFooter(runtime, planCsvPath);
    return { changed: plan.changed, filePath: plan.fromPath, directoryPath, planCsvPath };
  }

  await applyPlannedRenames([plan]);
  printRenameFileApplyFooter(runtime, plan.changed);

  return { changed: plan.changed, filePath: plan.fromPath, directoryPath };
}
