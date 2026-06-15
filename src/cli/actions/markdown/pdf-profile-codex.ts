import { randomUUID } from "node:crypto";
import { stat } from "node:fs/promises";
import { extname, join, parse, resolve } from "node:path";

import {
  classifyMarkdownPdfCodexProfileFailure,
  suggestMarkdownPdfProfileWithCodex,
  type MarkdownPdfCodexProfileRunner,
} from "../../../adapters/codex/markdown-pdf-profile";
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
} from "../../markdown-pdf";
import { resolveFromCwd } from "../../path-utils";
import type { CliRuntime } from "../../types";
import { formatUtcFileDateTimeISO } from "../../../utils/datetime";
import { assertNonEmpty, displayPath, printLine } from "../shared";

export interface MdPdfProfileCodexOptions {
  input: string;
  intent: string;
  fontHint?: string[];
  baseProfile?: string;
  output?: string;
  dryRun?: boolean;
  keepCodexReport?: boolean;
  codexReportOutput?: string;
  overwrite?: boolean;
  codexRunner?: MarkdownPdfCodexProfileRunner;
}

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

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function resolveGeneratedProfileOutputPath(
  inputPath: string,
  now: Date,
): Promise<{ profileId: string; outputPath: string }> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const profileId = createProfileUid(now);
    const outputPath = generatedProfilePath(inputPath, profileId);
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
  createdAt: string;
  profileId: string;
  selectedCandidate?: MarkdownPdfProfileCandidate;
}): NormalizedMarkdownPdfProfileIdentity {
  return {
    id: input.profileId,
    source: "codex",
    basedOn:
      input.selectedCandidate?.summary.basedOn ?? input.selectedCandidate?.summary.id ?? "none",
    preset: input.selectedCandidate?.summary.preset,
    createdAt: input.createdAt,
  };
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
    displayInputPath: string;
    displayProfileOutputPath: string;
    inputSha256: string;
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
  const inputPath = resolveFromCwd(runtime, assertNonEmpty(options.input, "Input path"));
  const intent = assertNonEmpty(options.intent, "Intent");
  const markdown = await readTextFileRequired(inputPath);
  const now = runtime.now();
  const createdAt = strictUtcIso(now);
  const outputResolution = options.output
    ? {
        profileId: createProfileUid(now),
        outputPath: resolveFromCwd(runtime, assertNonEmpty(options.output, "Output path")),
      }
    : await resolveGeneratedProfileOutputPath(inputPath, now);
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
  if (!options.dryRun && !options.overwrite && (await pathExists(outputResolution.outputPath))) {
    throw new CliError(
      `Output file already exists: ${outputResolution.outputPath}. Use --overwrite to replace it.`,
      {
        code: "OUTPUT_EXISTS",
        exitCode: 2,
      },
    );
  }
  if (reportOutputPath && !options.overwrite && (await pathExists(reportOutputPath))) {
    throw new CliError(
      `Output file already exists: ${reportOutputPath}. Use --overwrite to replace it.`,
      {
        code: "OUTPUT_EXISTS",
        exitCode: 2,
      },
    );
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
  const documentSignals = collectMarkdownPdfDocumentSignals(markdown);
  const fontSignals = collectMarkdownPdfFontSignals({
    profile: normalizedStrongestProfile,
  });
  const request = {
    candidates,
    documentSignals,
    fontHints: normalizeFontHints(options.fontHint),
    fontSignals,
    intent,
    selectedBaseProfileSummary: baseProfileCandidate?.summary,
    supportedSchemaSummary: SUPPORTED_SCHEMA_SUMMARY,
    workingDirectory: runtime.cwd,
  };

  printLine(runtime.stderr, "Requesting Codex Markdown PDF profile recommendation...");
  const displayInputPath = displayPath(runtime, inputPath);
  const displayOutputPath = displayPath(runtime, outputResolution.outputPath);
  const displayBaseProfilePath = baseProfileCandidate?.path
    ? displayPath(runtime, baseProfileCandidate.path)
    : undefined;
  const profileIdentityBase = {
    createdAt,
    profileId: outputResolution.profileId,
  };
  const reportBase = {
    createdAt,
    displayBaseProfilePath,
    displayInputPath,
    displayProfileOutputPath: displayOutputPath,
    inputSha256: fingerprintMarkdownPdfCodexInput(markdown),
    request,
  };

  try {
    const result = await suggestMarkdownPdfProfileWithCodex({
      ...request,
      runner: options.codexRunner,
    });
    const selected = selectedCandidate(candidates, result.decision.selectedCandidateId);
    const identity = createProfileIdentity({ ...profileIdentityBase, selectedCandidate: selected });

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
        profileIdentity: createProfileIdentity(profileIdentityBase),
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
      profileIdentity: createProfileIdentity(profileIdentityBase),
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
