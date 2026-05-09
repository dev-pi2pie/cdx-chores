import { confirm, select } from "@inquirer/prompts";

import { actionRenameApply, actionRenameCleanup, resolveRenameCleanupTarget } from "../../actions";
import { promptRequiredPathWithConfig } from "../../prompts/path";
import type { CliRuntime } from "../../types";
import { reviewCleanupAppliedArtifacts, reviewCleanupDryRunArtifacts } from "./artifact-retention";
import { promptCleanupSettingsFromSuggestion } from "./codex-suggestion";
import {
  ANALYZER_FAMILY_VALUES,
  promptCleanupAnalyzerFamilies,
  promptCleanupConflictStrategy,
  promptCleanupScopeOptions,
  promptManualCleanupSettings,
} from "./settings-prompts";
import type { InteractivePathPromptContext } from "../shared";

export async function runInteractiveRenameCleanup(
  runtime: CliRuntime,
  pathPromptContext: InteractivePathPromptContext,
): Promise<void> {
  const path = await promptRequiredPathWithConfig("Target path", {
    kind: "path",
    ...pathPromptContext,
  });
  const target = await resolveRenameCleanupTarget(runtime, path);
  const scope = await promptCleanupScopeOptions(target.kind);

  const suggestWithCodex = await confirm({
    message: "Suggest cleanup hints with Codex?",
    default: false,
  });
  const analyzerFamilies = suggestWithCodex ? await promptCleanupAnalyzerFamilies() : undefined;
  const suggestionResult = suggestWithCodex
    ? await promptCleanupSettingsFromSuggestion(runtime, {
        path,
        analyzerFamilies: analyzerFamilies ?? ANALYZER_FAMILY_VALUES,
        scope,
      })
    : undefined;
  const cleanupSettings = suggestionResult?.settings ?? (await promptManualCleanupSettings());
  const cleanupActionSettings = {
    hints: cleanupSettings.hints,
    style: cleanupSettings.style,
    timestampAction: cleanupSettings.timestampAction,
  };
  const analysisReportPath = suggestionResult?.analysisReportPath;

  const conflictStrategy = await promptCleanupConflictStrategy();
  const dryRun = await confirm({ message: "Dry run only?", default: true });
  const previewSkips =
    target.kind === "directory" && dryRun
      ? await select<"summary" | "detailed">({
          message: "Skipped-item preview mode",
          choices: [
            {
              name: "summary",
              value: "summary",
              description: "Compact skipped summary grouped by reason",
            },
            {
              name: "detailed",
              value: "detailed",
              description: "Show skipped summary plus bounded per-item skipped rows",
            },
          ],
          default: "summary",
        })
      : undefined;

  const result = await actionRenameCleanup(runtime, {
    path,
    ...cleanupActionSettings,
    conflictStrategy,
    ...scope,
    dryRun,
    previewSkips,
  });

  const hasChanges = result.kind === "file" ? result.changed : result.changedCount > 0;
  if (!dryRun || !hasChanges || !result.planCsvPath) {
    return;
  }

  const applyNow = await confirm({ message: "Apply these renames now?", default: false });
  if (!applyNow) {
    await reviewCleanupDryRunArtifacts(runtime, {
      planCsvPath: result.planCsvPath,
      analysisReportPath,
    });
    return;
  }

  await actionRenameApply(runtime, { csv: result.planCsvPath, autoClean: false });
  await reviewCleanupAppliedArtifacts(runtime, {
    planCsvPath: result.planCsvPath,
    analysisReportPath,
  });
}
