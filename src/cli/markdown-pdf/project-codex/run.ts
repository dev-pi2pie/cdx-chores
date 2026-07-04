import { CliError } from "../../errors";
import type { CliRuntime } from "../../types";
import { normalizeMdPdfProjectCodexCommandState } from "./options";
import type { MdPdfProjectCodexOptions } from "./types";

export async function actionMdPdfProjectCodex(
  runtime: CliRuntime,
  options: MdPdfProjectCodexOptions,
): Promise<void> {
  await normalizeMdPdfProjectCodexCommandState(runtime, options);
  throw new CliError("md pdf-project codex orchestration is not implemented yet.", {
    code: "MARKDOWN_PDF_PROJECT_CODEX_NOT_IMPLEMENTED",
    exitCode: 1,
  });
}
