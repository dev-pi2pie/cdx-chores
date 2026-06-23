import { CliError } from "../../errors";
import {
  assertUsableMdPdfTemplateCodexSignalMode,
  collectMdPdfTemplateCodexSignals,
  normalizeMdPdfTemplateCodexCommandState,
  type MdPdfTemplateCodexCliOptions,
  type MdPdfTemplateCodexOptions,
} from "../../markdown-pdf/template-codex";
import { printLine } from "../shared";
import type { CliRuntime } from "../../types";

export type { MdPdfTemplateCodexCliOptions, MdPdfTemplateCodexOptions };

export async function actionMdPdfTemplateCodex(
  runtime: CliRuntime,
  options: MdPdfTemplateCodexOptions,
): Promise<void> {
  const state = await normalizeMdPdfTemplateCodexCommandState(runtime, options);
  const signals = await collectMdPdfTemplateCodexSignals(runtime, state);
  assertUsableMdPdfTemplateCodexSignalMode(signals.signalMode);
  printLine(runtime.stdout, `Signal mode: ${signals.signalMode}`);

  throw new CliError(
    "md pdf-template codex signal collection is implemented; output planning begins in Phase 3.",
    {
      code: "NOT_IMPLEMENTED",
      exitCode: 1,
    },
  );
}
