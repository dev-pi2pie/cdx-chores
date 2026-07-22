import { mkdir, readdir, stat } from "node:fs/promises";
import { join } from "node:path";

import { isNotFoundError } from "../../actions/markdown/common";
import { assertNonEmpty, displayPath } from "../../actions/shared";
import { CliError } from "../../errors";
import { writeTextFileSafe } from "../../file-io";
import { resolveFromCwd } from "../../path-utils";
import type { CliRuntime } from "../../types";
import { createMarkdownPdfRecipe } from "../recipe";
import type { NormalizedMarkdownPdfOptions } from "../validation";

const TEMPLATE_FILE_NAME = "template.html";
const STYLE_FILE_NAME = "style.css";

export interface PreparedMarkdownPdfTemplateInit {
  normalizedOptions: NormalizedMarkdownPdfOptions;
  styleCss: string;
  templateHtml: string;
}

export interface MarkdownPdfTemplateInitDestinationOptions {
  output: string;
  overwrite?: boolean;
}

export interface BoundMarkdownPdfTemplateInitDestination {
  displayOutputDirectory: string;
  outputDirectory: string;
  overwrite?: boolean;
  prepared: PreparedMarkdownPdfTemplateInit;
  styleCss: string;
  stylePath: string;
  templateHtml: string;
  templatePath: string;
}

export function prepareMarkdownPdfTemplateInit(
  normalizedOptions: NormalizedMarkdownPdfOptions,
): PreparedMarkdownPdfTemplateInit {
  const acceptedOptions = structuredClone(normalizedOptions);
  const recipe = createMarkdownPdfRecipe(acceptedOptions);
  return {
    normalizedOptions: acceptedOptions,
    styleCss: recipe.styleCss,
    templateHtml: recipe.templateHtml,
  };
}

async function inspectTemplateInitDestination(
  destination: Pick<BoundMarkdownPdfTemplateInitDestination, "outputDirectory" | "overwrite">,
): Promise<"existing" | "missing"> {
  try {
    const stats = await stat(destination.outputDirectory);
    if (!stats.isDirectory()) {
      throw new CliError(
        `Template output path is not a directory: ${destination.outputDirectory}`,
        {
          code: "INVALID_INPUT",
          exitCode: 2,
        },
      );
    }
    if (!destination.overwrite) {
      const entries = await readdir(destination.outputDirectory);
      if (entries.length > 0) {
        throw new CliError(
          `Template output directory is not empty: ${destination.outputDirectory}. Use --overwrite to replace recipe files.`,
          {
            code: "OUTPUT_EXISTS",
            exitCode: 2,
          },
        );
      }
    }
    return "existing";
  } catch (error) {
    if (error instanceof CliError) {
      throw error;
    }
    if (isNotFoundError(error)) {
      return "missing";
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new CliError(
      `Failed to inspect template output directory: ${destination.outputDirectory} (${message})`,
      {
        code: "FILE_READ_ERROR",
        exitCode: 2,
      },
    );
  }
}

export async function bindPreparedMarkdownPdfTemplateInitDestination(
  runtime: CliRuntime,
  prepared: PreparedMarkdownPdfTemplateInit,
  options: MarkdownPdfTemplateInitDestinationOptions,
): Promise<BoundMarkdownPdfTemplateInitDestination> {
  const outputDirectory = resolveFromCwd(runtime, assertNonEmpty(options.output, "Output path"));
  const destination = {
    displayOutputDirectory: displayPath(runtime, outputDirectory),
    outputDirectory,
    overwrite: options.overwrite,
    prepared,
    styleCss: prepared.styleCss,
    stylePath: join(outputDirectory, STYLE_FILE_NAME),
    templateHtml: prepared.templateHtml,
    templatePath: join(outputDirectory, TEMPLATE_FILE_NAME),
  } satisfies BoundMarkdownPdfTemplateInitDestination;

  await inspectTemplateInitDestination(destination);
  return destination;
}

export async function writePreparedMarkdownPdfTemplateInit(
  destination: BoundMarkdownPdfTemplateInitDestination,
): Promise<void> {
  const destinationState = await inspectTemplateInitDestination(destination);
  if (destinationState === "missing") {
    await mkdir(destination.outputDirectory, { recursive: true });
  }

  await writeTextFileSafe(destination.templatePath, destination.templateHtml, {
    overwrite: destination.overwrite,
  });
  await writeTextFileSafe(destination.stylePath, destination.styleCss, {
    overwrite: destination.overwrite,
  });
}
