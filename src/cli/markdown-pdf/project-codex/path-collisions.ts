import { isAbsolute, relative } from "node:path";

import { CliError } from "../../errors";
import {
  assertUsableCodexOutputDirectory,
  assertWritableCodexPlannedFile,
} from "../codex-output-path-policy";

export function assertProjectCodexBundlePathInsideOutput(input: {
  bundlePath: string;
  outputDirectory: string;
  path: string;
  pathLabel: string;
}): void {
  if (
    input.bundlePath.startsWith("/") ||
    input.bundlePath.startsWith("\\") ||
    input.bundlePath.includes("..")
  ) {
    throw new CliError(`${input.pathLabel} must use a project-relative bundle path.`, {
      code: "MARKDOWN_PDF_PROJECT_VALIDATION_FAILED",
      exitCode: 2,
    });
  }
  const relativePath = relative(input.outputDirectory, input.path);
  if (relativePath.length > 0 && !relativePath.startsWith("..") && !isAbsolute(relativePath)) {
    return;
  }
  throw new CliError(`${input.pathLabel} must stay inside the project output directory.`, {
    code: "MARKDOWN_PDF_PROJECT_VALIDATION_FAILED",
    exitCode: 2,
  });
}

export async function assertUsableProjectCodexOutputDirectory(
  outputDirectory: string,
  options: {
    allowExistingContents?: boolean;
    displayPath?: (path: string) => string;
    overwrite?: boolean;
    parentRootDirectory?: string;
    sanitizeMessage?: (message: string) => string;
  },
): Promise<"existing" | "missing"> {
  return assertUsableCodexOutputDirectory(outputDirectory, {
    allowExistingContents: options.allowExistingContents,
    displayPath: options.displayPath,
    failedInspectLabel: "project output directory",
    kindLabel: "Project",
    overwrite: options.overwrite,
    parentRootDirectory: options.parentRootDirectory,
    replacementLabel: "project files",
    sanitizeMessage: options.sanitizeMessage,
  });
}

export async function assertWritableProjectCodexPlannedFile(
  file: { path: string },
  options: {
    displayPath?: (path: string) => string;
    label: string;
    overwrite?: boolean;
    parentRootDirectory?: string;
    sanitizeMessage?: (message: string) => string;
  },
): Promise<void> {
  await assertWritableCodexPlannedFile(file, options);
}
