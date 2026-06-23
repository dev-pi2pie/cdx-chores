import { CliError } from "../../errors";
import {
  assertUsableMdPdfTemplateCodexSignalMode,
  collectMdPdfTemplateCodexSignals,
  normalizeMdPdfTemplateCodexCommandState,
  planMdPdfTemplateCodexOutput,
  type MarkdownPdfTemplateCodexOutputPlan,
  type MdPdfTemplateCodexCliOptions,
  type MdPdfTemplateCodexOptions,
  type MdPdfTemplateCodexSignalCollection,
  type NormalizedMdPdfTemplateCodexCommandState,
} from "../../markdown-pdf/template-codex";
import { displayPath, printLine } from "../shared";
import type { CliRuntime } from "../../types";

export type { MdPdfTemplateCodexCliOptions, MdPdfTemplateCodexOptions };

interface MdPdfTemplateCodexPreflight {
  outputPlan: MarkdownPdfTemplateCodexOutputPlan;
  signals: MdPdfTemplateCodexSignalCollection;
  state: NormalizedMdPdfTemplateCodexCommandState;
}

async function preflightMdPdfTemplateCodex(
  runtime: CliRuntime,
  options: MdPdfTemplateCodexOptions,
): Promise<MdPdfTemplateCodexPreflight> {
  const state = await normalizeMdPdfTemplateCodexCommandState(runtime, options);
  const signals = await collectMdPdfTemplateCodexSignals(runtime, state);
  assertUsableMdPdfTemplateCodexSignalMode(signals.signalMode);
  const outputPlan = await planMdPdfTemplateCodexOutput({ runtime, state, signals });
  return { outputPlan, signals, state };
}

function printMdPdfTemplateCodexPlannedSummary(
  runtime: CliRuntime,
  preflight: MdPdfTemplateCodexPreflight,
): void {
  const { outputPlan, signals, state } = preflight;
  printLine(runtime.stdout, `Signal mode: ${signals.signalMode}`);
  printLine(runtime.stdout, `Template bundle: ${outputPlan.bundleId}`);
  printLine(
    runtime.stdout,
    `Output directory: ${displayPath(runtime, outputPlan.outputDirectory)}`,
  );
  printLine(
    runtime.stdout,
    `Template HTML: ${outputPlan.templateHtml.bundlePath ?? "template.html"}`,
  );
  printLine(runtime.stdout, `Stylesheet: ${outputPlan.styleCss.bundlePath ?? "style.css"}`);
  printLine(runtime.stdout, `Managed assets: ${outputPlan.assets.length}`);
  if (outputPlan.report) {
    printLine(runtime.stdout, `Codex report: ${displayPath(runtime, outputPlan.report.path)}`);
  }
  if (state.dryRun) {
    printLine(runtime.stdout, "Dry run only. No template bundle files were written.");
  }
}

export async function actionMdPdfTemplateCodex(
  runtime: CliRuntime,
  options: MdPdfTemplateCodexOptions,
): Promise<void> {
  const preflight = await preflightMdPdfTemplateCodex(runtime, options);
  printMdPdfTemplateCodexPlannedSummary(runtime, preflight);

  throw new CliError(
    "md pdf-template codex output planning is implemented; template synthesis begins in Phase 4.",
    {
      code: "NOT_IMPLEMENTED",
      exitCode: 1,
    },
  );
}
