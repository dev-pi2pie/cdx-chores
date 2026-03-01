import { confirm, input, select } from "@inquirer/prompts";

import {
  actionCsvToJson,
  actionDoctor,
  actionJsonToCsv,
  actionMdFrontmatterToJson,
  actionMdToDocx,
  actionRenameApply,
  actionRenameBatch,
  actionRenameFile,
  actionVideoConvert,
  actionVideoGif,
  actionVideoResize,
} from "./actions";
import {
  formatDefaultOutputPathHint,
  promptOptionalOutputPathChoice,
  promptRequiredPathWithConfig,
} from "./prompts/path";
import { resolvePathPromptRuntimeConfig } from "./prompts/path-config";
import {
  type RenameSerialOrder,
  type RenameSerialScope,
  type RenameTemplatePreset,
  RENAME_SERIAL_ORDER_VALUES,
  normalizeSerialPlaceholderInTemplate,
  resolveRenamePatternTemplate,
  templateContainsPrefixPlaceholder,
  templateContainsSerialPlaceholder,
} from "./rename-template";
import {
  type RenameInteractiveCodexFlags as InteractiveCodexFlags,
  type RenameInteractiveCodexScope as InteractiveCodexScope,
  resolveAutoCodexFlagsForBatchProfile,
  resolveAutoCodexFlagsForFilePath,
  resolveCodexFlagsFromScope,
} from "./rename-interactive-router";
import type { CliRuntime } from "./types";

type InteractiveActionKey =
  | "doctor"
  | "data:json-to-csv"
  | "data:csv-to-json"
  | "md:to-docx"
  | "md:frontmatter-to-json"
  | "rename:file"
  | "rename:batch"
  | "rename:apply"
  | "video:convert"
  | "video:resize"
  | "video:gif";

type InteractiveRootChoice = "doctor" | "data" | "md" | "rename" | "video" | "cancel";
type InteractiveSubmenuGroup = Exclude<InteractiveRootChoice, "doctor" | "cancel">;
type InteractiveSubmenuChoice = InteractiveActionKey | "back" | "cancel";

type InteractiveMenuChoice<T extends string> = {
  name: string;
  value: T;
  description?: string;
};

type InteractiveSubmenuConfig = {
  message: string;
  choices: Array<InteractiveMenuChoice<InteractiveActionKey>>;
};

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

async function promptRenamePatternConfig(options: { includeSerialScope: boolean }): Promise<{
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
      ? await input({
          message: [
            "Custom filename template",
            "Placeholders: {prefix}, {timestamp}, {timestamp_local}, {timestamp_utc}, {date}, {date_local}, {date_utc}, {stem}, {serial...}",
            "Example: {date}-{stem}-{serial}",
          ].join("\n"),
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

  return {
    pattern,
    usesPrefix,
    serialOrder,
    serialStart,
    serialWidth,
    serialScope,
  };
}

const INTERACTIVE_ROOT_CHOICES: Array<InteractiveMenuChoice<InteractiveRootChoice>> = [
  { name: "doctor", value: "doctor", description: "Check dependencies and capabilities" },
  { name: "data", value: "data", description: "JSON/CSV conversions" },
  { name: "md", value: "md", description: "Markdown utilities" },
  { name: "rename", value: "rename", description: "File/batch rename workflows" },
  { name: "video", value: "video", description: "Video conversion tools" },
  { name: "cancel", value: "cancel" },
];

const INTERACTIVE_SUBMENUS: Record<InteractiveSubmenuGroup, InteractiveSubmenuConfig> = {
  data: {
    message: "Choose a data command",
    choices: [
      { name: "json-to-csv", value: "data:json-to-csv" },
      { name: "csv-to-json", value: "data:csv-to-json" },
    ],
  },
  md: {
    message: "Choose a markdown command",
    choices: [
      { name: "to-docx", value: "md:to-docx" },
      { name: "frontmatter-to-json", value: "md:frontmatter-to-json" },
    ],
  },
  rename: {
    message: "Choose a rename command",
    choices: [
      { name: "file", value: "rename:file" },
      { name: "batch", value: "rename:batch" },
      { name: "apply", value: "rename:apply" },
    ],
  },
  video: {
    message: "Choose a video command",
    choices: [
      { name: "convert", value: "video:convert" },
      { name: "resize", value: "video:resize" },
      { name: "gif", value: "video:gif" },
    ],
  },
};

async function selectInteractiveAction(): Promise<InteractiveActionKey | "cancel"> {
  while (true) {
    const rootChoice = await select<InteractiveRootChoice>({
      message: "Choose a command",
      choices: INTERACTIVE_ROOT_CHOICES,
    });

    if (rootChoice === "cancel") {
      return "cancel";
    }

    if (rootChoice === "doctor") {
      return "doctor";
    }

    const submenu = INTERACTIVE_SUBMENUS[rootChoice];
    const submenuChoice = await select<InteractiveSubmenuChoice>({
      message: submenu.message,
      choices: [
        ...submenu.choices,
        { name: "Back", value: "back", description: "Return to the main command menu" },
        { name: "Cancel", value: "cancel", description: "Exit interactive mode" },
      ],
    });

    if (submenuChoice === "back") {
      continue;
    }

    if (submenuChoice === "cancel") {
      return "cancel";
    }

    return submenuChoice;
  }
}

export async function runInteractiveMode(runtime: CliRuntime): Promise<void> {
  const pathPromptRuntimeConfig = resolvePathPromptRuntimeConfig();
  const pathPromptContext = {
    runtimeConfig: pathPromptRuntimeConfig,
    cwd: runtime.cwd,
    stdin: runtime.stdin,
    stdout: runtime.stdout,
  } as const;
  const action = await selectInteractiveAction();

  if (action === "cancel") {
    runtime.stdout.write("Cancelled.\n");
    return;
  }

  if (action === "doctor") {
    const asJson = await confirm({ message: "Output as JSON?", default: false });
    await actionDoctor(runtime, { json: asJson });
    return;
  }

  if (action === "data:json-to-csv") {
    const inputPath = await promptRequiredPathWithConfig("Input JSON file", {
      kind: "file",
      ...pathPromptContext,
    });
    const outputHint = formatDefaultOutputPathHint(runtime, inputPath, ".csv");
    const outputPath = await promptOptionalOutputPathChoice({
      message: "Output CSV file",
      defaultHint: outputHint,
      kind: "file",
      ...pathPromptContext,
      customMessage: "Custom CSV output path",
    });
    const overwrite = await confirm({ message: "Overwrite if exists?", default: false });
    await actionJsonToCsv(runtime, { input: inputPath, output: outputPath, overwrite });
    return;
  }

  if (action === "data:csv-to-json") {
    const inputPath = await promptRequiredPathWithConfig("Input CSV file", {
      kind: "file",
      ...pathPromptContext,
    });
    const outputHint = formatDefaultOutputPathHint(runtime, inputPath, ".json");
    const outputPath = await promptOptionalOutputPathChoice({
      message: "Output JSON file",
      defaultHint: outputHint,
      kind: "file",
      ...pathPromptContext,
      customMessage: "Custom JSON output path",
    });
    const pretty = await confirm({ message: "Pretty-print JSON?", default: true });
    const overwrite = await confirm({ message: "Overwrite if exists?", default: false });
    await actionCsvToJson(runtime, {
      input: inputPath,
      output: outputPath,
      pretty,
      overwrite,
    });
    return;
  }

  if (action === "md:to-docx") {
    const inputPath = await promptRequiredPathWithConfig("Input Markdown file", {
      kind: "file",
      ...pathPromptContext,
    });
    const outputHint = formatDefaultOutputPathHint(runtime, inputPath, ".docx");
    const outputPath = await promptOptionalOutputPathChoice({
      message: "Output DOCX file",
      defaultHint: outputHint,
      kind: "file",
      ...pathPromptContext,
      customMessage: "Custom DOCX output path",
    });
    const overwrite = await confirm({ message: "Overwrite if exists?", default: false });
    await actionMdToDocx(runtime, {
      input: inputPath,
      output: outputPath,
      overwrite,
    });
    return;
  }

  if (action === "md:frontmatter-to-json") {
    const inputPath = await promptRequiredPathWithConfig("Input Markdown file", {
      kind: "file",
      ...pathPromptContext,
    });
    const outputMode = await select<"stdout" | "file">({
      message: "JSON output destination",
      choices: [
        { name: "Print to stdout (default)", value: "stdout" },
        { name: "Write to file", value: "file" },
      ],
    });
    const outputShape = await select<"wrapper" | "data-only">({
      message: "JSON output shape",
      choices: [
        {
          name: "Wrapper (default)",
          value: "wrapper",
          description: "{ frontmatterType, data }",
        },
        {
          name: "Data only",
          value: "data-only",
          description: "Only the parsed frontmatter object",
        },
      ],
    });
    const pretty = await confirm({ message: "Pretty-print JSON?", default: true });

    let outputPath: string | undefined;
    let overwrite = false;
    if (outputMode === "file") {
      const outputHint = formatDefaultOutputPathHint(runtime, inputPath, ".frontmatter.json");
      outputPath = await promptOptionalOutputPathChoice({
        message: "Output JSON file",
        defaultHint: outputHint,
        kind: "file",
        ...pathPromptContext,
        customMessage: "Custom JSON output path",
      });
      overwrite = await confirm({ message: "Overwrite if exists?", default: false });
    }

    await actionMdFrontmatterToJson(runtime, {
      input: inputPath,
      toStdout: outputMode === "stdout",
      output: outputPath,
      overwrite,
      pretty,
      dataOnly: outputShape === "data-only",
    });
    return;
  }

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
    const patternConfig = await promptRenamePatternConfig({ includeSerialScope: recursive });
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

  if (action === "rename:file") {
    const path = await promptRequiredPathWithConfig("Target file", {
      kind: "file",
      ...pathPromptContext,
    });
    const patternConfig = await promptRenamePatternConfig({ includeSerialScope: false });
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

  if (action === "rename:apply") {
    const csvPath = await promptRequiredPathWithConfig("Rename plan CSV path", {
      kind: "csv",
      ...pathPromptContext,
    });
    const autoClean = await confirm({
      message: "Auto-clean plan CSV after apply?",
      default: true,
    });
    await actionRenameApply(runtime, { csv: csvPath, autoClean });
    return;
  }

  if (action === "video:convert") {
    const inputPath = await promptRequiredPathWithConfig("Input video file", {
      kind: "file",
      ...pathPromptContext,
    });
    const outputPath = await promptRequiredPathWithConfig("Output video file", {
      kind: "file",
      ...pathPromptContext,
    });
    const overwrite = await confirm({ message: "Overwrite if exists?", default: false });
    await actionVideoConvert(runtime, { input: inputPath, output: outputPath, overwrite });
    return;
  }

  if (action === "video:resize") {
    const inputPath = await promptRequiredPathWithConfig("Input video file", {
      kind: "file",
      ...pathPromptContext,
    });
    const outputPath = await promptRequiredPathWithConfig("Output video file", {
      kind: "file",
      ...pathPromptContext,
    });
    const scale = Number(
      await input({
        message: "Scale factor (for example 0.5 halves size, 2 doubles it)",
        validate: (value) => {
          const trimmed = value.trim();
          if (!trimmed) {
            return "Required";
          }
          const parsed = Number(trimmed);
          return Number.isFinite(parsed) && parsed > 0 ? true : "Enter a positive number.";
        },
      }),
    );
    const overwrite = await confirm({ message: "Overwrite if exists?", default: false });
    await actionVideoResize(runtime, {
      input: inputPath,
      output: outputPath,
      scale,
      overwrite,
    });
    return;
  }

  if (action === "video:gif") {
    const inputPath = await promptRequiredPathWithConfig("Input video file", {
      kind: "file",
      ...pathPromptContext,
    });
    const outputHint = formatDefaultOutputPathHint(runtime, inputPath, ".gif");
    const outputPath = await promptOptionalOutputPathChoice({
      message: "Output GIF file",
      defaultHint: outputHint,
      kind: "file",
      ...pathPromptContext,
      customMessage: "Custom GIF output path",
    });
    const widthInput = await input({ message: "Width in px (optional)", default: "480" });
    const fpsInput = await input({ message: "FPS (optional)", default: "10" });
    const overwrite = await confirm({ message: "Overwrite if exists?", default: false });
    await actionVideoGif(runtime, {
      input: inputPath,
      output: outputPath,
      width: widthInput.trim() ? Number(widthInput) : undefined,
      fps: fpsInput.trim() ? Number(fpsInput) : undefined,
      overwrite,
    });
  }
}
