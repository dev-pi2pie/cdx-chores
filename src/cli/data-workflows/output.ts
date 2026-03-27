import { stat } from "node:fs/promises";
import { extname } from "node:path";

import { confirm } from "@inquirer/prompts";

import { printLine } from "../actions/shared";
import { resolveFromCwd } from "../path-utils";
import { promptOptionalOutputPathChoice, promptRequiredPathWithConfig } from "../prompts/path";
import type { CliRuntime } from "../types";
import type { InteractivePathPromptContext } from "../interactive/shared";

export async function promptFileOutputTarget(options: {
  runtime: CliRuntime;
  pathPromptContext: InteractivePathPromptContext;
  message: string;
  allowedExtensions: readonly string[];
  invalidExtensionMessage: string;
  defaultHint?: string;
  customMessage?: string;
  fallbackOutputPath?: string;
}): Promise<{ output: string; overwrite: boolean; extension: string }> {
  while (true) {
    let outputPath: string;
    const fallbackOutputPath = options.fallbackOutputPath;
    if (typeof fallbackOutputPath === "string") {
      const chosenOutputPath = await promptOptionalOutputPathChoice({
        message: options.message,
        defaultHint: options.defaultHint ?? fallbackOutputPath,
        kind: "file",
        ...options.pathPromptContext,
        customMessage: options.customMessage,
      });
      outputPath = chosenOutputPath ?? fallbackOutputPath;
    } else {
      outputPath = await promptRequiredPathWithConfig(options.message, {
        kind: "file",
        ...options.pathPromptContext,
      });
    }

    const extension = extname(outputPath).toLowerCase();
    if (!options.allowedExtensions.includes(extension)) {
      printLine(options.runtime.stdout, options.invalidExtensionMessage);
      continue;
    }

    const normalizedOutputPath = resolveFromCwd(options.runtime, outputPath);
    try {
      await stat(normalizedOutputPath);
      const overwrite = await confirm({ message: "Overwrite if exists?", default: false });
      if (overwrite) {
        return { output: outputPath, overwrite, extension };
      }
      printLine(options.runtime.stdout, "Choose a different output destination.");
      continue;
    } catch {
      return { output: outputPath, overwrite: false, extension };
    }
  }
}
