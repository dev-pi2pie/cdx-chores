import { CliError } from "../../errors";
import type { CliRuntime } from "../../types";
import { publicPathBasename, publicPathDisplay } from "../codex-path-display";
import { sanitizeMdPdfProjectCodexReportText } from "./report-redaction";

function publicProjectPath(runtime: CliRuntime, path: string): string {
  return publicPathDisplay(runtime, path)?.display ?? publicPathBasename(path);
}

export function sanitizeMdPdfProjectCodexCliError(
  runtime: CliRuntime,
  error: unknown,
  paths: readonly (string | undefined)[],
): never {
  const message = error instanceof Error ? error.message : String(error);
  const placeholders: string[] = [];
  let safeMessage = message;

  for (const path of paths.filter((path): path is string => Boolean(path))) {
    const placeholder = `__MD_PDF_PROJECT_CODEX_PATH_${placeholders.length}__`;
    placeholders.push(publicProjectPath(runtime, path));
    safeMessage = safeMessage.replaceAll(path, placeholder);
  }

  safeMessage = sanitizeMdPdfProjectCodexReportText(safeMessage);
  placeholders.forEach((display, index) => {
    safeMessage = safeMessage.replaceAll(`__MD_PDF_PROJECT_CODEX_PATH_${index}__`, display);
  });

  if (error instanceof CliError) {
    throw new CliError(safeMessage, {
      code: error.code,
      exitCode: error.exitCode,
    });
  }

  throw new CliError(safeMessage, {
    code: "CLI_ERROR",
    exitCode: 1,
  });
}
