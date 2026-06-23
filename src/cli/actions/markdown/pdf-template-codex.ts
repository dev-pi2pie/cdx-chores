import { CliError } from "../../errors";
import {
  assertUsableMdPdfTemplateCodexSignalMode,
  collectMdPdfTemplateCodexSignals,
  normalizeMdPdfTemplateCodexCommandState,
  planMdPdfTemplateCodexOutput,
  type MdPdfTemplateCodexCliOptions,
  type MdPdfTemplateCodexOptions,
} from "../../markdown-pdf/template-codex";
import { printLine } from "../shared";
import { displayPath } from "../shared";
import type { CliRuntime } from "../../types";

export type { MdPdfTemplateCodexCliOptions, MdPdfTemplateCodexOptions };

export async function actionMdPdfTemplateCodex(
  runtime: CliRuntime,
  options: MdPdfTemplateCodexOptions,
): Promise<void> {
  const state = await normalizeMdPdfTemplateCodexCommandState(runtime, options);
  const signals = await collectMdPdfTemplateCodexSignals(runtime, state);
  assertUsableMdPdfTemplateCodexSignalMode(signals.signalMode);
  const outputPlan = await planMdPdfTemplateCodexOutput({ runtime, state, signals });

  printLine(runtime.stdout, `Signal mode: ${signals.signalMode}`);
  printLine(runtime.stdout, `Template bundle: ${outputPlan.bundleId}`);
  printLine(
    runtime.stdout,
    `Output directory: ${displayPath(runtime, outputPlan.outputDirectory)}`,
  );
  printLine(runtime.stdout, `Template HTML: ${outputPlan.templateHtml.bundlePath}`);
  printLine(runtime.stdout, `Stylesheet: ${outputPlan.styleCss.bundlePath}`);
  printLine(runtime.stdout, `Managed assets: ${outputPlan.assets.length}`);
  if (outputPlan.report) {
    printLine(runtime.stdout, `Codex report: ${displayPath(runtime, outputPlan.report.path)}`);
  }
  if (state.dryRun) {
    printLine(runtime.stdout, "Dry run only. No template bundle files were written.");
  }

  throw new CliError(
    "md pdf-template codex output planning is implemented; template synthesis begins in Phase 4.",
    {
      code: "NOT_IMPLEMENTED",
      exitCode: 1,
    },
  );
}
