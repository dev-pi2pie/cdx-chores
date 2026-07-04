import { suggestMarkdownPdfTemplateWithCodex } from "../../../adapters/codex/markdown-pdf-template";
import {
  assertUsableMdPdfTemplateCodexSignalMode,
  collectMdPdfTemplateCodexSignals,
  normalizeMdPdfTemplateCodexCommandState,
  planMdPdfTemplateCodexOutput,
  printMdPdfTemplateCodexSummary,
  synthesizeMdPdfTemplateCodex,
  synthesizeMdPdfTemplateCodexFromDecision,
  validateMdPdfTemplateCodexOutputWritability,
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
import { startDirectCodexProgress, type DirectCodexProgressStatus } from "../codex-progress";
import { displayPath, printLine } from "../shared";
import { CliError } from "../../errors";
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
  const outputPlan = await planMdPdfTemplateCodexOutput({
    runtime,
    state,
    signals,
    writeMode: state.dryRun || signals.signalMode === "codex-assisted" ? "report-only" : "bundle",
  });
  const synthesis =
    signals.signalMode === "codex-assisted"
      ? synthesizeMdPdfTemplateCodexFromDecision({
          decision: (
            await suggestMdPdfTemplateWithCodexProgress({
              outputPlan,
              options,
              runtime,
              signals,
              state,
            })
          ).decision,
          outputPlan,
          signals,
        })
      : synthesizeMdPdfTemplateCodex({ outputPlan, signals });
  if (!state.dryRun && synthesis.decisionMode !== "no-usable-template") {
    await validateMdPdfTemplateCodexOutputWritability({
      plan: outputPlan,
      runtime,
      state,
      writeMode: "bundle",
    });
  }
  validateMdPdfTemplateCodexSynthesis({ outputPlan, synthesis });
  return { outputPlan, signals, state, synthesis };
}

async function suggestMdPdfTemplateWithCodexProgress(input: {
  outputPlan: MarkdownPdfTemplateCodexOutputPlan;
  options: MdPdfTemplateCodexOptions;
  runtime: CliRuntime;
  signals: MdPdfTemplateCodexSignalCollection;
  state: NormalizedMdPdfTemplateCodexCommandState;
}): ReturnType<typeof suggestMarkdownPdfTemplateWithCodex> {
  const codexProgress = startDirectCodexProgress(
    input.runtime.stderr,
    "Requesting Codex Markdown PDF template recommendation",
  );
  let codexProgressStatus: DirectCodexProgressStatus = "error";
  try {
    const result = await suggestMarkdownPdfTemplateWithCodex({
      intent: input.state.intent,
      outputPlan: input.outputPlan,
      runner: input.options.codexRunner,
      signals: input.signals,
      workingDirectory: input.runtime.cwd,
    });
    codexProgressStatus =
      result.decision.decisionMode === "adapted"
        ? "done"
        : result.decision.decisionMode === "conservative-fallback"
          ? "fallback"
          : "error";
    return result;
  } finally {
    codexProgress.stop(codexProgressStatus);
  }
}

function throwNoUsableTemplate(synthesis: MarkdownPdfTemplateCodexSynthesisResult): never {
  throw new CliError(
    synthesis.fallbackReason ??
      "No usable Markdown PDF template path is available for the provided signals.",
    {
      code: "NO_USABLE_TEMPLATE",
      exitCode: 1,
    },
  );
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
    if (preflight.synthesis.decisionMode === "no-usable-template") {
      throwNoUsableTemplate(preflight.synthesis);
    }
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
    throwNoUsableTemplate(preflight.synthesis);
  }
  printLine(
    runtime.stderr,
    `Wrote Markdown PDF template bundle: ${displayPath(runtime, preflight.outputPlan.outputDirectory)}`,
  );
}
