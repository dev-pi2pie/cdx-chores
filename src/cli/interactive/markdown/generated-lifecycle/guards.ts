import { isAbsolute, relative, resolve } from "node:path";

import { CliError } from "../../../errors";
import type { CliRuntime } from "../../../types";
import type {
  MarkdownPdfCodexReportRetention,
  MarkdownPdfGeneratedLifecycleSelection,
} from "../codex-types";
import type { BoundMarkdownPdfGeneratedMaterialization } from "../materialization";
import { MARKDOWN_PDF_CODEX_ARTIFACT_LABELS } from "../codex-review";

const RECOVERABLE_BIND_CODES = new Set([
  "FILE_READ_ERROR",
  "FILE_WRITE_ERROR",
  "INVALID_INPUT",
  "OUTPUT_EXISTS",
  "OUTPUT_SYMLINK",
]);

export function artifactLabel(selection: MarkdownPdfGeneratedLifecycleSelection): string {
  return MARKDOWN_PDF_CODEX_ARTIFACT_LABELS[selection.candidate.candidate.artifact];
}

function isWithin(root: string, path: string): boolean {
  const child = relative(resolve(root), resolve(path));
  return child === "" || (!child.startsWith("..") && !isAbsolute(child));
}

export function assertPdfOutputDoesNotCollide(
  runtime: CliRuntime,
  pdfOutput: string,
  materialization: BoundMarkdownPdfGeneratedMaterialization,
  report: MarkdownPdfCodexReportRetention,
): void {
  const resolvedPdf = resolve(pdfOutput);
  if (materialization.outputFiles.some((file) => resolve(file) === resolvedPdf)) {
    throw new CliError("PDF output must be different from generated recipe and report files.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }
  if (report.kind === "external" && resolve(runtime.cwd, report.path) === resolvedPdf) {
    throw new CliError("PDF output must be different from the Codex report path.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }
  if (materialization.kind === "temporary" && isWithin(materialization.session.path, resolvedPdf)) {
    throw new CliError("PDF output must be outside the temporary recipe session.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }
}

export function isRecoverableGeneratedLifecycleBindError(error: unknown): error is CliError {
  return error instanceof CliError && RECOVERABLE_BIND_CODES.has(error.code);
}
