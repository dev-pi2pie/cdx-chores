import {
  suggestMarkdownPdfProfileWithCodex,
  type MarkdownPdfCodexProfileResult,
  type MarkdownPdfCodexProfileRunner,
} from "../../../adapters/codex/markdown-pdf-profile";
import { MARKDOWN_PDF_PROFILE_SUPPORTED_SCHEMA_SUMMARY } from "../profile";
import {
  createMarkdownPdfProfileCandidates,
  type MarkdownPdfProfileCandidate,
} from "../profile/candidates";
import {
  materializeMarkdownPdfProfileCodexProfile,
  serializeMarkdownPdfProfileCodexProfile,
} from "../profile-codex";
import { executionModeForMarkdownPdfProfileCodexSignalMode } from "../profile-codex/signal-mode";
import type { NormalizedMarkdownPdfProfileIdentity } from "../profile/types";
import { CliError } from "../../errors";
import type { CliRuntime } from "../../types";
import {
  startDirectCodexProgress,
  type DirectCodexProgressStatus,
} from "../../actions/codex-progress";
import type {
  MarkdownPdfProjectCodexOutputPlan,
  MarkdownPdfProjectCodexProfilePhaseSummary,
  MdPdfProjectCodexSignalCollection,
  NormalizedMdPdfProjectCodexCommandState,
} from "./types";

export interface MdPdfProjectCodexProfilePhaseResult {
  codexResult?: MarkdownPdfCodexProfileResult;
  finalProfile: Record<string, unknown>;
  identity: NormalizedMarkdownPdfProfileIdentity;
  phase: MarkdownPdfProjectCodexProfilePhaseSummary;
  selectedCandidate: MarkdownPdfProfileCandidate;
  serializedProfile: string;
  unmatchedProfileDirections: string[];
}

function createProjectProfileIdentity(input: {
  basedOn: string;
  outputPlan: MarkdownPdfProjectCodexOutputPlan;
  selectedCandidate?: MarkdownPdfProfileCandidate;
  source: NormalizedMarkdownPdfProfileIdentity["source"];
}): NormalizedMarkdownPdfProfileIdentity {
  const basedOn =
    input.selectedCandidate?.summary.basedOn ??
    input.selectedCandidate?.summary.id ??
    input.basedOn;
  return {
    id: input.outputPlan.identity.profileId,
    source: input.source,
    basedOn,
    preset: input.selectedCandidate?.summary.preset,
    createdAt: input.outputPlan.identity.createdAt,
  };
}

function projectProfileCandidates(
  signals: MdPdfProjectCodexSignalCollection,
): MarkdownPdfProfileCandidate[] {
  const candidates = createMarkdownPdfProfileCandidates();
  if (signals.profile.baseProfile.candidate) {
    candidates.unshift(signals.profile.baseProfile.candidate);
  }
  return candidates;
}

function selectedCandidate(
  candidates: MarkdownPdfProfileCandidate[],
  selectedCandidateId: string,
): MarkdownPdfProfileCandidate | undefined {
  return candidates.find((candidate) => candidate.summary.id === selectedCandidateId);
}

function requireSelectedCandidate(
  candidates: MarkdownPdfProfileCandidate[],
  selectedCandidateId: string,
): MarkdownPdfProfileCandidate {
  const candidate = selectedCandidate(candidates, selectedCandidateId);
  if (candidate) {
    return candidate;
  }
  throw new CliError(
    `Markdown PDF project profile phase selected unknown candidate: ${selectedCandidateId}.`,
    {
      code: "MARKDOWN_PDF_PROJECT_PROFILE_INVALID",
      exitCode: 1,
    },
  );
}

function materializeProfilePhaseResult(input: {
  codexResult?: MarkdownPdfCodexProfileResult;
  decisionMode: MarkdownPdfProjectCodexProfilePhaseSummary["decisionMode"];
  fallbackReason?: string;
  finalProfileSource: Record<string, unknown>;
  identity: NormalizedMarkdownPdfProfileIdentity;
  outputPlan: MarkdownPdfProjectCodexOutputPlan;
  selectedCandidate: MarkdownPdfProfileCandidate;
  signalMode: MarkdownPdfProjectCodexProfilePhaseSummary["signalMode"];
  unmatchedProfileDirections?: string[];
  warnings?: string[];
}): MdPdfProjectCodexProfilePhaseResult {
  const { finalProfile } = materializeMarkdownPdfProfileCodexProfile({
    identity: input.identity,
    profile: input.finalProfileSource,
  });
  return {
    codexResult: input.codexResult,
    finalProfile,
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
      finalProfile,
      outputPath: input.outputPlan.profile.path,
    }),
    unmatchedProfileDirections: input.unmatchedProfileDirections ?? [],
  };
}

async function suggestProjectProfileWithCodexProgress(input: {
  candidates: MarkdownPdfProfileCandidate[];
  outputPlan: MarkdownPdfProjectCodexOutputPlan;
  profileCodexRunner?: MarkdownPdfCodexProfileRunner;
  runtime: CliRuntime;
  signals: MdPdfProjectCodexSignalCollection;
  state: NormalizedMdPdfProjectCodexCommandState;
}): Promise<MarkdownPdfCodexProfileResult> {
  const codexProgress = startDirectCodexProgress(
    input.runtime.stderr,
    "Requesting Codex Markdown PDF project profile recommendation",
  );
  let codexProgressStatus: DirectCodexProgressStatus = "error";
  try {
    const result = await suggestMarkdownPdfProfileWithCodex({
      candidates: input.candidates,
      documentSignals: input.signals.shared.document,
      fontHints: input.signals.profile.fonts.hints,
      fontSignals: input.signals.profile.fonts.profileFonts,
      intent: input.state.intent,
      runner: input.profileCodexRunner,
      selectedBaseProfileSummary: input.signals.profile.baseProfile.candidate?.summary,
      signalMode: input.signals.modes.profile,
      supportedSchemaSummary: MARKDOWN_PDF_PROFILE_SUPPORTED_SCHEMA_SUMMARY,
      workingDirectory: input.runtime.cwd,
    });
    codexProgressStatus = result.profile
      ? result.decision.decisionMode === "conservative-fallback"
        ? "fallback"
        : "done"
      : "error";
    return result;
  } finally {
    codexProgress.stop(codexProgressStatus);
  }
}

export async function runMdPdfProjectCodexProfilePhase(input: {
  outputPlan: MarkdownPdfProjectCodexOutputPlan;
  profileCodexRunner?: MarkdownPdfCodexProfileRunner;
  runtime: CliRuntime;
  signals: MdPdfProjectCodexSignalCollection;
  state: NormalizedMdPdfProjectCodexCommandState;
}): Promise<MdPdfProjectCodexProfilePhaseResult> {
  const signalMode = input.signals.modes.profile;
  const candidates = projectProfileCandidates(input.signals);

  if (executionModeForMarkdownPdfProfileCodexSignalMode(signalMode) === "deterministic") {
    const selected =
      signalMode === "base-only-deterministic"
        ? input.signals.profile.baseProfile.candidate
        : input.signals.profile.basis.candidate;
    if (!selected) {
      throw new CliError("No Markdown PDF profile candidate is available.", {
        code: "MARKDOWN_PDF_PROJECT_PROFILE_INVALID",
        exitCode: 1,
      });
    }
    const identity = createProjectProfileIdentity({
      basedOn: "default",
      outputPlan: input.outputPlan,
      selectedCandidate: selected,
      source: "deterministic",
    });
    return materializeProfilePhaseResult({
      decisionMode: "deterministic",
      finalProfileSource: selected.fullProfile,
      identity,
      outputPlan: input.outputPlan,
      selectedCandidate: selected,
      signalMode,
    });
  }

  const codexResult = await suggestProjectProfileWithCodexProgress({
    candidates,
    outputPlan: input.outputPlan,
    profileCodexRunner: input.profileCodexRunner,
    runtime: input.runtime,
    signals: input.signals,
    state: input.state,
  });
  if (!codexResult.profile || codexResult.decision.decisionMode === "no-usable-profile") {
    throw new CliError("Codex did not find a usable Markdown PDF project profile.", {
      code: "MARKDOWN_PDF_PROJECT_NO_USABLE_PROFILE",
      exitCode: 1,
    });
  }
  const selected = requireSelectedCandidate(candidates, codexResult.decision.selectedCandidateId);
  const identity = createProjectProfileIdentity({
    basedOn: "none",
    outputPlan: input.outputPlan,
    selectedCandidate: selected,
    source: "codex",
  });
  return materializeProfilePhaseResult({
    codexResult,
    decisionMode: codexResult.decision.decisionMode,
    fallbackReason: codexResult.decision.fallbackReason,
    finalProfileSource: codexResult.profile,
    identity,
    outputPlan: input.outputPlan,
    selectedCandidate: selected,
    signalMode,
    unmatchedProfileDirections: codexResult.decision.unmatchedDirections,
    warnings: codexResult.decision.warnings,
  });
}
