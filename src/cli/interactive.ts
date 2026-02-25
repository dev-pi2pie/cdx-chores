import { confirm, input, select } from "@inquirer/prompts";

import {
  actionCsvToJson,
  actionDoctor,
  actionJsonToCsv,
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

export async function runInteractiveMode(runtime: CliRuntime): Promise<void> {
  const pathPromptRuntimeConfig = resolvePathPromptRuntimeConfig();
  const pathPromptContext = {
    runtimeConfig: pathPromptRuntimeConfig,
    cwd: runtime.cwd,
    stdin: runtime.stdin,
    stdout: runtime.stdout,
  } as const;
  const action = await select<string>({
    message: "Choose a command",
    choices: [
      { name: "doctor", value: "doctor", description: "Check dependencies and capabilities" },
      { name: "data json-to-csv", value: "data:json-to-csv" },
      { name: "data csv-to-json", value: "data:csv-to-json" },
      { name: "md to-docx", value: "md:to-docx" },
      { name: "rename file", value: "rename:file" },
      { name: "rename batch", value: "rename:batch" },
      { name: "rename apply", value: "rename:apply" },
      { name: "video convert", value: "video:convert" },
      { name: "video resize", value: "video:resize" },
      { name: "video gif", value: "video:gif" },
      { name: "cancel", value: "cancel" },
    ],
  });

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
      codex,
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
    const result = await actionRenameFile(runtime, { path, prefix, dryRun, codex });

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
