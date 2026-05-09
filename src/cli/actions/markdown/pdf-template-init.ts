import { mkdir, readdir, stat } from "node:fs/promises";
import { join } from "node:path";

import { CliError } from "../../errors";
import {
  createMarkdownPdfRecipe,
  normalizeMarkdownPdfOptions,
  type NormalizeMarkdownPdfOptionsInput,
} from "../../markdown-pdf";
import { resolveFromCwd } from "../../path-utils";
import { writeTextFileSafe } from "../../file-io";
import type { CliRuntime } from "../../types";
import { assertNonEmpty, displayPath, printLine } from "../shared";
import { isNotFoundError } from "./common";

export interface MdPdfTemplateInitOptions extends NormalizeMarkdownPdfOptionsInput {
  output: string;
  overwrite?: boolean;
}

export async function actionMdPdfTemplateInit(
  runtime: CliRuntime,
  options: MdPdfTemplateInitOptions,
): Promise<void> {
  const outputDirectory = resolveFromCwd(runtime, assertNonEmpty(options.output, "Output path"));
  const normalizedOptions = normalizeMarkdownPdfOptions(options);
  const recipe = createMarkdownPdfRecipe(normalizedOptions);
  let outputDirectoryExists = false;

  try {
    const stats = await stat(outputDirectory);
    if (!stats.isDirectory()) {
      throw new CliError(`Template output path is not a directory: ${outputDirectory}`, {
        code: "INVALID_INPUT",
        exitCode: 2,
      });
    }
    outputDirectoryExists = true;
  } catch (error) {
    if (!isNotFoundError(error)) {
      if (error instanceof CliError) {
        throw error;
      }
      const message = error instanceof Error ? error.message : String(error);
      throw new CliError(
        `Failed to inspect template output directory: ${outputDirectory} (${message})`,
        {
          code: "FILE_READ_ERROR",
          exitCode: 2,
        },
      );
    }
    await mkdir(outputDirectory, { recursive: true });
  }

  if (outputDirectoryExists && !options.overwrite) {
    const entries = await readdir(outputDirectory);
    if (entries.length > 0) {
      throw new CliError(
        `Template output directory is not empty: ${outputDirectory}. Use --overwrite to replace recipe files.`,
        {
          code: "OUTPUT_EXISTS",
          exitCode: 2,
        },
      );
    }
  }

  await writeTextFileSafe(join(outputDirectory, "template.html"), recipe.templateHtml, {
    overwrite: options.overwrite,
  });
  await writeTextFileSafe(join(outputDirectory, "style.css"), recipe.styleCss, {
    overwrite: options.overwrite,
  });

  printLine(
    runtime.stdout,
    `Wrote Markdown PDF template: ${displayPath(runtime, outputDirectory)}`,
  );
}
