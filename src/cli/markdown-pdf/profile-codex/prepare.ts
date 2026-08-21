import { randomUUID } from "node:crypto";
import { stat } from "node:fs/promises";
import { join, parse, resolve } from "node:path";

import {
  classifyMarkdownPdfCodexProfileFailure,
  MARKDOWN_PDF_CODEX_PROFILE_TIMEOUT_MS,
  type MarkdownPdfCodexProfileResult,
} from "../../../adapters/codex/markdown-pdf-profile";
import {
  classifyCodexRequestFailure,
  formatCodexTimeoutFailure,
} from "../../../utils/codex-request-failure";
import type { MarkdownPdfCodexSignalMode } from "../../../adapters/codex/markdown-pdf-profile/types";
import { formatUtcFileDateTimeISO } from "../../../utils/datetime";
import { assertNonEmpty, printLine } from "../../actions/shared";
import type { MarkdownPdfCodexReportFailure } from "../../markdown-pdf/codex-report";
import {
  createMarkdownPdfCodexReportArtifact,
  fingerprintMarkdownPdfCodexInput,
} from "../../markdown-pdf/codex-report";
import type { MarkdownPdfProfileCandidate } from "../../markdown-pdf/profile/candidates";
import { loadMarkdownPdfBaseProfileCandidate } from "../../markdown-pdf/profile/candidates";
import type { NormalizedMarkdownPdfProfileIdentity } from "../../markdown-pdf/profile";
import {
  collectMarkdownPdfDocumentSignals,
  createAbsentMarkdownPdfDocumentSignals,
} from "../../markdown-pdf/profile/signals";
import { CliError } from "../../errors";
import { readTextFileRequired } from "../../file-io";
import { resolveFromCwd } from "../../path-utils";
import type { CliRuntime } from "../../types";
import { publicPathBasename, publicPathDisplay } from "../codex-path-display";
import {
  bindMarkdownPdfProfileCodexDestination,
  type MarkdownPdfProfileCodexDestinationOptions,
  type MarkdownPdfProfileCodexDestinationSource,
} from "./destination";
import {
  createMarkdownPdfCodexProfileOrchestrationContext,
  runMarkdownPdfCodexProfileOrchestration,
} from "./orchestration";
import { createMarkdownPdfCodexProfileIdentity } from "./profile-identity";
import { classifyMarkdownPdfProfileCodexSignalMode } from "./signal-mode";
import type { MdPdfProfileCodexOptions } from "./types";

export type MarkdownPdfProfileCodexReportPayload = Omit<
  Parameters<typeof createMarkdownPdfCodexReportArtifact>[0],
  "displayProfileOutputPath"
>;

interface PreparedMarkdownPdfProfileCodexBase extends MarkdownPdfProfileCodexDestinationSource {
  createdAt: string;
  identity: NormalizedMarkdownPdfProfileIdentity;
  reportPayload: MarkdownPdfProfileCodexReportPayload;
}

export interface PreparedMarkdownPdfProfileCodexSuccess extends PreparedMarkdownPdfProfileCodexBase {
  decisionMode: string;
  finalProfile: Record<string, unknown>;
  kind: "profile";
  result?: MarkdownPdfCodexProfileResult;
  selectedCandidate: MarkdownPdfProfileCandidate;
  signalMode?: MarkdownPdfCodexSignalMode;
}

export interface PreparedMarkdownPdfProfileCodexNoUsable extends PreparedMarkdownPdfProfileCodexBase {
  failure: MarkdownPdfCodexReportFailure;
  failureMessage: string;
  kind: "no-usable-profile";
}

export interface PreparedMarkdownPdfProfileCodexFailure extends PreparedMarkdownPdfProfileCodexBase {
  failure: MarkdownPdfCodexReportFailure;
  failureMessage: string;
  kind: "failed";
}

export type PreparedMarkdownPdfProfileCodex =
  | PreparedMarkdownPdfProfileCodexSuccess
  | PreparedMarkdownPdfProfileCodexNoUsable
  | PreparedMarkdownPdfProfileCodexFailure;

function strictUtcIso(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}

function createProfileUid(now: Date, profileUidFactory?: (now: Date) => string): string {
  if (profileUidFactory) {
    return profileUidFactory(now);
  }
  return `md-pdf-profile-${formatUtcFileDateTimeISO(now)}-${randomUUID().slice(0, 8)}`;
}

function generatedProfilePath(inputPath: string, profileId: string): string {
  const parsed = parse(inputPath);
  return join(parsed.dir, `${parsed.name}-${profileId}.yml`);
}

function generatedProfilePathWithoutInput(runtime: CliRuntime, profileId: string): string {
  return join(runtime.cwd, `${profileId}.yml`);
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function resolveProfileIdentityAndSuggestedOutput(input: {
  inputPath?: string;
  now: Date;
  options: MdPdfProfileCodexOptions;
  runtime: CliRuntime;
}): Promise<{ profileId: string; suggestedOutputPath: string }> {
  if (input.options.output) {
    return {
      profileId: createProfileUid(input.now, input.options.profileUidFactory),
      suggestedOutputPath: resolveFromCwd(
        input.runtime,
        assertNonEmpty(input.options.output, "Output path"),
      ),
    };
  }
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const profileId = createProfileUid(input.now, input.options.profileUidFactory);
    const suggestedOutputPath = input.inputPath
      ? generatedProfilePath(input.inputPath, profileId)
      : generatedProfilePathWithoutInput(input.runtime, profileId);
    if (!(await pathExists(suggestedOutputPath))) {
      return { profileId, suggestedOutputPath };
    }
  }
  throw new CliError("Unable to generate a non-colliding Markdown PDF profile path.", {
    code: "OUTPUT_EXISTS",
    exitCode: 2,
  });
}

function normalizeOptionalText(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

function normalizeFontHints(values: string[] | undefined): string[] {
  return (values ?? []).map((value) => value.trim()).filter((value) => value.length > 0);
}

function resolveOptionalInputPath(
  runtime: CliRuntime,
  options: MdPdfProfileCodexOptions,
): string | undefined {
  const optionInput = normalizeOptionalText(options.input);
  const positionalInput = normalizeOptionalText(options.positionalInput);
  const resolvedOptionInput = optionInput ? resolveFromCwd(runtime, optionInput) : undefined;
  const resolvedPositionalInput = positionalInput
    ? resolveFromCwd(runtime, positionalInput)
    : undefined;
  if (
    resolvedOptionInput &&
    resolvedPositionalInput &&
    resolve(resolvedOptionInput) !== resolve(resolvedPositionalInput)
  ) {
    throw new CliError("Positional input and --input must refer to the same Markdown file.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }
  return resolvedOptionInput ?? resolvedPositionalInput;
}

function persistedReportPath(runtime: CliRuntime, path: string): string {
  return publicPathDisplay(runtime, path)?.display ?? publicPathBasename(path);
}

function codexFailureMessage(kind: string): string {
  if (kind === "structured-output-schema") {
    return "Codex Markdown PDF profile helper failed while preparing structured output.";
  }
  if (kind === "malformed-output") {
    return "Codex Markdown PDF profile helper returned invalid structured output.";
  }
  if (kind === "invalid-application") {
    return "Codex Markdown PDF profile helper returned a decision that could not be applied.";
  }
  return "Codex Markdown PDF profile helper is unavailable.";
}

export async function prepareMarkdownPdfProfileCodex(
  runtime: CliRuntime,
  options: MdPdfProfileCodexOptions,
): Promise<PreparedMarkdownPdfProfileCodex> {
  const inputPath = resolveOptionalInputPath(runtime, options);
  const baseProfilePath = options.baseProfile
    ? resolveFromCwd(runtime, assertNonEmpty(options.baseProfile, "Base profile path"))
    : undefined;
  const intent = normalizeOptionalText(options.intent);
  const markdown = inputPath ? await readTextFileRequired(inputPath) : undefined;
  const fontHints = normalizeFontHints(options.fontHint);
  const now = runtime.now();
  const createdAt = strictUtcIso(now);
  const { profileId, suggestedOutputPath } = await resolveProfileIdentityAndSuggestedOutput({
    inputPath,
    now,
    options,
    runtime,
  });
  const destinationOptions: MarkdownPdfProfileCodexDestinationOptions = {
    codexReportOutput: options.codexReportOutput,
    dryRun: options.dryRun,
    keepCodexReport: options.keepCodexReport,
    output: options.output,
    overwrite: options.overwrite,
  };
  const destinationSource: MarkdownPdfProfileCodexDestinationSource = {
    baseProfilePath,
    destinationOptions,
    inputPath,
    profileId,
    suggestedOutputPath,
  };

  // Keep direct-command validation ahead of orchestration while allowing the
  // returned candidate to be rebound later without repeating Codex work.
  await bindMarkdownPdfProfileCodexDestination(runtime, destinationSource);

  printLine(runtime.stderr, "Collecting Markdown PDF profile signals...");
  const baseProfileCandidate = baseProfilePath
    ? await loadMarkdownPdfBaseProfileCandidate({ cwd: runtime.cwd, path: baseProfilePath })
    : undefined;
  const signalMode = classifyMarkdownPdfProfileCodexSignalMode({
    hasBaseProfile: Boolean(baseProfileCandidate),
    hasFontHints: fontHints.length > 0,
    hasInput: Boolean(inputPath),
    hasIntent: Boolean(intent),
  });
  const orchestrationContext = createMarkdownPdfCodexProfileOrchestrationContext({
    baseProfileCandidate,
    createdAt,
    documentSignals: markdown
      ? collectMarkdownPdfDocumentSignals(markdown)
      : createAbsentMarkdownPdfDocumentSignals(),
    fontHints,
    intent,
    profileId,
    signalMode,
    workingDirectory: runtime.cwd,
  });
  const reportBase: Omit<
    MarkdownPdfProfileCodexReportPayload,
    "failure" | "profileIdentity" | "result" | "selectedCandidate"
  > = {
    createdAt,
    displayBaseProfilePath: baseProfileCandidate?.path
      ? persistedReportPath(runtime, baseProfileCandidate.path)
      : undefined,
    displayInputPath: inputPath ? persistedReportPath(runtime, inputPath) : undefined,
    inputSha256: markdown ? fingerprintMarkdownPdfCodexInput(markdown) : undefined,
    request: orchestrationContext.request,
  };
  const identityBase = { createdAt, profileId };

  try {
    const decision = await runMarkdownPdfCodexProfileOrchestration({
      context: orchestrationContext,
      profileCodexRunner: options.codexRunner,
      progressPresenter: options.codexProgressPresenter,
      progressLabel: "Requesting Codex Markdown PDF profile recommendation",
      runtime,
      timeoutMs: options.timeoutMs,
    });
    if (decision.kind === "no-usable-profile") {
      const failure: MarkdownPdfCodexReportFailure = {
        kind: "no-usable-profile",
        message: decision.failureMessage,
      };
      return {
        ...destinationSource,
        createdAt,
        failure,
        failureMessage: decision.failureMessage,
        identity: decision.identity,
        kind: "no-usable-profile",
        reportPayload: {
          ...reportBase,
          failure,
          profileIdentity: decision.identity,
          selectedCandidate: decision.selectedCandidate,
        },
      };
    }
    return {
      ...destinationSource,
      createdAt,
      decisionMode: decision.decisionMode,
      finalProfile: decision.finalProfile,
      identity: decision.identity,
      kind: "profile",
      reportPayload: {
        ...reportBase,
        profileIdentity: decision.identity,
        result: decision.kind === "codex-profile" ? decision.codexResult : undefined,
        selectedCandidate: decision.selectedCandidate,
      },
      result: decision.kind === "codex-profile" ? decision.codexResult : undefined,
      selectedCandidate: decision.selectedCandidate,
      signalMode: decision.kind === "deterministic" ? signalMode : undefined,
    };
  } catch (error) {
    const failureKind = classifyMarkdownPdfCodexProfileFailure(error);
    if (failureKind === "unavailable" && error instanceof CliError) {
      throw error;
    }
    const failure: MarkdownPdfCodexReportFailure = {
      kind: failureKind,
      message: error instanceof Error ? error.message : String(error),
    };
    const identity = createMarkdownPdfCodexProfileIdentity({
      ...identityBase,
      basedOn: "none",
      source: "codex",
    });
    return {
      ...destinationSource,
      createdAt,
      failure,
      failureMessage:
        classifyCodexRequestFailure(error) === "timeout"
          ? formatCodexTimeoutFailure({
              attemptsUsed: 1,
              requestLabel: "Codex Markdown PDF profile request",
              timeoutMs: options.timeoutMs ?? MARKDOWN_PDF_CODEX_PROFILE_TIMEOUT_MS,
            })
          : `${codexFailureMessage(failureKind)} ${failure.message}`,
      identity,
      kind: "failed",
      reportPayload: { ...reportBase, failure, profileIdentity: identity },
    };
  }
}
