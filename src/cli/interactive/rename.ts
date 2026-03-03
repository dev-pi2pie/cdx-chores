import { confirm, input, select } from "@inquirer/prompts";

import {
  actionRenameApply,
  actionRenameBatch,
  actionRenameCleanup,
  actionRenameFile,
  resolveRenameCleanupTarget,
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
import { assertNeverInteractiveAction, type InteractivePathPromptContext } from "./shared";

type InteractiveCleanupHint = "date" | "timestamp" | "serial" | "uid";

const INTERACTIVE_CLEANUP_HINT_CHOICES: Array<{
  name: string;
  value: InteractiveCleanupHint;
  description: string;
}> = [
  {
    name: "timestamp",
    value: "timestamp",
    description: "Date-plus-time fragments such as macOS screenshot timestamps",
  },
  { name: "date", value: "date", description: "Date-only fragments such as 2026-03-03" },
  { name: "serial", value: "serial", description: "Trailing counters such as (2), -01, or _003" },
  { name: "uid", value: "uid", description: "Existing uid-<token> fragments" },
];

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

function parseInteractiveCsvList(value: string): string[] | undefined {
  const items = value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  return items.length > 0 ? items : undefined;
}

async function promptInteractiveCleanupHints(): Promise<InteractiveCleanupHint[]> {
  const selected: InteractiveCleanupHint[] = [];

  while (true) {
    const remainingChoices = INTERACTIVE_CLEANUP_HINT_CHOICES.filter(
      (choice) => !selected.includes(choice.value),
    );
    const choice = await select<InteractiveCleanupHint | "done">({
      message: selected.length === 0 ? "Add a cleanup hint" : "Add another cleanup hint or finish",
      choices: [
        ...remainingChoices,
        ...(selected.length > 0
          ? [
              {
                name: "done",
                value: "done" as const,
                description: `Selected: ${selected.join(", ")}`,
              },
            ]
          : []),
      ],
    });

    if (choice === "done") {
      return selected;
    }

    selected.push(choice);
  }
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
    const path = await promptRequiredPathWithConfig("Target path", {
      kind: "path",
      ...pathPromptContext,
    });
    const target = await resolveRenameCleanupTarget(runtime, path);
    const pathKind = target.kind;
    const hints = await promptInteractiveCleanupHints();
    const style = await select<"preserve" | "slug">({
      message: "Cleanup output style",
      choices: [
        {
          name: "preserve",
          value: "preserve",
          description: "Keep readable spacing while normalizing matched fragments",
        },
        {
          name: "slug",
          value: "slug",
          description: "Convert the remaining text to kebab-case",
        },
      ],
      default: "preserve",
    });
    const timestampAction = hints.includes("timestamp")
      ? await select<"keep" | "remove">({
          message: "Timestamp fragment handling",
          choices: [
            {
              name: "keep",
              value: "keep",
              description: "Keep matched timestamps in normalized form",
            },
            {
              name: "remove",
              value: "remove",
              description: "Remove matched timestamps from the basename",
            },
          ],
          default: "keep",
        })
      : undefined;
    const conflictStrategy = await select<"skip" | "number" | "uid-suffix">({
      message: "Cleanup conflict strategy",
      choices: [
        {
          name: "skip",
          value: "skip",
          description: "Keep the clean target when free and skip only the conflicted rows",
        },
        {
          name: "number",
          value: "number",
          description: "Append -1, -2, -3 only when the cleaned target conflicts",
        },
        {
          name: "uid-suffix",
          value: "uid-suffix",
          description: "Append -uid-<token> only when the cleaned target conflicts",
        },
      ],
      default: "skip",
    });
    const recursive =
      pathKind === "directory"
        ? await confirm({
            message: "Traverse subdirectories recursively?",
            default: false,
          })
        : false;
    const maxDepthInput =
      pathKind === "directory" && recursive
        ? await input({ message: "Max recursive depth (optional, root=0)", default: "" })
        : "";
    const addDirectoryFilters =
      pathKind === "directory"
        ? await confirm({
            message: "Filter files before cleanup?",
            default: false,
          })
        : false;
    const matchRegex =
      pathKind === "directory" && addDirectoryFilters
        ? await input({ message: "Match regex (optional)", default: "" })
        : "";
    const skipRegex =
      pathKind === "directory" && addDirectoryFilters
        ? await input({ message: "Skip regex (optional)", default: "" })
        : "";
    const extInput =
      pathKind === "directory" && addDirectoryFilters
        ? await input({
            message: "Only extensions (optional, comma-separated)",
            default: "",
          })
        : "";
    const skipExtInput =
      pathKind === "directory" && addDirectoryFilters
        ? await input({
            message: "Skip extensions (optional, comma-separated)",
            default: "",
          })
        : "";
    const dryRun = await confirm({ message: "Dry run only?", default: true });
    const previewSkips =
      pathKind === "directory" && dryRun
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
      hints,
      style,
      timestampAction,
      conflictStrategy,
      recursive: pathKind === "directory" ? recursive : undefined,
      maxDepth: maxDepthInput.trim() ? Number(maxDepthInput.trim()) : undefined,
      matchRegex: matchRegex.trim() ? matchRegex.trim() : undefined,
      skipRegex: skipRegex.trim() ? skipRegex.trim() : undefined,
      ext: parseInteractiveCsvList(extInput),
      skipExt: parseInteractiveCsvList(skipExtInput),
      dryRun,
      previewSkips,
    });

    const hasChanges = result.kind === "file" ? result.changed : result.changedCount > 0;
    if (!dryRun || !hasChanges || !result.planCsvPath) {
      return;
    }

    const applyNow = await confirm({ message: "Apply these renames now?", default: false });
    if (applyNow) {
      const autoClean = await confirm({
        message: "Auto-clean plan CSV after apply?",
        default: true,
      });
      await actionRenameApply(runtime, { csv: result.planCsvPath, autoClean });
    }
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
