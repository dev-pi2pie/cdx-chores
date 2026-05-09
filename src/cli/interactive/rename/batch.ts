import { confirm, input, select } from "@inquirer/prompts";

import { actionRenameApply, actionRenameBatch } from "../../actions";
import { promptRequiredPathWithConfig } from "../../prompts/path";
import {
  type RenameInteractiveCodexFlags as InteractiveCodexFlags,
  type RenameInteractiveCodexScope as InteractiveCodexScope,
  resolveAutoCodexFlagsForBatchProfile,
  resolveCodexFlagsFromScope,
} from "../../rename-interactive-router";
import type { CliRuntime } from "../../types";
import { promptRenamePatternConfig } from "./pattern";
import type { InteractivePathPromptContext } from "../shared";

export async function handleRenameBatchInteractiveAction(
  runtime: CliRuntime,
  pathPromptContext: InteractivePathPromptContext,
): Promise<void> {
  const directory = await promptRequiredPathWithConfig("Target directory", {
    kind: "directory",
    ...pathPromptContext,
  });
  const profile = await select<string>({
    message: "File profile scope",
    choices: [
      {
        name: "All files (default)",
        value: "all",
        description: "No preset filter (still skips hidden/system junk by default)",
      },
      {
        name: "Images",
        value: "images",
        description: "Common image files: .png, .jpg, .webp, .gif, .svg, ...",
      },
      {
        name: "Media (images/audio/video)",
        value: "media",
        description: "Images + video/audio files: .mp4, .mov, .mp3, .wav, ...",
      },
      {
        name: "Docs",
        value: "docs",
        description: "Docs/data files: .md, .pdf, .docx, .csv, .json, .yaml, ...",
      },
    ],
  });
  const recursive = await confirm({
    message: "Traverse subdirectories recursively?",
    default: false,
  });
  const patternConfig = await promptRenamePatternConfig({
    includeSerialScope: recursive,
    pathPromptContext,
  });
  const prefix = patternConfig.usesPrefix
    ? await input({
        message: "Filename prefix (optional)",
        default: "",
      })
    : undefined;
  const maxDepthInput = recursive
    ? await input({ message: "Max recursive depth (optional, root=0)", default: "" })
    : "";
  const dryRun = await confirm({ message: "Dry run only?", default: true });
  const previewSkips = dryRun
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
    : "summary";
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
          description: "Route based on profile scope and supported extensions",
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
      fallbackAuto: resolveAutoCodexFlagsForBatchProfile(profile),
    });
  }
  const result = await actionRenameBatch(runtime, {
    directory,
    prefix,
    pattern: patternConfig.pattern,
    serialOrder: patternConfig.serialOrder,
    serialStart: patternConfig.serialStart,
    serialWidth: patternConfig.serialWidth,
    serialScope: recursive ? patternConfig.serialScope : "global",
    profile: profile === "all" ? undefined : profile,
    recursive,
    maxDepth: maxDepthInput.trim() ? Number(maxDepthInput) : undefined,
    dryRun,
    previewSkips,
    codexImages: codexFlags.codexImages,
    codexDocs: codexFlags.codexDocs,
  });

  if (!dryRun && result.changedCount > 0) {
    return;
  }

  if (dryRun && result.changedCount > 0) {
    const applyNow = await confirm({ message: "Apply these renames now?", default: false });
    if (applyNow && result.planCsvPath) {
      const autoClean = await confirm({
        message: "Auto-clean plan CSV after apply?",
        default: true,
      });
      await actionRenameApply(runtime, { csv: result.planCsvPath, autoClean });
    }
  }
}
