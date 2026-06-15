import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";

import type {
  MarkdownPdfCodexDecision,
  MarkdownPdfCodexProfileRequest,
  MarkdownPdfCodexProfileResult,
} from "../../../adapters/codex/markdown-pdf-profile";
import { MARKDOWN_PDF_CODEX_SIGNAL_MODES } from "../../../adapters/codex/markdown-pdf-profile/types";
import { readTextFileRequired, writeTextFileSafe } from "../../file-io";
import type { MarkdownPdfProfileCandidate } from "../profile/candidates";
import { MARKDOWN_PDF_PROFILE_ROOT_KEYS } from "../profile/schema";
import type { NormalizedMarkdownPdfProfileIdentity } from "../profile/types";

export const MARKDOWN_PDF_CODEX_REPORT_ARTIFACT_TYPE = "markdown-pdf-codex-profile-report";
export const MARKDOWN_PDF_CODEX_REPORT_ARTIFACT_VERSION = 1;
const MARKDOWN_PDF_CODEX_SIGNAL_MODE_VALUES = new Set<string>(MARKDOWN_PDF_CODEX_SIGNAL_MODES);

export interface MarkdownPdfCodexReportBaseProfile {
  candidateId: string;
  basedOn?: string;
  profileId?: string;
  path?: string;
  untracked: boolean;
}

export interface MarkdownPdfCodexReportFailure {
  kind:
    | "structured-output-schema"
    | "malformed-output"
    | "invalid-application"
    | "unavailable"
    | "no-usable-profile";
  message: string;
}

export interface MarkdownPdfCodexReportArtifact {
  artifact: {
    type: typeof MARKDOWN_PDF_CODEX_REPORT_ARTIFACT_TYPE;
    version: typeof MARKDOWN_PDF_CODEX_REPORT_ARTIFACT_VERSION;
    id: string;
    advisoryOnly: true;
    createdAt: string;
  };
  profile: {
    id: string;
    outputPath: string;
    identity: NormalizedMarkdownPdfProfileIdentity;
  };
  input: {
    path?: string;
    sha256?: string;
  };
  request: Pick<MarkdownPdfCodexProfileRequest, "intent" | "fontHints">;
  candidates: MarkdownPdfCodexProfileRequest["candidates"][number]["summary"][];
  selectedBase: MarkdownPdfCodexReportBaseProfile;
  documentSignals: MarkdownPdfCodexProfileRequest["documentSignals"];
  fontSignals: MarkdownPdfCodexProfileRequest["fontSignals"];
  signalMode: MarkdownPdfCodexProfileRequest["signalMode"];
  result: {
    status: "success" | "failed";
    decision?: MarkdownPdfCodexDecision;
    selectedPreset?: string;
    changedTopLevelFields: string[];
    acceptedFields?: Record<string, unknown>;
    unmatchedDirections: string[];
    fallbackReason?: string;
    warnings: string[];
    failure?: MarkdownPdfCodexReportFailure;
  };
}

export function fingerprintMarkdownPdfCodexInput(markdown: string): string {
  return createHash("sha256").update(markdown).digest("hex");
}

function changedTopLevelFields(
  baseProfile: Record<string, unknown> | undefined,
  profile: Record<string, unknown> | undefined,
): string[] {
  if (!baseProfile || !profile) {
    return [];
  }
  return MARKDOWN_PDF_PROFILE_ROOT_KEYS.filter((field) => field !== "profile")
    .filter((field) => Object.hasOwn(baseProfile, field) || Object.hasOwn(profile, field))
    .filter((field) => !isDeepStrictEqual(baseProfile[field], profile[field]))
    .sort();
}

function selectedBaseProfile(
  candidate: MarkdownPdfProfileCandidate | undefined,
  displayPath?: string,
): MarkdownPdfCodexReportBaseProfile {
  return {
    candidateId: candidate?.summary.id ?? "none",
    basedOn: candidate?.summary.basedOn,
    profileId: candidate?.identity?.id,
    path: displayPath,
    untracked: candidate?.summary.kind === "base-profile" && !candidate.identity,
  };
}

export function createMarkdownPdfCodexReportArtifact(input: {
  createdAt: string;
  displayInputPath?: string;
  displayProfileOutputPath: string;
  displayBaseProfilePath?: string;
  inputSha256?: string;
  profileIdentity: NormalizedMarkdownPdfProfileIdentity;
  request: MarkdownPdfCodexProfileRequest;
  selectedCandidate?: MarkdownPdfProfileCandidate;
  result?: MarkdownPdfCodexProfileResult;
  failure?: MarkdownPdfCodexReportFailure;
}): MarkdownPdfCodexReportArtifact {
  const status = input.failure ? "failed" : "success";
  const decision = input.result?.decision;

  return {
    artifact: {
      type: MARKDOWN_PDF_CODEX_REPORT_ARTIFACT_TYPE,
      version: MARKDOWN_PDF_CODEX_REPORT_ARTIFACT_VERSION,
      id: `${input.profileIdentity.id}-codex-report`,
      advisoryOnly: true,
      createdAt: input.createdAt,
    },
    profile: {
      id: input.profileIdentity.id,
      outputPath: input.displayProfileOutputPath,
      identity: input.profileIdentity,
    },
    input: {
      ...(input.displayInputPath ? { path: input.displayInputPath } : {}),
      ...(input.inputSha256 ? { sha256: input.inputSha256 } : {}),
    },
    request: {
      intent: input.request.intent,
      fontHints: input.request.fontHints,
    },
    candidates: input.request.candidates.map((candidate) => candidate.summary),
    selectedBase: selectedBaseProfile(input.selectedCandidate, input.displayBaseProfilePath),
    documentSignals: input.request.documentSignals,
    fontSignals: input.request.fontSignals,
    signalMode: input.request.signalMode,
    result: {
      status,
      decision,
      selectedPreset: input.selectedCandidate?.summary.preset,
      changedTopLevelFields: changedTopLevelFields(
        input.selectedCandidate?.fullProfile,
        input.result?.profile,
      ),
      acceptedFields: decision?.acceptedFields,
      unmatchedDirections: decision?.unmatchedDirections ?? [],
      fallbackReason: decision?.fallbackReason,
      warnings: decision?.warnings ?? [],
      failure: input.failure,
    },
  };
}

function validateReportArtifact(value: unknown): MarkdownPdfCodexReportArtifact {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Markdown PDF Codex report must be an object.");
  }
  const artifact = value as MarkdownPdfCodexReportArtifact;
  if (artifact.artifact?.type !== MARKDOWN_PDF_CODEX_REPORT_ARTIFACT_TYPE) {
    throw new Error("Invalid Markdown PDF Codex report artifact type.");
  }
  if (artifact.artifact.version !== MARKDOWN_PDF_CODEX_REPORT_ARTIFACT_VERSION) {
    throw new Error("Unsupported Markdown PDF Codex report artifact version.");
  }
  if (artifact.artifact.advisoryOnly !== true) {
    throw new Error("Markdown PDF Codex report must be advisory-only.");
  }
  if (!artifact.profile?.id || artifact.profile.id !== artifact.profile.identity?.id) {
    throw new Error("Markdown PDF Codex report profile identity mismatch.");
  }
  if (!MARKDOWN_PDF_CODEX_SIGNAL_MODE_VALUES.has(artifact.signalMode)) {
    throw new Error("Markdown PDF Codex report signal mode is invalid.");
  }
  if (artifact.result?.status !== "success" && artifact.result?.status !== "failed") {
    throw new Error("Markdown PDF Codex report result status is invalid.");
  }
  return artifact;
}

export async function writeMarkdownPdfCodexReportArtifact(
  path: string,
  artifact: MarkdownPdfCodexReportArtifact,
  options: { overwrite?: boolean } = {},
): Promise<void> {
  await writeTextFileSafe(path, `${JSON.stringify(artifact, null, 2)}\n`, options);
}

export async function readMarkdownPdfCodexReportArtifact(
  path: string,
): Promise<MarkdownPdfCodexReportArtifact> {
  return validateReportArtifact(JSON.parse(await readTextFileRequired(path)));
}
