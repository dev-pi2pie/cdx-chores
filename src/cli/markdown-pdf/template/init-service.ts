import { randomUUID } from "node:crypto";
import { link, lstat, mkdir, readdir, rename, rm } from "node:fs/promises";
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

interface TemplateInitTarget {
  content: string;
  label: string;
  path: string;
}

interface StagedTemplateInitTarget extends TemplateInitTarget {
  backupPath: string;
  existed: boolean;
  stagePath: string;
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
    const stats = await lstat(destination.outputDirectory);
    if (stats.isSymbolicLink()) {
      throw new CliError(
        `Template output directory is a symlink and cannot be written safely: ${destination.outputDirectory}`,
        {
          code: "OUTPUT_SYMLINK",
          exitCode: 2,
        },
      );
    }
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

function templateInitTargets(
  destination: BoundMarkdownPdfTemplateInitDestination,
): TemplateInitTarget[] {
  return [
    {
      content: destination.templateHtml,
      label: "Markdown PDF template",
      path: destination.templatePath,
    },
    {
      content: destination.styleCss,
      label: "Markdown PDF stylesheet",
      path: destination.stylePath,
    },
  ];
}

async function inspectTemplateInitTarget(
  target: TemplateInitTarget,
  overwrite: boolean,
): Promise<boolean> {
  try {
    const stats = await lstat(target.path);
    if (stats.isSymbolicLink()) {
      throw new CliError(
        `${target.label} is a symlink and cannot be written safely: ${target.path}`,
        {
          code: "OUTPUT_SYMLINK",
          exitCode: 2,
        },
      );
    }
    if (!stats.isFile()) {
      throw new CliError(`${target.label} is not a file: ${target.path}`, {
        code: "INVALID_INPUT",
        exitCode: 2,
      });
    }
    if (!overwrite) {
      throw new CliError(`${target.label} already exists: ${target.path}`, {
        code: "OUTPUT_EXISTS",
        exitCode: 2,
      });
    }
    return true;
  } catch (error) {
    if (error instanceof CliError) {
      throw error;
    }
    if (isNotFoundError(error)) {
      return false;
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new CliError(`Failed to inspect ${target.label}: ${target.path} (${message})`, {
      code: "FILE_READ_ERROR",
      exitCode: 2,
    });
  }
}

async function inspectTemplateInitTargets(
  destination: BoundMarkdownPdfTemplateInitDestination,
): Promise<boolean[]> {
  return await Promise.all(
    templateInitTargets(destination).map((target) =>
      inspectTemplateInitTarget(target, destination.overwrite ?? false),
    ),
  );
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

  const destinationState = await inspectTemplateInitDestination(destination);
  if (destinationState === "existing") {
    await inspectTemplateInitTargets(destination);
  }
  return destination;
}

async function rollbackTemplateInitWrite(input: {
  backedUp: StagedTemplateInitTarget[];
  committed: StagedTemplateInitTarget[];
  createdOutputDirectory: boolean;
  destination: BoundMarkdownPdfTemplateInitDestination;
  staged: StagedTemplateInitTarget[];
}): Promise<void> {
  for (const target of input.committed.toReversed()) {
    await rm(target.path, { force: true });
  }
  for (const target of input.backedUp.toReversed()) {
    await rename(target.backupPath, target.path);
  }
  await Promise.all(
    input.staged
      .flatMap((target) => [target.stagePath, target.backupPath])
      .map(async (path) => {
        await rm(path, { force: true });
      }),
  );
  if (input.createdOutputDirectory) {
    await rm(input.destination.outputDirectory, { force: true, recursive: false });
  }
}

export async function writePreparedMarkdownPdfTemplateInit(
  destination: BoundMarkdownPdfTemplateInitDestination,
): Promise<void> {
  const destinationState = await inspectTemplateInitDestination(destination);
  let createdOutputDirectory = false;
  if (destinationState === "missing") {
    await mkdir(destination.outputDirectory, { recursive: true });
    createdOutputDirectory = true;
  }

  const existingTargets = await inspectTemplateInitTargets(destination);
  const transactionId = randomUUID();
  const staged = templateInitTargets(destination).map((target, index) => ({
    ...target,
    backupPath: `${target.path}.${transactionId}.backup`,
    existed: existingTargets[index] ?? false,
    stagePath: `${target.path}.${transactionId}.stage`,
  }));
  const backedUp: StagedTemplateInitTarget[] = [];
  const committed: StagedTemplateInitTarget[] = [];

  try {
    for (const target of staged) {
      await writeTextFileSafe(target.stagePath, target.content, {
        label: `${target.label} staging file`,
        parentRootDirectory: destination.outputDirectory,
      });
    }

    // Binding previews the destination; writing revalidates both targets before
    // any recipe file changes, then commits the staged bundle as one unit.
    const revalidatedTargets = await inspectTemplateInitTargets(destination);
    for (const [index, target] of staged.entries()) {
      target.existed = revalidatedTargets[index] ?? false;
    }

    if (destination.overwrite) {
      for (const target of staged) {
        if (target.existed) {
          await rename(target.path, target.backupPath);
          backedUp.push(target);
        }
      }
      for (const target of staged) {
        await rename(target.stagePath, target.path);
        committed.push(target);
      }
    } else {
      for (const target of staged) {
        await link(target.stagePath, target.path);
        committed.push(target);
      }
      await Promise.all(staged.map(async (target) => await rm(target.stagePath, { force: true })));
    }
  } catch (error) {
    try {
      await rollbackTemplateInitWrite({
        backedUp,
        committed,
        createdOutputDirectory,
        destination,
        staged,
      });
    } catch (rollbackError) {
      const message =
        rollbackError instanceof Error ? rollbackError.message : String(rollbackError);
      throw new CliError(`Failed to restore Markdown PDF template bundle: ${message}`, {
        code: "FILE_WRITE_ERROR",
        exitCode: 2,
      });
    }
    if (error instanceof CliError) {
      throw error;
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new CliError(`Failed to write Markdown PDF template bundle: ${message}`, {
      code: "FILE_WRITE_ERROR",
      exitCode: 2,
    });
  }

  await Promise.all(staged.map(async (target) => await rm(target.backupPath, { force: true })));
}
