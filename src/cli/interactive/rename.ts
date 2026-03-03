import { confirm, input, select } from "@inquirer/prompts";

import {
  actionRenameApply,
  actionRenameBatch,
  actionRenameFile,
} from "../actions";
import { promptRequiredPathWithConfig } from "../prompts/path";
import { promptTextWithGhost } from "../prompts/text-inline";
import {
  type RenameInteractiveCodexFlags as InteractiveCodexFlags,
  type RenameInteractiveCodexScope as InteractiveCodexScope,
  resolveAutoCodexFlagsForBatchProfile,
  resolveAutoCodexFlagsForFilePath,
  resolveCodexFlagsFromScope,
} from "../rename-interactive-router";
import {
  type RenameSerialOrder,
  type RenameSerialScope,
  type RenameTemplatePreset,
  type TimestampTimezone,
  RENAME_SERIAL_ORDER_VALUES,
  normalizeSerialPlaceholderInTemplate,
  resolveRenamePatternTemplate,
  resolveTimestampPatternForInteractive,
  shouldPromptTimestampTimezone,
  templateContainsPrefixPlaceholder,
  templateContainsSerialPlaceholder,
} from "../rename-template";
import type { CliRuntime } from "../types";
import type { RenameInteractiveActionKey } from "./menu";
import { runInteractiveRenameCleanup } from "./rename-cleanup";
import { assertNeverInteractiveAction, type InteractivePathPromptContext } from "./shared";

function validateIntegerInput(
  value: string,
  options: { min?: number; allowEmpty?: boolean },
): true | string {
  const trimmed = value.trim();
  if (!trimmed) {
    return options.allowEmpty ? true : "Required";
  }
  if (!/^\d+$/.test(trimmed)) {
    return "Must be a non-negative integer";
  }
  const parsed = Number(trimmed);
  const min = options.min ?? 0;
  if (parsed < min) {
    return `Must be >= ${min}`;
  }
  return true;
}

async function promptRenamePatternConfig(options: {
  includeSerialScope: boolean;
  pathPromptContext: InteractivePathPromptContext;
}): Promise<{
  pattern: string;
  usesPrefix: boolean;
  serialOrder?: RenameSerialOrder;
  serialStart?: number;
  serialWidth?: number;
  serialScope: RenameSerialScope;
}> {
  const preset = await select<RenameTemplatePreset>({
    message: "Filename template preset",
    choices: [
      {
        name: "default",
        value: "default",
        description: "{prefix}-{timestamp}-{stem}",
      },
      {
        name: "timestamp-first",
        value: "timestamp-first",
        description: "{timestamp}-{prefix}-{stem}",
      },
      {
        name: "stem-first",
        value: "stem-first",
        description: "{stem}-{timestamp}-{prefix}",
      },
      {
        name: "custom",
        value: "custom",
        description: "Provide a custom template string",
      },
    ],
  });

  const customTemplate =
    preset === "custom"
      ? await promptTextWithGhost({
          message: [
            "Custom filename template",
            "Main placeholders: {prefix}, {timestamp}, {date}, {stem}, {serial}",
            "Advanced: explicit timestamp variants and {serial...} params are also supported.",
          ].join("\n"),
          ghostText: "{timestamp}-{stem}",
          runtimeConfig: options.pathPromptContext.runtimeConfig,
          stdin: options.pathPromptContext.stdin,
          stdout: options.pathPromptContext.stdout,
          validate: (value) => (value.trim() ? true : "Required"),
        })
      : undefined;

  const basePattern = resolveRenamePatternTemplate({
    preset,
    customTemplate,
  });
  const usesPrefix = templateContainsPrefixPlaceholder(basePattern);
  const usesSerial = templateContainsSerialPlaceholder(basePattern);

  const serialOrder = usesSerial
    ? await select<RenameSerialOrder>({
        message: "Serial order",
        choices: RENAME_SERIAL_ORDER_VALUES.map((value) => ({
          name: value,
          value,
          description: value.startsWith("mtime_")
            ? "mtime uses file modified time"
            : "path uses deterministic path ordering",
        })),
        default: "path_asc",
      })
    : undefined;

  const serialStartInput = usesSerial
    ? await input({
        message: "Serial start number",
        default: "1",
        validate: (value) => validateIntegerInput(value, { min: 0 }),
      })
    : "";

  const serialWidthInput = usesSerial
    ? await input({
        message: "Serial min width in digits (optional, e.g. 2 => 01)",
        default: "",
        validate: (value) => validateIntegerInput(value, { min: 1, allowEmpty: true }),
      })
    : "";

  const serialScope =
    options.includeSerialScope && usesSerial
      ? await select<RenameSerialScope>({
          message: "Serial scope",
          choices: [
            {
              name: "global",
              value: "global",
              description: "Single serial sequence across recursive traversal",
            },
            {
              name: "directory",
              value: "directory",
              description: "Reset serial per directory when recursive",
            },
          ],
          default: "global",
        })
      : "global";

  const serialStart = serialStartInput.trim() ? Number(serialStartInput.trim()) : undefined;
  const serialWidth = serialWidthInput.trim() ? Number(serialWidthInput.trim()) : undefined;
  const pattern =
    usesSerial && serialOrder !== undefined && serialStart !== undefined
      ? normalizeSerialPlaceholderInTemplate({
          template: basePattern,
          serial: {
            order: serialOrder,
            start: serialStart,
            width: serialWidth,
          },
        })
      : basePattern;

  const timestampTimezone: TimestampTimezone | undefined = shouldPromptTimestampTimezone(pattern)
    ? await select<TimestampTimezone>({
        message: "Timestamp timezone basis",
        choices: [
          {
            name: "utc",
            value: "utc",
            description: "Stable cross-machine/audit naming (default)",
          },
          {
            name: "local",
            value: "local",
            description: "Local clock naming for personal use",
          },
        ],
        default: "utc",
      })
    : undefined;

  const finalPattern = resolveTimestampPatternForInteractive(pattern, timestampTimezone);

  return {
    pattern: finalPattern,
    usesPrefix,
    serialOrder,
    serialStart,
    serialWidth,
    serialScope,
  };
}

export async function handleRenameInteractiveAction(
  runtime: CliRuntime,
  pathPromptContext: InteractivePathPromptContext,
  action: RenameInteractiveActionKey,
): Promise<void> {
  if (action === "rename:batch") {
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
    return;
  }

  if (action === "rename:cleanup") {
    await runInteractiveRenameCleanup(runtime, pathPromptContext);
    return;
  }

  if (action === "rename:file") {
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
    return;
  }

  if (action !== "rename:apply") {
    assertNeverInteractiveAction(action);
  }

  const csvPath = await promptRequiredPathWithConfig("Rename plan CSV path", {
    kind: "csv",
    ...pathPromptContext,
  });
  const autoClean = await confirm({
    message: "Auto-clean plan CSV after apply?",
    default: true,
  });
  await actionRenameApply(runtime, { csv: csvPath, autoClean });
}
