import {
  classifyMarkdownPdfCodexProfileFailure,
  type MarkdownPdfCodexProfileResult,
  type MarkdownPdfCodexProfileRunner,
} from "../../../adapters/codex/markdown-pdf-profile";
import { type MarkdownPdfProfileCandidate } from "../profile/candidates";
import {
  createMarkdownPdfCodexProfileOrchestrationContext,
  runMarkdownPdfCodexProfileOrchestration,
  serializeMarkdownPdfProfileCodexProfile,
} from "../profile-codex";
import type { NormalizedMarkdownPdfProfileIdentity } from "../profile/types";
import { CliError } from "../../errors";
import type { CliRuntime } from "../../types";
import type { CodexProgressSession } from "../../actions/codex-progress";
import type {
  MarkdownPdfProjectCodexOutputPlan,
  MarkdownPdfProjectCodexProfilePhaseSummary,
  MdPdfProjectCodexSignalCollection,
  NormalizedMdPdfProjectCodexCommandState,
} from "./types";
import { collectTemplateOwnedIntentDirections } from "./signal-mode";

export interface MdPdfProjectCodexProfilePhaseResult {
  codexResult?: MarkdownPdfCodexProfileResult;
  finalProfile: Record<string, unknown>;
  identity: NormalizedMarkdownPdfProfileIdentity;
  phase: MarkdownPdfProjectCodexProfilePhaseSummary;
  selectedCandidate: MarkdownPdfProfileCandidate;
  serializedProfile: string;
  unmatchedProfileDirections: string[];
}

function profileCodexFailureMessage(
  kind: ReturnType<typeof classifyMarkdownPdfCodexProfileFailure>,
): string {
  if (kind === "structured-output-schema") {
    return "Codex failed while preparing a Markdown PDF project profile structured-output request.";
  }
  if (kind === "malformed-output") {
    return "Codex returned malformed Markdown PDF project profile structured output.";
  }
  return "Codex failed while generating a Markdown PDF project profile decision.";
}

function materializeProfilePhaseResult(input: {
  codexResult?: MarkdownPdfCodexProfileResult;
  decisionMode: MarkdownPdfProjectCodexProfilePhaseSummary["decisionMode"];
  fallbackReason?: string;
  finalProfile: Record<string, unknown>;
  identity: NormalizedMarkdownPdfProfileIdentity;
  outputPlan: MarkdownPdfProjectCodexOutputPlan;
  selectedCandidate: MarkdownPdfProfileCandidate;
  signalMode: MarkdownPdfProjectCodexProfilePhaseSummary["signalMode"];
  unmatchedProfileDirections?: string[];
  warnings?: string[];
}): MdPdfProjectCodexProfilePhaseResult {
  return {
    codexResult: input.codexResult,
    finalProfile: input.finalProfile,
    identity: input.identity,
    phase: {
      decisionMode: input.decisionMode,
      fallbackReason: input.fallbackReason,
      phase: "profile",
      signalMode: input.signalMode,
      warnings: input.warnings ?? [],
    },
    selectedCandidate: input.selectedCandidate,
    serializedProfile: serializeMarkdownPdfProfileCodexProfile({
      finalProfile: input.finalProfile,
      outputPath: input.outputPlan.profile.path,
    }),
    unmatchedProfileDirections: input.unmatchedProfileDirections ?? [],
  };
}

function filterTemplateOwnedProfileDirections(input: {
  directions: readonly string[];
  signals: MdPdfProjectCodexSignalCollection;
}): string[] {
  if (input.directions.length === 0) {
    return [];
  }
  const coverCompositionIsTemplateOwned =
    input.signals.template.ownedSignals.intentDirections.includes("cover-composition-intent");
  if (!coverCompositionIsTemplateOwned) {
    return [...input.directions];
  }
  return input.directions.filter((direction) => {
    const directionTemplateOwners = collectTemplateOwnedIntentDirections(direction);
    return !directionTemplateOwners.includes("cover-composition-intent");
  });
}

export async function runMdPdfProjectCodexProfilePhase(input: {
  outputPlan: MarkdownPdfProjectCodexOutputPlan;
  profileCodexRunner?: MarkdownPdfCodexProfileRunner;
  progressSession?: CodexProgressSession;
  runtime: CliRuntime;
  signals: MdPdfProjectCodexSignalCollection;
  state: NormalizedMdPdfProjectCodexCommandState;
}): Promise<MdPdfProjectCodexProfilePhaseResult> {
  const signalMode = input.signals.modes.profile;
  const orchestrationContext = createMarkdownPdfCodexProfileOrchestrationContext({
    baseProfileCandidate: input.signals.profile.baseProfile.candidate,
    baseProfileRole: "authoritative",
    createdAt: input.outputPlan.identity.createdAt,
    documentSignals: input.signals.shared.document,
    fontHints: input.signals.profile.fonts.hints,
    fontSignals: input.signals.profile.fonts.profileFonts,
    intent: input.state.intent,
    profileId: input.outputPlan.identity.profileId,
    signalMode,
    workingDirectory: input.runtime.cwd,
  });

  let decision: Awaited<ReturnType<typeof runMarkdownPdfCodexProfileOrchestration>>;
  try {
    decision = await runMarkdownPdfCodexProfileOrchestration({
      context: orchestrationContext,
      profileCodexRunner: input.profileCodexRunner,
      progressSession: input.progressSession,
      progressLabel: "Requesting Codex Markdown PDF project profile recommendation",
      runtime: input.runtime,
    });
  } catch (error) {
    const failureKind = classifyMarkdownPdfCodexProfileFailure(error);
    if (failureKind === "invalid-application") {
      throw new CliError("Codex returned an invalid Markdown PDF project profile decision.", {
        code: "MARKDOWN_PDF_PROJECT_PROFILE_INVALID",
        exitCode: 1,
      });
    }
    throw new CliError(profileCodexFailureMessage(failureKind), {
      code: "MARKDOWN_PDF_PROJECT_PROFILE_CODEX_FAILED",
      exitCode: 1,
    });
  }
  if (decision.kind === "no-usable-profile") {
    throw new CliError(decision.failureMessage, {
      code: "MARKDOWN_PDF_PROJECT_NO_USABLE_PROFILE",
      exitCode: 1,
    });
  }
  const unmatchedProfileDirections =
    decision.kind === "codex-profile"
      ? filterTemplateOwnedProfileDirections({
          directions: decision.codexResult.decision.unmatchedDirections,
          signals: input.signals,
        })
      : [];
  return materializeProfilePhaseResult({
    codexResult: decision.kind === "codex-profile" ? decision.codexResult : undefined,
    decisionMode: decision.decisionMode,
    fallbackReason:
      decision.kind === "codex-profile" ? decision.codexResult.decision.fallbackReason : undefined,
    finalProfile: decision.finalProfile,
    identity: decision.identity,
    outputPlan: input.outputPlan,
    selectedCandidate: decision.selectedCandidate,
    signalMode,
    unmatchedProfileDirections,
    warnings: decision.kind === "codex-profile" ? decision.codexResult.decision.warnings : [],
  });
}
