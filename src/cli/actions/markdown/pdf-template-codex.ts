import { suggestMarkdownPdfTemplateWithCodex } from "../../../adapters/codex/markdown-pdf-template";
import {
  assertUsableMdPdfTemplateCodexSignalMode,
  collectMdPdfTemplateCodexSignals,
  normalizeMdPdfTemplateCodexCommandState,
  planMdPdfTemplateCodexOutput,
  printMdPdfTemplateCodexSummary,
  synthesizeMdPdfTemplateCodex,
  synthesizeMdPdfTemplateCodexFromDecision,
  validateMdPdfTemplateCodexSynthesis,
  writeMdPdfTemplateCodexBundle,
  writeMdPdfTemplateCodexReportIfRequested,
  type MarkdownPdfTemplateCodexOutputPlan,
  type MarkdownPdfTemplateCodexSynthesisResult,
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
  synthesis: MarkdownPdfTemplateCodexSynthesisResult;
}

async function preflightMdPdfTemplateCodex(
  runtime: CliRuntime,
  options: MdPdfTemplateCodexOptions,
): Promise<MdPdfTemplateCodexPreflight> {
  const state = await normalizeMdPdfTemplateCodexCommandState(runtime, options);
  const signals = await collectMdPdfTemplateCodexSignals(runtime, state);
  assertUsableMdPdfTemplateCodexSignalMode(signals.signalMode);
  const outputPlan = await planMdPdfTemplateCodexOutput({ runtime, state, signals });
  const synthesis =
    signals.signalMode === "codex-assisted"
      ? synthesizeMdPdfTemplateCodexFromDecision({
          decision: (
            await suggestMarkdownPdfTemplateWithCodex({
              intent: state.intent,
              outputPlan,
              runner: options.codexRunner,
              signals,
              workingDirectory: runtime.cwd,
            })
          ).decision,
          outputPlan,
          signals,
        })
      : synthesizeMdPdfTemplateCodex({ outputPlan, signals });
  validateMdPdfTemplateCodexSynthesis({ outputPlan, synthesis });
  return { outputPlan, signals, state, synthesis };
}

export async function actionMdPdfTemplateCodex(
  runtime: CliRuntime,
  options: MdPdfTemplateCodexOptions,
): Promise<void> {
  const preflight = await preflightMdPdfTemplateCodex(runtime, options);
  printMdPdfTemplateCodexSummary(runtime, preflight);

  if (preflight.state.dryRun) {
    await writeMdPdfTemplateCodexReportIfRequested({
      outputPlan: preflight.outputPlan,
      overwrite: preflight.state.overwrite,
      runtime,
      signals: preflight.signals,
      state: preflight.state,
      synthesis: preflight.synthesis,
    });
    return;
  }

  await writeMdPdfTemplateCodexBundle({
    outputPlan: preflight.outputPlan,
    overwrite: preflight.state.overwrite,
    runtime,
    signals: preflight.signals,
    state: preflight.state,
    synthesis: preflight.synthesis,
  });
  if (preflight.synthesis.decisionMode === "no-usable-template") {
    if (preflight.outputPlan.report) {
      printLine(
        runtime.stderr,
        `Wrote Codex report: ${displayPath(runtime, preflight.outputPlan.report.path)}`,
      );
    }
    return;
  }
  printLine(
    runtime.stderr,
    `Wrote Markdown PDF template bundle: ${displayPath(runtime, preflight.outputPlan.outputDirectory)}`,
  );
}
