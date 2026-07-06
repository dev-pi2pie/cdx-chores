import { constants } from "node:fs";
import { open } from "node:fs/promises";
import { isAbsolute, relative } from "node:path";

import { CliError } from "../../errors";
import { writeBufferFileSafe } from "../../file-io";
import type {
  MarkdownPdfTemplateCodexManagedAssetBinding,
  MarkdownPdfTemplateCodexOutputPlan,
  MarkdownPdfTemplateCodexPlannedAsset,
} from "./types";

function isNodeErrorCode(error: unknown, code: string): boolean {
  return (
    error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === code
  );
}

function assertInsideOutputDirectory(input: {
  outputDirectory: string;
  path: string;
  pathLabel: string;
}): void {
  const relativePath = relative(input.outputDirectory, input.path);
  if (relativePath.length > 0 && !relativePath.startsWith("..") && !isAbsolute(relativePath)) {
    return;
  }
  throw new CliError(`${input.pathLabel} must stay inside the template output directory.`, {
    code: "INVALID_INPUT",
    exitCode: 2,
  });
}

async function readManagedAssetSource(
  asset: MarkdownPdfTemplateCodexPlannedAsset,
): Promise<Buffer> {
  let handle;
  try {
    handle = await open(asset.sourcePath, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    const stats = await handle.stat();
    if (!stats.isFile()) {
      throw new CliError(`managed asset ${asset.bundlePath} source path is not a file.`, {
        code: "INVALID_INPUT",
        exitCode: 2,
      });
    }
    return await handle.readFile();
  } catch (error) {
    if (error instanceof CliError) {
      throw error;
    }
    if (isNodeErrorCode(error, "ENOENT")) {
      throw new CliError(`managed asset ${asset.bundlePath} source file not found.`, {
        code: "FILE_NOT_FOUND",
        exitCode: 2,
      });
    }
    if (isNodeErrorCode(error, "ELOOP")) {
      throw new CliError(
        `managed asset ${asset.bundlePath} source is a symlink and cannot be copied safely.`,
        {
          code: "INVALID_INPUT",
          exitCode: 2,
        },
      );
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new CliError(`Failed to read managed asset ${asset.bundlePath}: ${message}`, {
      code: "FILE_READ_ERROR",
      exitCode: 2,
    });
  } finally {
    await handle?.close();
  }
}

export async function copyMdPdfTemplateCodexManagedAssets(input: {
  managedAssets: MarkdownPdfTemplateCodexManagedAssetBinding[];
  outputPlan: MarkdownPdfTemplateCodexOutputPlan;
  overwrite?: boolean;
}): Promise<void> {
  const acceptedBundlePaths = new Set(input.managedAssets.map((asset) => asset.bundlePath));
  for (const asset of input.outputPlan.assets.filter((asset) =>
    acceptedBundlePaths.has(asset.bundlePath),
  )) {
    assertInsideOutputDirectory({
      outputDirectory: input.outputPlan.outputDirectory,
      path: asset.path,
      pathLabel: `managed asset ${asset.bundlePath}`,
    });
    const content = await readManagedAssetSource(asset);
    await writeBufferFileSafe(asset.path, content, {
      label: `managed asset ${asset.bundlePath}`,
      overwrite: input.overwrite,
      parentRootDirectory: input.outputPlan.outputDirectory,
    });
  }
}
