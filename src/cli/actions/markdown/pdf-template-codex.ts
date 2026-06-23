import {
  assertUsableMdPdfTemplateCodexSignalMode,
  collectMdPdfTemplateCodexSignals,
  normalizeMdPdfTemplateCodexCommandState,
  planMdPdfTemplateCodexOutput,
  synthesizeMdPdfTemplateCodex,
  writeMdPdfTemplateCodexBundle,
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
  const synthesis = synthesizeMdPdfTemplateCodex({ outputPlan, signals });
  return { outputPlan, signals, state, synthesis };
}

function printMdPdfTemplateCodexPlannedSummary(
  runtime: CliRuntime,
  preflight: MdPdfTemplateCodexPreflight,
): void {
  const { outputPlan, signals, state } = preflight;
  printLine(runtime.stdout, `Signal mode: ${signals.signalMode}`);
  printLine(runtime.stdout, `Template family: ${preflight.synthesis.templateFamily}`);
  printLine(
    runtime.stdout,
    `Recipe preset: ${preflight.synthesis.slots.recipePreset.preset} (${preflight.synthesis.slots.recipePreset.source})`,
  );
  if (preflight.synthesis.slots.cover.enabled) {
    printLine(
      runtime.stdout,
      `Cover image fit: ${preflight.synthesis.slots.cover.imageFit ?? "contain"}`,
    );
  }
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
}

export async function actionMdPdfTemplateCodex(
  runtime: CliRuntime,
  options: MdPdfTemplateCodexOptions,
): Promise<void> {
  const preflight = await preflightMdPdfTemplateCodex(runtime, options);
  printMdPdfTemplateCodexPlannedSummary(runtime, preflight);

  if (preflight.state.dryRun) {
    return;
  }

  await writeMdPdfTemplateCodexBundle({
    outputPlan: preflight.outputPlan,
    overwrite: preflight.state.overwrite,
    synthesis: preflight.synthesis,
  });
  printLine(
    runtime.stderr,
    `Wrote Markdown PDF template bundle: ${displayPath(runtime, preflight.outputPlan.outputDirectory)}`,
  );
}
