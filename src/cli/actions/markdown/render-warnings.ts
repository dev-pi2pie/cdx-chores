import { getCliColors } from "../../colors";
import type { CliRuntime } from "../../types";
import { printLine } from "../shared";

export function printMarkdownPdfRenderWarnings(
  runtime: CliRuntime,
  warnings: readonly string[],
): void {
  if (warnings.length === 0) {
    return;
  }

  const colors = getCliColors(runtime, runtime.stderr);
  printLine(runtime.stderr, colors.yellow("Markdown PDF render warnings:"));
  for (const warning of warnings) {
    printLine(runtime.stderr, `- ${warning}`);
  }
}
