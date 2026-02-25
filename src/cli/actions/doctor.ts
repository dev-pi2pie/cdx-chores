import pc from "picocolors";

import { inspectCommand } from "../deps";
import type { CliRuntime } from "../types";
import { printLine } from "./shared";

export interface DoctorOptions {
  json?: boolean;
}

export async function actionDoctor(runtime: CliRuntime, options: DoctorOptions = {}): Promise<void> {
  const [pandoc, ffmpeg] = await Promise.all([
    inspectCommand("pandoc", runtime.platform),
    inspectCommand("ffmpeg", runtime.platform),
  ]);

  const capabilities = {
    "md.to-docx": pandoc.available,
    "video.convert": ffmpeg.available,
    "video.resize": ffmpeg.available,
    "video.gif": ffmpeg.available,
  };

  if (options.json) {
    const payload = {
      generatedAt: runtime.now().toISOString(),
      platform: runtime.platform,
      nodeVersion: process.version,
      tools: { pandoc, ffmpeg },
      capabilities,
    };
    printLine(runtime.stdout, JSON.stringify(payload, null, 2));
    return;
  }

  printLine(runtime.stdout, pc.bold(pc.cyan("cdx-chores doctor")));
  printLine(runtime.stdout, `${pc.dim("Platform:")} ${pc.white(runtime.platform)}`);
  printLine(runtime.stdout, `${pc.dim("Node.js:")} ${pc.white(process.version)}`);
  printLine(runtime.stdout);

  for (const item of [pandoc, ffmpeg]) {
    const statusText = item.available
      ? pc.green(`available (${item.version ?? "unknown version"})`)
      : pc.red("missing");
    printLine(
      runtime.stdout,
      `- ${pc.bold(item.name)}: ${statusText}`,
    );
    if (!item.available) {
      printLine(runtime.stdout, `  ${pc.yellow("Install suggestion:")} ${item.installHint}`);
    }
  }

  printLine(runtime.stdout);
  printLine(runtime.stdout, pc.bold(pc.cyan("Capabilities:")));
  for (const [capability, available] of Object.entries(capabilities)) {
    printLine(
      runtime.stdout,
      `- ${pc.bold(capability)}: ${available ? pc.green("available") : pc.red("unavailable")}`,
    );
  }
}

