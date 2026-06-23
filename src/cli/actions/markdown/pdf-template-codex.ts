import { CliError } from "../../errors";
import {
  normalizeMdPdfTemplateCodexCommandState,
  type MdPdfTemplateCodexCliOptions,
  type MdPdfTemplateCodexOptions,
} from "../../markdown-pdf/template-codex";
import type { CliRuntime } from "../../types";

export type { MdPdfTemplateCodexCliOptions, MdPdfTemplateCodexOptions };

export async function actionMdPdfTemplateCodex(
  runtime: CliRuntime,
  options: MdPdfTemplateCodexOptions,
): Promise<void> {
  await normalizeMdPdfTemplateCodexCommandState(runtime, options);

  throw new CliError(
    "md pdf-template codex command normalization is implemented; signal collection begins in Phase 2.",
    {
      code: "NOT_IMPLEMENTED",
      exitCode: 1,
    },
  );
}
