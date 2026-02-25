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
import { defaultOutputPath, formatPathForDisplay, resolveFromCwd } from "./fs-utils";
import type { CliRuntime } from "./types";

async function promptPath(message: string): Promise<string> {
  return await input({ message, validate: (value) => (value.trim().length > 0 ? true : "Required") });
}

function formatDefaultOutputHint(runtime: CliRuntime, inputPath: string, nextExtension: string): string {
  const derived = defaultOutputPath(inputPath, nextExtension);
  return formatPathForDisplay(runtime, resolveFromCwd(runtime, derived));
}

export async function runInteractiveMode(runtime: CliRuntime): Promise<void> {
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
    const inputPath = await promptPath("Input JSON file");
    const outputHint = formatDefaultOutputHint(runtime, inputPath, ".csv");
    const outputPath = await input({ message: `Output CSV file (optional, default: ${outputHint})` });
    const overwrite = await confirm({ message: "Overwrite if exists?", default: false });
    await actionJsonToCsv(runtime, { input: inputPath, output: outputPath || undefined, overwrite });
    return;
  }

  if (action === "data:csv-to-json") {
    const inputPath = await promptPath("Input CSV file");
    const outputHint = formatDefaultOutputHint(runtime, inputPath, ".json");
    const outputPath = await input({ message: `Output JSON file (optional, default: ${outputHint})` });
    const pretty = await confirm({ message: "Pretty-print JSON?", default: true });
    const overwrite = await confirm({ message: "Overwrite if exists?", default: false });
    await actionCsvToJson(runtime, {
      input: inputPath,
      output: outputPath || undefined,
      pretty,
      overwrite,
    });
    return;
  }

  if (action === "md:to-docx") {
    const inputPath = await promptPath("Input Markdown file");
    const outputHint = formatDefaultOutputHint(runtime, inputPath, ".docx");
    const outputPath = await input({ message: `Output DOCX file (optional, default: ${outputHint})` });
    const overwrite = await confirm({ message: "Overwrite if exists?", default: false });
    await actionMdToDocx(runtime, {
      input: inputPath,
      output: outputPath || undefined,
      overwrite,
    });
    return;
  }

  if (action === "rename:batch") {
    const directory = await promptPath("Target directory");
    const prefix = await input({ message: "Filename prefix", default: "file" });
    const recursive = await confirm({ message: "Traverse subdirectories recursively?", default: false });
    const dryRun = await confirm({ message: "Dry run only?", default: true });
    const codex = await confirm({
      message: "Use Codex-assisted image titles when possible?",
      default: false,
    });
    const result = await actionRenameBatch(runtime, { directory, prefix, recursive, dryRun, codex });

    if (!dryRun && result.changedCount > 0) {
      return;
    }

    if (dryRun && result.changedCount > 0) {
      const applyNow = await confirm({ message: "Apply these renames now?", default: false });
      if (applyNow && result.planCsvPath) {
        await actionRenameApply(runtime, { csv: result.planCsvPath });
      }
    }
    return;
  }

  if (action === "rename:file") {
    const path = await promptPath("Target file");
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
      await actionRenameApply(runtime, { csv: result.planCsvPath });
    }
    return;
  }

  if (action === "rename:apply") {
    const csvPath = await promptPath("Rename plan CSV path");
    await actionRenameApply(runtime, { csv: csvPath });
    return;
  }

  if (action === "video:convert") {
    const inputPath = await promptPath("Input video file");
    const outputPath = await promptPath("Output video file");
    const overwrite = await confirm({ message: "Overwrite if exists?", default: false });
    await actionVideoConvert(runtime, { input: inputPath, output: outputPath, overwrite });
    return;
  }

  if (action === "video:resize") {
    const inputPath = await promptPath("Input video file");
    const outputPath = await promptPath("Output video file");
    const width = Number(await promptPath("Width (px)"));
    const height = Number(await promptPath("Height (px)"));
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
    const inputPath = await promptPath("Input video file");
    const outputHint = formatDefaultOutputHint(runtime, inputPath, ".gif");
    const outputPath = await input({ message: `Output GIF file (optional, default: ${outputHint})` });
    const widthInput = await input({ message: "Width in px (optional)", default: "480" });
    const fpsInput = await input({ message: "FPS (optional)", default: "10" });
    const overwrite = await confirm({ message: "Overwrite if exists?", default: false });
    await actionVideoGif(runtime, {
      input: inputPath,
      output: outputPath || undefined,
      width: widthInput.trim() ? Number(widthInput) : undefined,
      fps: fpsInput.trim() ? Number(fpsInput) : undefined,
      overwrite,
    });
  }
}
