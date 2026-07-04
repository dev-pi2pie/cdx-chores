import {
  assertUsableCodexOutputDirectory,
  assertWritableCodexPlannedFile,
} from "../codex-output-path-policy";

export async function assertUsableProjectCodexOutputDirectory(
  outputDirectory: string,
  options: { overwrite?: boolean; parentRootDirectory?: string },
): Promise<"existing" | "missing"> {
  return assertUsableCodexOutputDirectory(outputDirectory, {
    failedInspectLabel: "project output directory",
    kindLabel: "Project",
    overwrite: options.overwrite,
    parentRootDirectory: options.parentRootDirectory,
    replacementLabel: "project files",
  });
}

export async function assertWritableProjectCodexPlannedFile(
  file: { path: string },
  options: { label: string; overwrite?: boolean; parentRootDirectory?: string },
): Promise<void> {
  await assertWritableCodexPlannedFile(file, options);
}
