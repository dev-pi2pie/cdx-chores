import { readFile } from "node:fs/promises";
import { isAbsolute, relative } from "node:path";

import { CliError } from "../../errors";
import { writeBufferFileSafe } from "../../file-io";
import type {
  MarkdownPdfTemplateCodexManagedAssetBinding,
  MarkdownPdfTemplateCodexOutputPlan,
} from "./types";

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
    const content = await readFile(asset.sourcePath);
    await writeBufferFileSafe(asset.path, content, {
      label: `managed asset ${asset.bundlePath}`,
      overwrite: input.overwrite,
      parentRootDirectory: input.outputPlan.outputDirectory,
    });
  }
}
