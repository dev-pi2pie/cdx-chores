import type {
  MarkdownPdfTemplateCodexResult,
  MarkdownPdfTemplateCodexRunner,
} from "../../../adapters/codex/markdown-pdf-template/types";
import {
  createCodexProgressSession,
  createDirectCodexProgressPresenter,
  type CodexProgressSession,
  type DirectCodexProgressStatus,
} from "../../actions/codex-progress";
import type { CliRuntime } from "../../types";
import type { MarkdownPdfProfileCandidateSummary } from "../profile/candidates";
import { normalizeMarkdownPdfProfile } from "../profile";
import { collectMdPdfTemplateCodexRecipeSignals } from "../template-codex/recipe-signals";
import {
  collectMdPdfTemplateCodexFontSignals,
  createMdPdfTemplateCodexBaseProfileSummary,
} from "../template-codex/signals";
import {
  deriveMdPdfTemplateCodexFontOwnership,
  synthesizeMdPdfTemplateCodex,
  synthesizeMdPdfTemplateCodexFromDecision,
  validateMdPdfTemplateCodexSynthesis,
  type MarkdownPdfTemplateCodexOutputPlan,
  type MarkdownPdfTemplateCodexSynthesisResult,
  type MdPdfTemplateCodexSignalCollection,
} from "../template-codex";
import type { MdPdfProjectCodexProfilePhaseResult } from "./profile-phase";
import type {
  MarkdownPdfProjectCodexOutputPlan,
  MarkdownPdfProjectCodexTemplatePhaseSummary,
  MdPdfProjectCodexSignalCollection,
  NormalizedMdPdfProjectCodexCommandState,
} from "./types";

export interface MdPdfProjectCodexTemplatePhaseResult {
  codexResult?: MarkdownPdfTemplateCodexResult;
  forwardedProfileDirections: string[];
  outputPlan: MarkdownPdfTemplateCodexOutputPlan;
  phase: MarkdownPdfProjectCodexTemplatePhaseSummary;
  signals: MdPdfTemplateCodexSignalCollection;
  synthesis: MarkdownPdfTemplateCodexSynthesisResult;
}

function createProjectTemplateOutputPlan(
  outputPlan: MarkdownPdfProjectCodexOutputPlan,
): MarkdownPdfTemplateCodexOutputPlan {
  return {
    bundleId: outputPlan.identity.templateBundleId,
    outputDirectory: outputPlan.outputDirectory,
    generatedOutputDirectory: outputPlan.generatedOutputDirectory,
    templateHtml: outputPlan.templateHtml,
    styleCss: outputPlan.styleCss,
    report: outputPlan.report,
    assets: outputPlan.assets,
  };
}

function createForwardedTemplateIntent(input: {
  forwardedProfileDirections: readonly string[];
  intent?: string;
}): string | undefined {
  const trimmedIntent = input.intent?.trim();
  if (input.forwardedProfileDirections.length === 0) {
    return trimmedIntent || undefined;
  }
  return [
    ...(trimmedIntent ? [trimmedIntent, ""] : []),
    "Forwarded profile directions:",
    ...input.forwardedProfileDirections.map((direction) => `- ${direction}`),
  ].join("\n");
}

function topLevelProfileFields(profile: Record<string, unknown>): string[] {
  return Object.keys(profile)
    .filter((key) => key !== "profile")
    .sort();
}

function createFinalProfileSummary(
  profilePhase: MdPdfProjectCodexProfilePhaseResult,
): MdPdfTemplateCodexSignalCollection["baseProfile"]["summary"] {
  const {
    basedOn: _basedOn,
    preset: _preset,
    ...selectedSummary
  } = profilePhase.selectedCandidate.summary;
  const summary: MarkdownPdfProfileCandidateSummary = {
    ...selectedSummary,
    ...(profilePhase.identity.basedOn ? { basedOn: profilePhase.identity.basedOn } : {}),
    ...(profilePhase.identity.preset ? { preset: profilePhase.identity.preset } : {}),
    fields: topLevelProfileFields(profilePhase.finalProfile),
    id: profilePhase.identity.id,
    label: "Final project profile",
    presetBacked: Boolean(profilePhase.identity.preset),
  };
  return createMdPdfTemplateCodexBaseProfileSummary(summary);
}

function createTemplateSignalsFromProject(input: {
  normalizedFinalProfile: ReturnType<typeof normalizeMarkdownPdfProfile>;
  profilePhase: MdPdfProjectCodexProfilePhaseResult;
  signals: MdPdfProjectCodexSignalCollection;
  signalMode: MarkdownPdfProjectCodexTemplatePhaseSummary["signalMode"];
}): MdPdfTemplateCodexSignalCollection {
  return {
    signalMode: input.signalMode,
    documentSignals: input.signals.shared.document,
    baseProfile: {
      available: true,
      summary: createFinalProfileSummary(input.profilePhase),
    },
    recipe: collectMdPdfTemplateCodexRecipeSignals({
      baseProfileRecipeOptions: input.normalizedFinalProfile.recipeOptions,
      documentSignals: input.signals.shared.document,
      explicitRecipe: { fields: [], options: {} },
    }),
    title: {
      baseProfileMetadataTitle: input.normalizedFinalProfile.profile.titleBlock.metadataTitle,
      explicitKeepMetadataTitleIntent: input.signals.shared.title.explicitKeepMetadataTitleIntent,
      explicitHideMetadataTitleIntent: input.signals.shared.title.explicitHideMetadataTitleIntent,
    },
    fonts: {
      hints: input.signals.profile.fonts.hints,
      profileFonts: collectMdPdfTemplateCodexFontSignals(input.normalizedFinalProfile.profile),
    },
    coverImage: input.signals.template.coverImage,
  };
}

function templatePhaseDecisionMode(
  decisionMode: MarkdownPdfTemplateCodexSynthesisResult["decisionMode"],
): MarkdownPdfProjectCodexTemplatePhaseSummary["decisionMode"] {
  return decisionMode === "no-usable-template" ? "no-usable-project" : decisionMode;
}

async function suggestProjectTemplateWithCodexProgress(input: {
  intent?: string;
  outputPlan: MarkdownPdfTemplateCodexOutputPlan;
  progressSession?: CodexProgressSession;
  runtime: CliRuntime;
  signals: MdPdfTemplateCodexSignalCollection;
  templateCodexRunner?: MarkdownPdfTemplateCodexRunner;
}): Promise<MarkdownPdfTemplateCodexResult> {
  const ownsProgressSession = !input.progressSession;
  const codexProgress =
    input.progressSession ??
    createCodexProgressSession(createDirectCodexProgressPresenter(input.runtime.stderr));
  codexProgress.begin("Requesting Codex Markdown PDF project template recommendation");
  let codexProgressStatus: DirectCodexProgressStatus = "error";
  try {
    const { suggestMarkdownPdfTemplateWithCodex } =
      await import("../../../adapters/codex/markdown-pdf-template");
    const result = input.templateCodexRunner
      ? await suggestMarkdownPdfTemplateWithCodex({
          intent: input.intent,
          outputPlan: input.outputPlan,
          runner: input.templateCodexRunner,
          signals: input.signals,
          workingDirectory: input.runtime.cwd,
        })
      : await suggestMarkdownPdfTemplateWithCodex({
          intent: input.intent,
          outputPlan: input.outputPlan,
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
    if (ownsProgressSession) {
      codexProgress.stop(codexProgressStatus);
    }
  }
}

export async function runMdPdfProjectCodexTemplatePhase(input: {
  outputPlan: MarkdownPdfProjectCodexOutputPlan;
  progressSession?: CodexProgressSession;
  profilePhase: MdPdfProjectCodexProfilePhaseResult;
  runtime: CliRuntime;
  signals: MdPdfProjectCodexSignalCollection;
  state: NormalizedMdPdfProjectCodexCommandState;
  templateCodexRunner?: MarkdownPdfTemplateCodexRunner;
}): Promise<MdPdfProjectCodexTemplatePhaseResult> {
  const forwardedProfileDirections = input.profilePhase.unmatchedProfileDirections;
  const shouldRunCodex =
    input.signals.modes.template === "codex-assisted" || forwardedProfileDirections.length > 0;
  const signalMode = shouldRunCodex ? "codex-assisted" : input.signals.modes.template;
  const outputPlan = createProjectTemplateOutputPlan(input.outputPlan);
  const normalizedFinalProfile = normalizeMarkdownPdfProfile({
    profile: input.profilePhase.finalProfile,
  });
  const fontOwnership = deriveMdPdfTemplateCodexFontOwnership(normalizedFinalProfile.profile);
  const signals = createTemplateSignalsFromProject({
    normalizedFinalProfile,
    profilePhase: input.profilePhase,
    signalMode,
    signals: input.signals,
  });
  const intent = createForwardedTemplateIntent({
    forwardedProfileDirections,
    intent: input.state.intent,
  });
  const codexResult = shouldRunCodex
    ? await suggestProjectTemplateWithCodexProgress({
        intent,
        outputPlan,
        progressSession: input.progressSession,
        runtime: input.runtime,
        signals,
        templateCodexRunner: input.templateCodexRunner,
      })
    : undefined;
  const synthesis = codexResult
    ? synthesizeMdPdfTemplateCodexFromDecision({
        decision: codexResult.decision,
        fontOwnership,
        outputPlan,
        signals,
      })
    : synthesizeMdPdfTemplateCodex({ fontOwnership, outputPlan, signals });

  validateMdPdfTemplateCodexSynthesis({
    deferBodyBoundaryValidationToProject: true,
    outputPlan,
    synthesis,
  });

  return {
    codexResult,
    forwardedProfileDirections,
    outputPlan,
    phase: {
      decisionMode: templatePhaseDecisionMode(synthesis.decisionMode),
      fallbackReason: synthesis.fallbackReason,
      phase: "template",
      signalMode,
      warnings: synthesis.warnings ?? [],
    },
    signals,
    synthesis,
  };
}
