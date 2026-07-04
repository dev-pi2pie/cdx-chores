import {
  assertUsableCodexOutputDirectory,
  assertWritableCodexPlannedFile,
} from "../codex-output-path-policy";

export async function assertUsableProjectCodexOutputDirectory(
  outputDirectory: string,
  options: { overwrite?: boolean },
): Promise<"existing" | "missing"> {
  return assertUsableCodexOutputDirectory(outputDirectory, {
    failedInspectLabel: "project output directory",
    kindLabel: "Project",
    overwrite: options.overwrite,
    replacementLabel: "project files",
  });
}

export async function assertWritableProjectCodexPlannedFile(
  file: { path: string },
  options: { label: string; overwrite?: boolean },
): Promise<void> {
  await assertWritableCodexPlannedFile(file, options);
}
