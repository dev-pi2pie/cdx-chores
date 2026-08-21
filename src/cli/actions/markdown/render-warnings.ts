import { styleCliDiagnosticLabel } from "../../diagnostic-color";
import type { CliRuntime } from "../../types";
import { printLine } from "../shared";

export function printMarkdownPdfRenderWarnings(
  runtime: CliRuntime,
  warnings: readonly string[],
): void {
  if (warnings.length === 0) {
    return;
  }

  printLine(
    runtime.stderr,
    styleCliDiagnosticLabel(runtime, runtime.stderr, "warning", "Markdown PDF render warnings:"),
  );
  for (const warning of warnings) {
    printLine(runtime.stderr, `- ${warning}`);
  }
}
