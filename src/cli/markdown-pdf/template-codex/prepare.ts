import type { MarkdownPdfTemplateCodexResult } from "../../../adapters/codex/markdown-pdf-template/types";
import {
  createCodexProgressSession,
  createDirectCodexProgressPresenter,
  type DirectCodexProgressStatus,
} from "../../actions/codex-progress";
import type { CliRuntime } from "../../types";
import { assertUsableMdPdfTemplateCodexSignalMode } from "./signal-mode";
import { collectMdPdfTemplateCodexSignalContext } from "./signals";
import { normalizeMdPdfTemplateCodexCommandState } from "./options";
import {
  planMdPdfTemplateCodexOutput,
  validateMdPdfTemplateCodexOutputWritability,
} from "./output-plan";
import { createPreparedMdPdfTemplateCodexArtifact } from "./prepared";
import type { PreparedMdPdfTemplateCodexArtifact } from "./prepared";
import {
  synthesizeMdPdfTemplateCodex,
  synthesizeMdPdfTemplateCodexFromDecision,
} from "./synthesize";
import type {
  MarkdownPdfTemplateCodexOutputPlan,
  MdPdfTemplateCodexOptions,
  MdPdfTemplateCodexSignalCollection,
  NormalizedMdPdfTemplateCodexCommandState,
} from "./types";
import { validateMdPdfTemplateCodexSynthesis } from "./validate-template";

async function suggestMdPdfTemplateWithCodexProgress(input: {
  outputPlan: MarkdownPdfTemplateCodexOutputPlan;
  options: MdPdfTemplateCodexOptions;
  runtime: CliRuntime;
  signals: MdPdfTemplateCodexSignalCollection;
  state: NormalizedMdPdfTemplateCodexCommandState;
}): Promise<MarkdownPdfTemplateCodexResult> {
  const codexProgress = createCodexProgressSession(
    input.options.codexProgressPresenter ??
      createDirectCodexProgressPresenter(input.runtime.stderr),
  );
  codexProgress.begin("Requesting Codex Markdown PDF template recommendation");
  let codexProgressStatus: DirectCodexProgressStatus = "error";
  try {
    const { suggestMarkdownPdfTemplateWithCodex } =
      await import("../../../adapters/codex/markdown-pdf-template");
    const result = await suggestMarkdownPdfTemplateWithCodex({
      intent: input.state.intent,
      outputPlan: input.outputPlan,
      runner: input.options.codexRunner,
      signals: input.signals,
      timeoutMs: input.options.timeoutMs,
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

export async function prepareMdPdfTemplateCodex(
  runtime: CliRuntime,
  options: MdPdfTemplateCodexOptions,
): Promise<PreparedMdPdfTemplateCodexArtifact> {
  const state = await normalizeMdPdfTemplateCodexCommandState(runtime, options);
  const { compatibilityProfile, fontOwnership, signals } =
    await collectMdPdfTemplateCodexSignalContext(runtime, state);
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
          fontOwnership,
          outputPlan,
          signals,
        })
      : synthesizeMdPdfTemplateCodex({ fontOwnership, outputPlan, signals });
  if (!state.dryRun && synthesis.decisionMode !== "no-usable-template") {
    await validateMdPdfTemplateCodexOutputWritability({
      plan: outputPlan,
      runtime,
      state,
      writeMode: "bundle",
    });
  }
  validateMdPdfTemplateCodexSynthesis({ compatibilityProfile, outputPlan, synthesis });
  return createPreparedMdPdfTemplateCodexArtifact({
    outputPlan,
    runtime,
    signals,
    state,
    synthesis,
  });
}
