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
    const prefix = await input({ message: "Filename prefix", default: "file" });
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
    const recursive = await confirm({ message: "Traverse subdirectories recursively?", default: false });
    const maxDepthInput = recursive
      ? await input({ message: "Max recursive depth (optional, root=0)", default: "" })
      : "";
    const dryRun = await confirm({ message: "Dry run only?", default: true });
    const codex = await confirm({
      message: "Use Codex-assisted image titles when possible?",
      default: false,
    });
    const result = await actionRenameBatch(runtime, {
      directory,
      prefix,
      profile: profile === "all" ? undefined : profile,
      recursive,
      maxDepth: maxDepthInput.trim() ? Number(maxDepthInput) : undefined,
      dryRun,
      codexImages: codex,
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
    const prefix = await input({ message: "Filename prefix", default: "file" });
    const dryRun = await confirm({ message: "Dry run only?", default: true });
    const codex = await confirm({
      message: "Use Codex-assisted image title when possible?",
      default: false,
    });
    const result = await actionRenameFile(runtime, { path, prefix, dryRun, codexImages: codex });

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
    const width = Number(await input({ message: "Width (px)", validate: (value) => (value.trim() ? true : "Required") }));
    const height = Number(
      await input({ message: "Height (px)", validate: (value) => (value.trim() ? true : "Required") }),
    );
    const overwrite = await confirm({ message: "Overwrite if exists?", default: false });
    await actionVideoResize(runtime, {
      input: inputPath,
      output: outputPath,
      width,
      height,
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
