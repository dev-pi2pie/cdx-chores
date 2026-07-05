import { randomUUID } from "node:crypto";
import { stat } from "node:fs/promises";
import { extname, join, parse, relative, resolve } from "node:path";

import { classifyMarkdownPdfCodexProfileFailure } from "../../../adapters/codex/markdown-pdf-profile";
import type { MarkdownPdfCodexSignalMode } from "../../../adapters/codex/markdown-pdf-profile/types";
import { CliError } from "../../errors";
import { readTextFileRequired, writeTextFileSafe } from "../../file-io";
import {
  loadMarkdownPdfBaseProfileCandidate,
  type MarkdownPdfProfileCandidate,
} from "../../markdown-pdf/profile/candidates";
import {
  collectMarkdownPdfDocumentSignals,
  createAbsentMarkdownPdfDocumentSignals,
} from "../../markdown-pdf/profile/signals";
import {
  createMarkdownPdfCodexReportArtifact,
  fingerprintMarkdownPdfCodexInput,
  writeMarkdownPdfCodexReportArtifact,
  type MarkdownPdfCodexReportFailure,
} from "../../markdown-pdf/codex-report";
import { inferMarkdownPdfProfileFormat } from "../../markdown-pdf";
import type { NormalizedMarkdownPdfProfileIdentity } from "../../markdown-pdf/profile";
import { resolveFromCwd } from "../../path-utils";
import type { CliRuntime } from "../../types";
import { formatUtcFileDateTimeISO } from "../../../utils/datetime";
import { assertWritableCodexPlannedFile } from "../codex-output-path-policy";
import { assertNonEmpty, displayPath, printLine } from "../../actions/shared";
import type { MarkdownPdfCodexProfileResult } from "../../../adapters/codex/markdown-pdf-profile/types";
import { classifyMarkdownPdfProfileCodexSignalMode } from "./signal-mode";
import {
  createMarkdownPdfCodexProfileOrchestrationContext,
  runMarkdownPdfCodexProfileOrchestration,
} from "./orchestration";
import { createMarkdownPdfCodexProfileIdentity } from "./profile-identity";
import type { MdPdfProfileCodexOptions } from "./types";
import { serializeMarkdownPdfProfileCodexProfile } from "./write-profile";

type MarkdownPdfCodexReportBaseInput = {
  createdAt: string;
  displayBaseProfilePath?: string;
  displayInputPath?: string;
  displayProfileOutputPath: string;
  inputSha256?: string;
  request: Parameters<typeof createMarkdownPdfCodexReportArtifact>[0]["request"];
};

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

function generatedReportPath(profileOutputPath: string, profileId: string): string {
  const parsed = parse(profileOutputPath);
  const stem = parsed.name.includes(profileId) ? parsed.name : `${parsed.name}-${profileId}`;
  return join(parsed.dir, `${stem}-codex-report.json`);
}

function samePath(left: string | undefined, right: string | undefined): boolean {
  return Boolean(left && right && resolve(left) === resolve(right));
}

async function existingPathIdentity(
  path: string | undefined,
): Promise<{ dev: number; ino: number } | undefined> {
  if (!path) {
    return undefined;
  }
  try {
    const stats = await stat(path);
    return { dev: stats.dev, ino: stats.ino };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return undefined;
    }
    throw error;
  }
}

function samePathIdentity(
  left: { dev: number; ino: number } | undefined,
  right: { dev: number; ino: number } | undefined,
): boolean {
  return Boolean(left && right && left.dev === right.dev && left.ino === right.ino);
}

function assertDifferentPaths(input: {
  left: string | undefined;
  leftLabel: string;
  right: string | undefined;
  rightLabel: string;
}): void {
  if (!samePath(input.left, input.right)) {
    return;
  }
  throw new CliError(`${input.leftLabel} cannot be the same path as ${input.rightLabel}.`, {
    code: "INVALID_INPUT",
    exitCode: 2,
  });
}

async function assertDifferentExistingFiles(input: {
  left: string | undefined;
  leftLabel: string;
  right: string | undefined;
  rightLabel: string;
}): Promise<void> {
  const [leftIdentity, rightIdentity] = await Promise.all([
    existingPathIdentity(input.left),
    existingPathIdentity(input.right),
  ]);
  if (!samePathIdentity(leftIdentity, rightIdentity)) {
    return;
  }
  throw new CliError(`${input.leftLabel} cannot be the same file as ${input.rightLabel}.`, {
    code: "INVALID_INPUT",
    exitCode: 2,
  });
}

async function assertDistinctExistingFilePairs(
  pairs: Array<{
    left: string | undefined;
    leftLabel: string;
    right: string | undefined;
    rightLabel: string;
  }>,
): Promise<void> {
  for (const pair of pairs) {
    await assertDifferentExistingFiles(pair);
  }
}

function reportRequested(options: MdPdfProfileCodexOptions): boolean {
  return Boolean(options.keepCodexReport || options.codexReportOutput);
}

function normalizeFontHints(values: string[] | undefined): string[] {
  return (values ?? []).map((value) => value.trim()).filter((value) => value.length > 0);
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function resolveGeneratedProfileOutputPath(
  runtime: CliRuntime,
  inputPath: string | undefined,
  now: Date,
  profileUidFactory?: (now: Date) => string,
): Promise<{ profileId: string; outputPath: string }> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const profileId = createProfileUid(now, profileUidFactory);
    const outputPath = inputPath
      ? generatedProfilePath(inputPath, profileId)
      : generatedProfilePathWithoutInput(runtime, profileId);
    if (!(await pathExists(outputPath))) {
      return { profileId, outputPath };
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
    !samePath(resolvedOptionInput, resolvedPositionalInput)
  ) {
    throw new CliError("Positional input and --input must refer to the same Markdown file.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }
  return resolvedOptionInput ?? resolvedPositionalInput;
}

function persistedReportPath(runtime: CliRuntime, path: string): string {
  const value = relative(runtime.cwd, path);
  return value.length > 0 ? value : ".";
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

function isNoUsableProfileError(error: unknown): boolean {
  return error instanceof CliError && error.code === "MARKDOWN_PDF_CODEX_NO_USABLE_PROFILE";
}

async function writeFailureReportIfRequested(input: {
  failure: MarkdownPdfCodexReportFailure;
  overwrite?: boolean;
  parentRootDirectory: string;
  profileIdentity: NormalizedMarkdownPdfProfileIdentity;
  reportBase: MarkdownPdfCodexReportBaseInput;
  reportOutputPath?: string;
  runtime: CliRuntime;
}): Promise<void> {
  if (!input.reportOutputPath) {
    return;
  }
  await writeMarkdownPdfCodexReportArtifact(
    input.reportOutputPath,
    createMarkdownPdfCodexReportArtifact({
      ...input.reportBase,
      failure: input.failure,
      profileIdentity: input.profileIdentity,
    }),
    { overwrite: input.overwrite, parentRootDirectory: input.parentRootDirectory },
  );
  printLine(
    input.runtime.stderr,
    `Wrote Codex report: ${displayPath(input.runtime, input.reportOutputPath)}`,
  );
}

async function finalizeSuccessfulProfileDecision(input: {
  decisionLabel: string;
  displayOutputPath: string;
  dryRun?: boolean;
  finalProfile: Record<string, unknown>;
  identity: NormalizedMarkdownPdfProfileIdentity;
  outputPath: string;
  overwrite?: boolean;
  profileParentRootDirectory: string;
  reportParentRootDirectory: string;
  reportBase: MarkdownPdfCodexReportBaseInput;
  reportOutputPath?: string;
  result?: MarkdownPdfCodexProfileResult;
  runtime: CliRuntime;
  selectedCandidate: MarkdownPdfProfileCandidate;
  signalMode?: MarkdownPdfCodexSignalMode;
}): Promise<void> {
  const serialized = serializeMarkdownPdfProfileCodexProfile({
    finalProfile: input.finalProfile,
    outputPath: input.outputPath,
  });

  if (input.signalMode) {
    printLine(input.runtime.stdout, `Signal mode: ${input.signalMode}`);
  }
  printLine(input.runtime.stdout, `Decision: ${input.decisionLabel}`);
  printLine(input.runtime.stdout, `Based on: ${input.identity.basedOn ?? "none"}`);
  if (input.identity.preset) {
    printLine(input.runtime.stdout, `Preset: ${input.identity.preset}`);
  }
  if (input.result?.decision.fallbackReason) {
    printLine(input.runtime.stdout, `Fallback reason: ${input.result.decision.fallbackReason}`);
  }
  printLine(input.runtime.stdout, `Profile: ${input.displayOutputPath}`);

  if (input.dryRun) {
    printLine(input.runtime.stdout, "Dry run only. No profile was written.");
  } else {
    await writeTextFileSafe(input.outputPath, serialized, {
      overwrite: input.overwrite,
      parentRootDirectory: input.profileParentRootDirectory,
    });
    printLine(input.runtime.stderr, `Wrote Markdown PDF profile: ${input.displayOutputPath}`);
  }

  if (input.reportOutputPath) {
    await writeMarkdownPdfCodexReportArtifact(
      input.reportOutputPath,
      createMarkdownPdfCodexReportArtifact({
        ...input.reportBase,
        profileIdentity: input.identity,
        result: input.result,
        selectedCandidate: input.selectedCandidate,
      }),
      { overwrite: input.overwrite, parentRootDirectory: input.reportParentRootDirectory },
    );
    printLine(
      input.runtime.stderr,
      `Wrote Codex report: ${displayPath(input.runtime, input.reportOutputPath)}`,
    );
  }
}

export async function actionMdPdfProfileCodex(
  runtime: CliRuntime,
  options: MdPdfProfileCodexOptions,
): Promise<void> {
  const inputPath = resolveOptionalInputPath(runtime, options);
  const baseProfilePath = options.baseProfile
    ? resolveFromCwd(runtime, assertNonEmpty(options.baseProfile, "Base profile path"))
    : undefined;
  const intent = normalizeOptionalText(options.intent);
  const markdown = inputPath ? await readTextFileRequired(inputPath) : undefined;
  const fontHints = normalizeFontHints(options.fontHint);
  const now = runtime.now();
  const createdAt = strictUtcIso(now);
  const outputResolution = options.output
    ? {
        profileId: createProfileUid(now, options.profileUidFactory),
        outputPath: resolveFromCwd(runtime, assertNonEmpty(options.output, "Output path")),
      }
    : await resolveGeneratedProfileOutputPath(runtime, inputPath, now, options.profileUidFactory);
  const reportOutputPath = options.codexReportOutput
    ? resolveFromCwd(runtime, options.codexReportOutput)
    : reportRequested(options)
      ? generatedReportPath(outputResolution.outputPath, outputResolution.profileId)
      : undefined;

  inferMarkdownPdfProfileFormat(outputResolution.outputPath);
  if (reportOutputPath && extname(reportOutputPath).toLowerCase() !== ".json") {
    throw new CliError("Markdown PDF Codex report path must end with .json.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }
  const pathCollisionPairs = [
    {
      left: reportOutputPath,
      leftLabel: "--codex-report-output",
      right: outputResolution.outputPath,
      rightLabel: "--output",
    },
    {
      left: outputResolution.outputPath,
      leftLabel: "--output",
      right: inputPath,
      rightLabel: "Markdown input",
    },
    {
      left: reportOutputPath,
      leftLabel: "--codex-report-output",
      right: inputPath,
      rightLabel: "Markdown input",
    },
    {
      left: outputResolution.outputPath,
      leftLabel: "--output",
      right: baseProfilePath,
      rightLabel: "--base-profile",
    },
    {
      left: reportOutputPath,
      leftLabel: "--codex-report-output",
      right: baseProfilePath,
      rightLabel: "--base-profile",
    },
    {
      left: inputPath,
      leftLabel: "Markdown input",
      right: baseProfilePath,
      rightLabel: "--base-profile",
    },
  ];
  for (const pair of pathCollisionPairs) {
    assertDifferentPaths(pair);
  }
  if (!options.dryRun) {
    await assertWritableCodexPlannedFile(
      { path: outputResolution.outputPath },
      { label: "--output", overwrite: options.overwrite, parentRootDirectory: runtime.cwd },
    );
  }
  if (reportOutputPath) {
    await assertWritableCodexPlannedFile(
      { path: reportOutputPath },
      {
        label: "--codex-report-output",
        overwrite: options.overwrite,
        parentRootDirectory: runtime.cwd,
      },
    );
  }
  await assertDistinctExistingFilePairs(pathCollisionPairs);

  printLine(runtime.stderr, "Collecting Markdown PDF profile signals...");
  const baseProfileCandidate = baseProfilePath
    ? await loadMarkdownPdfBaseProfileCandidate({
        cwd: runtime.cwd,
        path: baseProfilePath,
      })
    : undefined;
  const signalMode = classifyMarkdownPdfProfileCodexSignalMode({
    hasBaseProfile: Boolean(baseProfileCandidate),
    hasFontHints: fontHints.length > 0,
    hasInput: Boolean(inputPath),
    hasIntent: Boolean(intent),
  });
  const documentSignals = markdown
    ? collectMarkdownPdfDocumentSignals(markdown)
    : createAbsentMarkdownPdfDocumentSignals();
  const orchestrationContext = createMarkdownPdfCodexProfileOrchestrationContext({
    baseProfileCandidate,
    createdAt,
    documentSignals,
    fontHints,
    intent,
    profileId: outputResolution.profileId,
    signalMode,
    workingDirectory: runtime.cwd,
  });

  const displayOutputPath = displayPath(runtime, outputResolution.outputPath);
  const reportInputPath = inputPath ? persistedReportPath(runtime, inputPath) : undefined;
  const reportOutputProfilePath = persistedReportPath(runtime, outputResolution.outputPath);
  const reportBaseProfilePath = baseProfileCandidate?.path
    ? persistedReportPath(runtime, baseProfileCandidate.path)
    : undefined;
  const profileIdentityBase = {
    createdAt,
    profileId: outputResolution.profileId,
  };
  const reportBase = {
    createdAt,
    displayBaseProfilePath: reportBaseProfilePath,
    displayInputPath: reportInputPath,
    displayProfileOutputPath: reportOutputProfilePath,
    inputSha256: markdown ? fingerprintMarkdownPdfCodexInput(markdown) : undefined,
    request: orchestrationContext.request,
  };

  try {
    const decision = await runMarkdownPdfCodexProfileOrchestration({
      context: orchestrationContext,
      profileCodexRunner: options.codexRunner,
      progressLabel: "Requesting Codex Markdown PDF profile recommendation",
      runtime,
    });
    if (decision.kind === "no-usable-profile") {
      const failure: MarkdownPdfCodexReportFailure = {
        kind: "no-usable-profile",
        message: decision.failureMessage,
      };
      if (reportOutputPath) {
        await writeMarkdownPdfCodexReportArtifact(
          reportOutputPath,
          createMarkdownPdfCodexReportArtifact({
            ...reportBase,
            failure,
            profileIdentity: decision.identity,
            selectedCandidate: decision.selectedCandidate,
          }),
          { overwrite: options.overwrite, parentRootDirectory: runtime.cwd },
        );
        printLine(runtime.stderr, `Wrote Codex report: ${displayPath(runtime, reportOutputPath)}`);
      }
      throw new CliError(decision.failureMessage, {
        code: "MARKDOWN_PDF_CODEX_NO_USABLE_PROFILE",
        exitCode: 1,
      });
    }

    await finalizeSuccessfulProfileDecision({
      decisionLabel: decision.decisionMode,
      displayOutputPath,
      dryRun: options.dryRun,
      finalProfile: decision.finalProfile,
      identity: decision.identity,
      outputPath: outputResolution.outputPath,
      overwrite: options.overwrite,
      profileParentRootDirectory: runtime.cwd,
      reportParentRootDirectory: runtime.cwd,
      reportBase,
      reportOutputPath,
      result: decision.kind === "codex-profile" ? decision.codexResult : undefined,
      runtime,
      selectedCandidate: decision.selectedCandidate,
      signalMode: decision.kind === "deterministic" ? signalMode : undefined,
    });
  } catch (error) {
    if (isNoUsableProfileError(error)) {
      throw error;
    }
    const failureKind = classifyMarkdownPdfCodexProfileFailure(error);
    if (failureKind === "unavailable" && error instanceof CliError) {
      throw error;
    }
    if (failureKind === "unavailable") {
      const failure: MarkdownPdfCodexReportFailure = {
        kind: "unavailable",
        message: error instanceof Error ? error.message : String(error),
      };
      await writeFailureReportIfRequested({
        failure,
        overwrite: options.overwrite,
        parentRootDirectory: runtime.cwd,
        profileIdentity: createMarkdownPdfCodexProfileIdentity({
          ...profileIdentityBase,
          basedOn: "none",
          source: "codex",
        }),
        reportBase,
        reportOutputPath,
        runtime,
      });
      throw new CliError(`${codexFailureMessage(failureKind)} ${failure.message}`, {
        code: "MARKDOWN_PDF_CODEX_FAILED",
        exitCode: 1,
      });
    }
    const failure: MarkdownPdfCodexReportFailure = {
      kind: failureKind,
      message: error instanceof Error ? error.message : String(error),
    };
    await writeFailureReportIfRequested({
      failure,
      overwrite: options.overwrite,
      parentRootDirectory: runtime.cwd,
      profileIdentity: createMarkdownPdfCodexProfileIdentity({
        ...profileIdentityBase,
        basedOn: "none",
        source: "codex",
      }),
      reportBase,
      reportOutputPath,
      runtime,
    });
    throw new CliError(`${codexFailureMessage(failureKind)} ${failure.message}`, {
      code: "MARKDOWN_PDF_CODEX_FAILED",
      exitCode: 1,
    });
  }
}
