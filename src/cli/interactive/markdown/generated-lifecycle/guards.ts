import { stat } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";

import { isNotFoundError } from "../../../actions/markdown/common";
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
  const generatedPaths = [materialization.destination, ...materialization.outputFiles];
  if (
    generatedPaths.some(
      (path) => resolve(path) === resolvedPdf || isWithin(resolvedPdf, resolve(path)),
    )
  ) {
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

async function existingPathIdentity(
  path: string,
): Promise<{ dev: number; ino: number; isFile: boolean } | undefined> {
  try {
    const stats = await stat(path);
    return { dev: stats.dev, ino: stats.ino, isFile: stats.isFile() };
  } catch (error) {
    if (isNotFoundError(error)) {
      return undefined;
    }
    throw error;
  }
}

export async function assertPdfOutputDoesNotAliasMaterializedOutput(
  runtime: CliRuntime,
  pdfOutput: string,
  materialization: BoundMarkdownPdfGeneratedMaterialization,
  report: MarkdownPdfCodexReportRetention,
): Promise<void> {
  assertPdfOutputDoesNotCollide(runtime, pdfOutput, materialization, report);
  const pdfIdentity = await existingPathIdentity(pdfOutput);
  if (!pdfIdentity) {
    return;
  }
  if (!pdfIdentity.isFile) {
    throw new CliError("PDF output must identify a file, not a directory.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }
  const protectedPaths = [materialization.destination, ...materialization.outputFiles];
  if (report.kind === "external") {
    protectedPaths.push(resolve(runtime.cwd, report.path));
  }
  const protectedIdentities = await Promise.all(protectedPaths.map(existingPathIdentity));
  if (
    protectedIdentities.some(
      (identity) => identity?.dev === pdfIdentity.dev && identity.ino === pdfIdentity.ino,
    )
  ) {
    throw new CliError("PDF output must be different from generated recipe and report files.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }
}

export function isRecoverableGeneratedLifecycleBindError(error: unknown): error is CliError {
  return error instanceof CliError && RECOVERABLE_BIND_CODES.has(error.code);
}
