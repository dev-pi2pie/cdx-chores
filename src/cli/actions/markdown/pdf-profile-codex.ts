import { randomUUID } from "node:crypto";
import { lstat, stat } from "node:fs/promises";
import { extname, join, parse, relative, resolve } from "node:path";

import {
  classifyMarkdownPdfCodexProfileFailure,
  MarkdownPdfCodexProfileError,
  suggestMarkdownPdfProfileWithCodex,
  type MarkdownPdfCodexProfileRunner,
} from "../../../adapters/codex/markdown-pdf-profile";
import type { MarkdownPdfCodexSignalMode } from "../../../adapters/codex/markdown-pdf-profile/types";
import { CliError } from "../../errors";
import { readTextFileRequired, writeTextFileSafe } from "../../file-io";
import {
  createMarkdownPdfProfileCandidates,
  loadMarkdownPdfBaseProfileCandidate,
  type MarkdownPdfProfileCandidate,
} from "../../markdown-pdf/profile/candidates";
import {
  collectMarkdownPdfDocumentSignals,
  collectMarkdownPdfFontSignals,
  createAbsentMarkdownPdfDocumentSignals,
} from "../../markdown-pdf/profile/signals";
import {
  createMarkdownPdfCodexReportArtifact,
  fingerprintMarkdownPdfCodexInput,
  writeMarkdownPdfCodexReportArtifact,
  type MarkdownPdfCodexReportFailure,
} from "../../markdown-pdf/codex-report";
import {
  inferMarkdownPdfProfileFormat,
  MARKDOWN_PDF_PROFILE_ROOT_KEYS,
  normalizeMarkdownPdfProfile,
  serializeMarkdownPdfProfile,
  validateMarkdownPdfProfileShape,
  type NormalizedMarkdownPdfProfileIdentity,
  type MarkdownPdfProfileSource,
} from "../../markdown-pdf";
import { resolveFromCwd } from "../../path-utils";
import type { CliRuntime } from "../../types";
import { formatUtcFileDateTimeISO } from "../../../utils/datetime";
import { assertNonEmpty, displayPath, printLine } from "../shared";

export interface MdPdfProfileCodexOptions {
  input?: string;
  positionalInput?: string;
  intent?: string;
  fontHint?: string[];
  baseProfile?: string;
  output?: string;
  dryRun?: boolean;
  keepCodexReport?: boolean;
  codexReportOutput?: string;
  overwrite?: boolean;
  codexRunner?: MarkdownPdfCodexProfileRunner;
}

export type MdPdfProfileCodexCliOptions = Omit<MdPdfProfileCodexOptions, "codexRunner">;

const SUPPORTED_SCHEMA_SUMMARY = MARKDOWN_PDF_PROFILE_ROOT_KEYS.filter(
  (key) => key !== "profile",
).flatMap((key) => {
  if (key === "page") {
    return ["page.size", "page.orientation", "page margins"];
  }
  if (key === "toc") {
    return ["toc.enabled", "toc.depth", "toc.pageBreak"];
  }
  if (key === "fonts") {
    return ["fonts.body", "fonts.heading", "fonts.code", "fonts.pageChrome"];
  }
  return [key];
});

function strictUtcIso(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}

function createProfileUid(now: Date): string {
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

function reportRequested(options: MdPdfProfileCodexOptions): boolean {
  return Boolean(options.keepCodexReport || options.codexReportOutput);
}

function normalizeFontHints(values: string[] | undefined): string[] {
  return (values ?? []).map((value) => value.trim()).filter((value) => value.length > 0);
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
  throw new MarkdownPdfCodexProfileError(
    `Markdown PDF Codex response selected unknown candidate: ${selectedCandidateId}.`,
    "invalid-application",
  );
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function assertWritableOutputPath(
  path: string,
  options: { overwrite?: boolean },
): Promise<void> {
  try {
    const outputStats = await lstat(path);
    if (outputStats.isSymbolicLink()) {
      throw new CliError(`Output path is a symlink and cannot be written safely: ${path}`, {
        code: "OUTPUT_SYMLINK",
        exitCode: 2,
      });
    }
    if (!options.overwrite) {
      throw new CliError(`Output file already exists: ${path}. Use --overwrite to replace it.`, {
        code: "OUTPUT_EXISTS",
        exitCode: 2,
      });
    }
  } catch (error) {
    if (error instanceof CliError) {
      throw error;
    }
  }
}

async function resolveGeneratedProfileOutputPath(
  runtime: CliRuntime,
  inputPath: string | undefined,
  now: Date,
): Promise<{ profileId: string; outputPath: string }> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const profileId = createProfileUid(now);
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

function createProfileIdentity(input: {
  basedOn: string;
  createdAt: string;
  profileId: string;
  selectedCandidate?: MarkdownPdfProfileCandidate;
  source?: MarkdownPdfProfileSource;
}): NormalizedMarkdownPdfProfileIdentity {
  const basedOn =
    input.selectedCandidate?.summary.basedOn ??
    input.selectedCandidate?.summary.id ??
    input.basedOn;
  return {
    id: input.profileId,
    source: input.source ?? "codex",
    basedOn,
    preset: input.selectedCandidate?.summary.preset,
    createdAt: input.createdAt,
  };
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

function classifySignalMode(input: {
  hasBaseProfile: boolean;
  hasFontHints: boolean;
  hasInput: boolean;
  hasIntent: boolean;
}): MarkdownPdfCodexSignalMode {
  const hasTargetSignal = input.hasInput || input.hasIntent || input.hasFontHints;
  if (hasTargetSignal && input.hasBaseProfile) {
    return "mixed-with-base";
  }
  if (input.hasInput) {
    return "document-informed";
  }
  if (input.hasIntent || input.hasFontHints) {
    return "hint-only";
  }
  if (input.hasBaseProfile) {
    return "base-only-deterministic";
  }
  return "basic-default";
}

function persistedReportPath(runtime: CliRuntime, path: string): string {
  const value = relative(runtime.cwd, path);
  return value.length > 0 ? value : ".";
}

function profileWithIdentity(
  profile: Record<string, unknown>,
  identity: NormalizedMarkdownPdfProfileIdentity,
): Record<string, unknown> {
  return {
    ...profile,
    profile: identity,
  };
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
  profileIdentity: NormalizedMarkdownPdfProfileIdentity;
  reportBase: {
    createdAt: string;
    displayBaseProfilePath?: string;
    displayInputPath?: string;
    displayProfileOutputPath: string;
    inputSha256?: string;
    request: Parameters<typeof createMarkdownPdfCodexReportArtifact>[0]["request"];
  };
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
    { overwrite: input.overwrite },
  );
  printLine(
    input.runtime.stderr,
    `Wrote Codex report: ${displayPath(input.runtime, input.reportOutputPath)}`,
  );
}

export async function actionMdPdfProfileCodex(
  runtime: CliRuntime,
  options: MdPdfProfileCodexOptions,
): Promise<void> {
  const inputPath = resolveOptionalInputPath(runtime, options);
  const intent = normalizeOptionalText(options.intent);
  const markdown = inputPath ? await readTextFileRequired(inputPath) : undefined;
  const fontHints = normalizeFontHints(options.fontHint);
  const now = runtime.now();
  const createdAt = strictUtcIso(now);
  const outputResolution = options.output
    ? {
        profileId: createProfileUid(now),
        outputPath: resolveFromCwd(runtime, assertNonEmpty(options.output, "Output path")),
      }
    : await resolveGeneratedProfileOutputPath(runtime, inputPath, now);
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
  if (samePath(outputResolution.outputPath, reportOutputPath)) {
    throw new CliError("--codex-report-output cannot be the same path as --output.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }
  if (!options.dryRun) {
    await assertWritableOutputPath(outputResolution.outputPath, { overwrite: options.overwrite });
  }
  if (reportOutputPath) {
    await assertWritableOutputPath(reportOutputPath, { overwrite: options.overwrite });
  }

  printLine(runtime.stderr, "Collecting Markdown PDF profile signals...");
  const candidates = createMarkdownPdfProfileCandidates();
  const baseProfileCandidate = options.baseProfile
    ? await loadMarkdownPdfBaseProfileCandidate({
        cwd: runtime.cwd,
        path: options.baseProfile,
      })
    : undefined;
  if (baseProfileCandidate) {
    candidates.unshift(baseProfileCandidate);
  }
  const strongestCandidate = baseProfileCandidate ?? candidates[0];
  if (!strongestCandidate) {
    throw new CliError("No Markdown PDF profile candidates are available.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }
  const normalizedStrongestProfile = normalizeMarkdownPdfProfile({
    profile: strongestCandidate.fullProfile,
  }).profile;
  const documentSignals = markdown
    ? collectMarkdownPdfDocumentSignals(markdown)
    : createAbsentMarkdownPdfDocumentSignals();
  const fontSignals = collectMarkdownPdfFontSignals({
    profile: normalizedStrongestProfile,
  });
  const signalMode = classifySignalMode({
    hasBaseProfile: Boolean(baseProfileCandidate),
    hasFontHints: fontHints.length > 0,
    hasInput: Boolean(inputPath),
    hasIntent: Boolean(intent),
  });
  const request = {
    candidates,
    documentSignals,
    fontHints,
    fontSignals,
    intent,
    selectedBaseProfileSummary: baseProfileCandidate?.summary,
    signalMode,
    supportedSchemaSummary: SUPPORTED_SCHEMA_SUMMARY,
    workingDirectory: runtime.cwd,
  };

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
    request,
  };

  if (signalMode === "basic-default" || signalMode === "base-only-deterministic") {
    const selected =
      signalMode === "base-only-deterministic" ? baseProfileCandidate : strongestCandidate;
    if (!selected) {
      throw new CliError("No Markdown PDF profile candidate is available.", {
        code: "INVALID_INPUT",
        exitCode: 2,
      });
    }
    const identity = createProfileIdentity({
      ...profileIdentityBase,
      basedOn: "default",
      selectedCandidate: selected,
      source: "deterministic",
    });
    const finalProfile = profileWithIdentity(selected.fullProfile, identity);
    validateMarkdownPdfProfileShape(finalProfile);
    const format = inferMarkdownPdfProfileFormat(outputResolution.outputPath);
    const serialized = serializeMarkdownPdfProfile(finalProfile, format);

    printLine(runtime.stdout, `Signal mode: ${signalMode}`);
    printLine(runtime.stdout, "Decision: deterministic");
    printLine(runtime.stdout, `Based on: ${identity.basedOn ?? "none"}`);
    if (identity.preset) {
      printLine(runtime.stdout, `Preset: ${identity.preset}`);
    }
    printLine(runtime.stdout, `Profile: ${displayOutputPath}`);

    if (options.dryRun) {
      printLine(runtime.stdout, "Dry run only. No profile was written.");
    } else {
      await writeTextFileSafe(outputResolution.outputPath, serialized, {
        overwrite: options.overwrite,
      });
      printLine(runtime.stderr, `Wrote Markdown PDF profile: ${displayOutputPath}`);
    }

    if (reportOutputPath) {
      await writeMarkdownPdfCodexReportArtifact(
        reportOutputPath,
        createMarkdownPdfCodexReportArtifact({
          ...reportBase,
          profileIdentity: identity,
          selectedCandidate: selected,
        }),
        { overwrite: options.overwrite },
      );
      printLine(runtime.stderr, `Wrote Codex report: ${displayPath(runtime, reportOutputPath)}`);
    }
    return;
  }

  printLine(runtime.stderr, "Requesting Codex Markdown PDF profile recommendation...");

  try {
    const result = await suggestMarkdownPdfProfileWithCodex({
      ...request,
      runner: options.codexRunner,
    });
    const selected = result.profile
      ? requireSelectedCandidate(candidates, result.decision.selectedCandidateId)
      : selectedCandidate(candidates, result.decision.selectedCandidateId);
    const identity = createProfileIdentity({
      ...profileIdentityBase,
      basedOn: "none",
      selectedCandidate: selected,
    });

    if (!result.profile) {
      const failure: MarkdownPdfCodexReportFailure = {
        kind: "no-usable-profile",
        message: "Codex did not find a usable Markdown PDF profile.",
      };
      if (reportOutputPath) {
        await writeMarkdownPdfCodexReportArtifact(
          reportOutputPath,
          createMarkdownPdfCodexReportArtifact({
            ...reportBase,
            failure,
            profileIdentity: identity,
            selectedCandidate: selected,
          }),
          { overwrite: options.overwrite },
        );
        printLine(runtime.stderr, `Wrote Codex report: ${displayPath(runtime, reportOutputPath)}`);
      }
      throw new CliError(failure.message, {
        code: "MARKDOWN_PDF_CODEX_NO_USABLE_PROFILE",
        exitCode: 1,
      });
    }

    const finalProfile = profileWithIdentity(result.profile, identity);
    validateMarkdownPdfProfileShape(finalProfile);
    const format = inferMarkdownPdfProfileFormat(outputResolution.outputPath);
    const serialized = serializeMarkdownPdfProfile(finalProfile, format);

    printLine(runtime.stdout, `Decision: ${result.decision.decisionMode}`);
    printLine(runtime.stdout, `Based on: ${identity.basedOn ?? "none"}`);
    if (identity.preset) {
      printLine(runtime.stdout, `Preset: ${identity.preset}`);
    }
    if (result.decision.fallbackReason) {
      printLine(runtime.stdout, `Fallback reason: ${result.decision.fallbackReason}`);
    }
    printLine(runtime.stdout, `Profile: ${displayOutputPath}`);

    if (options.dryRun) {
      printLine(runtime.stdout, "Dry run only. No profile was written.");
    } else {
      await writeTextFileSafe(outputResolution.outputPath, serialized, {
        overwrite: options.overwrite,
      });
      printLine(runtime.stderr, `Wrote Markdown PDF profile: ${displayOutputPath}`);
    }

    if (reportOutputPath) {
      await writeMarkdownPdfCodexReportArtifact(
        reportOutputPath,
        createMarkdownPdfCodexReportArtifact({
          ...reportBase,
          profileIdentity: identity,
          result,
          selectedCandidate: selected,
        }),
        { overwrite: options.overwrite },
      );
      printLine(runtime.stderr, `Wrote Codex report: ${displayPath(runtime, reportOutputPath)}`);
    }
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
        profileIdentity: createProfileIdentity({ ...profileIdentityBase, basedOn: "none" }),
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
      profileIdentity: createProfileIdentity({ ...profileIdentityBase, basedOn: "none" }),
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
