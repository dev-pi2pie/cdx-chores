import { confirm, input, select } from "@inquirer/prompts";

import { actionRenameApply, actionRenameFile } from "../../actions";
import { promptRequiredPathWithConfig } from "../../prompts/path";
import {
  type RenameInteractiveCodexFlags as InteractiveCodexFlags,
  type RenameInteractiveCodexScope as InteractiveCodexScope,
  resolveAutoCodexFlagsForFilePath,
  resolveCodexFlagsFromScope,
} from "../../rename-interactive-router";
import type { CliRuntime } from "../../types";
import { promptRenamePatternConfig } from "./pattern";
import type { InteractivePathPromptContext } from "../shared";

export async function handleRenameFileInteractiveAction(
  runtime: CliRuntime,
  pathPromptContext: InteractivePathPromptContext,
): Promise<void> {
  const path = await promptRequiredPathWithConfig("Target file", {
    kind: "file",
    ...pathPromptContext,
  });
  const patternConfig = await promptRenamePatternConfig({
    includeSerialScope: false,
    pathPromptContext,
  });
  const prefix = patternConfig.usesPrefix
    ? await input({
        message: "Filename prefix (optional)",
        default: "",
      })
    : undefined;
  const dryRun = await confirm({ message: "Dry run only?", default: true });
  const codexEnabled = await confirm({
    message: "Enable Codex assistant when eligible?",
    default: false,
  });
  let codexFlags: InteractiveCodexFlags = { codexImages: false, codexDocs: false };
  if (codexEnabled) {
    const scope = await select<InteractiveCodexScope>({
      message: "Codex assistant scope",
      choices: [
        {
          name: "auto",
          value: "auto",
          description: "Route based on selected file extension and supported analyzers",
        },
        {
          name: "images",
          value: "images",
          description: "Enable only image analyzer",
        },
        {
          name: "docs",
          value: "docs",
          description: "Enable only document analyzer",
        },
      ],
      default: "auto",
    });
    codexFlags = resolveCodexFlagsFromScope({
      scope,
      fallbackAuto: resolveAutoCodexFlagsForFilePath(path),
    });
  }
  const result = await actionRenameFile(runtime, {
    path,
    prefix,
    pattern: patternConfig.pattern,
    serialOrder: patternConfig.serialOrder,
    serialStart: patternConfig.serialStart,
    serialWidth: patternConfig.serialWidth,
    serialScope: "global",
    dryRun,
    codexImages: codexFlags.codexImages,
    codexDocs: codexFlags.codexDocs,
  });

  if (!dryRun || !result.changed) {
    return;
  }

  const applyNow = await confirm({ message: "Apply this rename now?", default: false });
  if (applyNow && result.planCsvPath) {
    const autoClean = await confirm({
      message: "Auto-clean plan CSV after apply?",
      default: true,
    });
    await actionRenameApply(runtime, { csv: result.planCsvPath, autoClean });
  }
}
