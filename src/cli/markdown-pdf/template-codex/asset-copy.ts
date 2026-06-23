import { constants } from "node:fs";
import { lstat, mkdir, open, readFile } from "node:fs/promises";
import { dirname, isAbsolute, relative } from "node:path";

import { isNotFoundError } from "../../actions/markdown/common";
import { CliError } from "../../errors";
import type { MarkdownPdfTemplateCodexOutputPlan } from "./types";

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

async function writeBinaryFileSafe(
  path: string,
  content: Buffer,
  options: { overwrite?: boolean },
): Promise<void> {
  try {
    const stats = await lstat(path);
    if (stats.isSymbolicLink()) {
      throw new CliError(`Output path is a symlink and cannot be written safely: ${path}`, {
        code: "OUTPUT_SYMLINK",
        exitCode: 2,
      });
    }
    if (stats.isDirectory()) {
      throw new CliError(`Output path is a directory: ${path}`, {
        code: "INVALID_INPUT",
        exitCode: 2,
      });
    }
    if (!options.overwrite) {
      throw new CliError(`Output file already exists: ${path}. Use --overwrite to replace it.`, {
        code: "OUTPUT_EXISTS",
        exitCode: 2,
      });
    }
  } catch (error) {
    if (error instanceof CliError) {
      throw error;
    }
    if (!isNotFoundError(error)) {
      throw error;
    }
  }

  await mkdir(dirname(path), { recursive: true });
  const noFollow = constants.O_NOFOLLOW ?? 0;
  const flags = options.overwrite
    ? constants.O_WRONLY | constants.O_CREAT | constants.O_TRUNC | noFollow
    : constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | noFollow;
  let handle;
  try {
    handle = await open(path, flags, 0o666);
    await handle.writeFile(content);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new CliError(`Failed to write managed asset: ${path} (${message})`, {
      code: "FILE_WRITE_ERROR",
      exitCode: 2,
    });
  } finally {
    await handle?.close();
  }
}

export async function copyMdPdfTemplateCodexManagedAssets(input: {
  outputPlan: MarkdownPdfTemplateCodexOutputPlan;
  overwrite?: boolean;
}): Promise<void> {
  for (const asset of input.outputPlan.assets) {
    assertInsideOutputDirectory({
      outputDirectory: input.outputPlan.outputDirectory,
      path: asset.path,
      pathLabel: `managed asset ${asset.bundlePath}`,
    });
    const content = await readFile(asset.sourcePath);
    await writeBinaryFileSafe(asset.path, content, { overwrite: input.overwrite });
  }
}
