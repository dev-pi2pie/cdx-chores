import {
  MarkdownPdfCodexProfileError,
  suggestMarkdownPdfProfileWithCodex,
  type MarkdownPdfCodexProfileResult,
  type MarkdownPdfCodexProfileRunner,
} from "../../../adapters/codex/markdown-pdf-profile";
import type {
  MarkdownPdfCodexDecisionMode,
  MarkdownPdfCodexProfileRequest,
  MarkdownPdfCodexSignalMode,
} from "../../../adapters/codex/markdown-pdf-profile/types";
import {
  createCodexProgressSession,
  createDirectCodexProgressPresenter,
  type CodexProgressPresenter,
  type CodexProgressSession,
  type DirectCodexProgressStatus,
} from "../../actions/codex-progress";
import type { CliRuntime } from "../../types";
import {
  MARKDOWN_PDF_PROFILE_SUPPORTED_SCHEMA_SUMMARY,
  normalizeMarkdownPdfProfile,
} from "../profile";
import type { MarkdownPdfProfileCandidate } from "../profile/candidates";
import {
  collectMarkdownPdfFontSignals,
  type MarkdownPdfDocumentSignals,
  type MarkdownPdfFontSignals,
} from "../profile/signals";
import type { NormalizedMarkdownPdfProfileIdentity } from "../profile/types";
import { resolveMarkdownPdfCodexProfileCandidates } from "./candidates";
import { createMarkdownPdfCodexProfileIdentity } from "./profile-identity";
import { materializeMarkdownPdfProfileCodexProfile } from "./synthesis";

export interface MarkdownPdfCodexProfileOrchestrationContext {
  candidateResolution: ReturnType<typeof resolveMarkdownPdfCodexProfileCandidates>;
  createdAt: string;
  profileId: string;
  request: MarkdownPdfCodexProfileRequest;
}

interface MarkdownPdfCodexProfileOrchestrationResultBase {
  identity: NormalizedMarkdownPdfProfileIdentity;
  request: MarkdownPdfCodexProfileRequest;
}

export interface MarkdownPdfCodexProfileDeterministicOrchestrationResult extends MarkdownPdfCodexProfileOrchestrationResultBase {
  decisionMode: "deterministic";
  finalProfile: Record<string, unknown>;
  kind: "deterministic";
  selectedCandidate: MarkdownPdfProfileCandidate;
}

export interface MarkdownPdfCodexProfileCodexOrchestrationResult extends MarkdownPdfCodexProfileOrchestrationResultBase {
  codexResult: MarkdownPdfCodexProfileResult;
  decisionMode: Exclude<MarkdownPdfCodexDecisionMode, "no-usable-profile">;
  finalProfile: Record<string, unknown>;
  kind: "codex-profile";
  selectedCandidate: MarkdownPdfProfileCandidate;
}

export interface MarkdownPdfCodexProfileNoUsableOrchestrationResult extends MarkdownPdfCodexProfileOrchestrationResultBase {
  codexResult: MarkdownPdfCodexProfileResult;
  decisionMode: "no-usable-profile";
  failureMessage: string;
  kind: "no-usable-profile";
  selectedCandidate?: MarkdownPdfProfileCandidate;
}

export type MarkdownPdfCodexProfileOrchestrationResult =
  | MarkdownPdfCodexProfileDeterministicOrchestrationResult
  | MarkdownPdfCodexProfileCodexOrchestrationResult
  | MarkdownPdfCodexProfileNoUsableOrchestrationResult;

const NO_USABLE_MARKDOWN_PDF_CODEX_PROFILE_MESSAGE =
  "Codex did not find a usable Markdown PDF profile.";

export function createMarkdownPdfCodexProfileOrchestrationContext(input: {
  baseProfileCandidate?: MarkdownPdfProfileCandidate;
  baseProfileRole?: "authoritative" | "candidate";
  createdAt: string;
  documentSignals: MarkdownPdfDocumentSignals;
  fontHints: string[];
  fontSignals?: MarkdownPdfFontSignals;
  intent?: string;
  profileId: string;
  signalMode: MarkdownPdfCodexSignalMode;
  workingDirectory: string;
}): MarkdownPdfCodexProfileOrchestrationContext {
  const candidateResolution = resolveMarkdownPdfCodexProfileCandidates({
    baseProfileCandidate: input.baseProfileCandidate,
    baseProfileRole: input.baseProfileRole,
    signalMode: input.signalMode,
  });
  const fontSignals =
    input.fontSignals ??
    collectMarkdownPdfFontSignals({
      profile: normalizeMarkdownPdfProfile({
        profile: candidateResolution.strongestCandidate.fullProfile,
      }).profile,
    });
  return {
    candidateResolution,
    createdAt: input.createdAt,
    profileId: input.profileId,
    request: {
      candidates: candidateResolution.candidates,
      documentSignals: input.documentSignals,
      fontHints: input.fontHints,
      fontSignals,
      intent: input.intent,
      selectedBaseProfileSummary: input.baseProfileCandidate?.summary,
      signalMode: input.signalMode,
      supportedSchemaSummary: MARKDOWN_PDF_PROFILE_SUPPORTED_SCHEMA_SUMMARY,
      workingDirectory: input.workingDirectory,
    },
  };
}

async function suggestMarkdownPdfCodexProfileWithProgress(input: {
  context: MarkdownPdfCodexProfileOrchestrationContext;
  profileCodexRunner?: MarkdownPdfCodexProfileRunner;
  progressPresenter?: CodexProgressPresenter;
  progressSession?: CodexProgressSession;
  progressLabel: string;
  runtime: CliRuntime;
}): Promise<MarkdownPdfCodexProfileResult> {
  const ownsProgressSession = !input.progressSession;
  const codexProgress =
    input.progressSession ??
    createCodexProgressSession(
      input.progressPresenter ?? createDirectCodexProgressPresenter(input.runtime.stderr),
    );
  codexProgress.begin(input.progressLabel);
  let codexProgressStatus: DirectCodexProgressStatus = "error";
  try {
    const result = input.profileCodexRunner
      ? await suggestMarkdownPdfProfileWithCodex({
          ...input.context.request,
          runner: input.profileCodexRunner,
        })
      : await suggestMarkdownPdfProfileWithCodex(input.context.request);
    codexProgressStatus = result.profile
      ? result.decision.decisionMode === "conservative-fallback"
        ? "fallback"
        : "done"
      : "error";
    return result;
  } finally {
    if (ownsProgressSession) {
      codexProgress.stop(codexProgressStatus);
    }
  }
}

function findSelectedMarkdownPdfCodexProfileCandidate(input: {
  candidates: MarkdownPdfProfileCandidate[];
  selectedCandidateId: string;
}): MarkdownPdfProfileCandidate | undefined {
  return input.candidates.find((candidate) => candidate.summary.id === input.selectedCandidateId);
}

function candidateLineage(candidate: MarkdownPdfProfileCandidate): {
  basedOn: string;
  preset?: MarkdownPdfProfileCandidate["summary"]["preset"];
} {
  return {
    basedOn: candidate.summary.basedOn ?? candidate.summary.id,
    preset: candidate.summary.preset,
  };
}

function requireSelectedMarkdownPdfCodexProfileCandidate(input: {
  candidates: MarkdownPdfProfileCandidate[];
  selectedCandidateId: string;
}): MarkdownPdfProfileCandidate {
  const selectedCandidate = findSelectedMarkdownPdfCodexProfileCandidate(input);
  if (selectedCandidate) {
    return selectedCandidate;
  }
  throw new MarkdownPdfCodexProfileError(
    `Markdown PDF Codex response selected unknown candidate: ${input.selectedCandidateId}.`,
    "invalid-application",
  );
}

export async function runMarkdownPdfCodexProfileOrchestration(input: {
  context: MarkdownPdfCodexProfileOrchestrationContext;
  profileCodexRunner?: MarkdownPdfCodexProfileRunner;
  progressPresenter?: CodexProgressPresenter;
  progressSession?: CodexProgressSession;
  progressLabel: string;
  runtime: CliRuntime;
}): Promise<MarkdownPdfCodexProfileOrchestrationResult> {
  const { candidateResolution } = input.context;
  if (candidateResolution.executionMode === "deterministic") {
    const identity = createMarkdownPdfCodexProfileIdentity({
      ...candidateLineage(candidateResolution.selectedCandidate),
      createdAt: input.context.createdAt,
      profileId: input.context.profileId,
      source: "deterministic",
    });
    const { finalProfile } = materializeMarkdownPdfProfileCodexProfile({
      identity,
      profile: candidateResolution.selectedCandidate.fullProfile,
    });
    return {
      decisionMode: "deterministic",
      finalProfile,
      identity,
      kind: "deterministic",
      request: input.context.request,
      selectedCandidate: candidateResolution.selectedCandidate,
    };
  }

  const codexResult = await suggestMarkdownPdfCodexProfileWithProgress(input);
  if (!codexResult.profile || codexResult.decision.decisionMode === "no-usable-profile") {
    const identity = createMarkdownPdfCodexProfileIdentity({
      basedOn: "none",
      createdAt: input.context.createdAt,
      profileId: input.context.profileId,
      source: "codex",
    });
    return {
      codexResult,
      decisionMode: "no-usable-profile",
      failureMessage: NO_USABLE_MARKDOWN_PDF_CODEX_PROFILE_MESSAGE,
      identity,
      kind: "no-usable-profile",
      request: input.context.request,
    };
  }

  const selectedCandidate = requireSelectedMarkdownPdfCodexProfileCandidate({
    candidates: input.context.request.candidates,
    selectedCandidateId: codexResult.decision.selectedCandidateId,
  });
  const identity = createMarkdownPdfCodexProfileIdentity({
    ...candidateLineage(selectedCandidate),
    createdAt: input.context.createdAt,
    profileId: input.context.profileId,
    source: "codex",
  });
  const { finalProfile } = materializeMarkdownPdfProfileCodexProfile({
    identity,
    profile: codexResult.profile,
  });
  return {
    codexResult,
    decisionMode: codexResult.decision.decisionMode,
    finalProfile,
    identity,
    kind: "codex-profile",
    request: input.context.request,
    selectedCandidate,
  };
}
