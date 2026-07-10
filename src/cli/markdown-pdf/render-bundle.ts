import { open, readdir } from "node:fs/promises";
import { extname, join } from "node:path";

import { CliError } from "../errors";
import {
  MARKDOWN_PDF_PROFILE_ROOT_KEYS,
  normalizeMarkdownPdfProfile,
  parseMarkdownPdfProfileFile,
  validateMarkdownPdfProfileShape,
} from "./profile";

export type MarkdownPdfRenderBundleRole = "profile" | "template" | "css";

export type MarkdownPdfRenderBundleResolutionSource = "bundle" | "explicit";

export interface MarkdownPdfRenderBundleCandidate {
  basename: string;
  path: string;
  role: MarkdownPdfRenderBundleRole;
}

export interface MarkdownPdfRenderBundleCandidates {
  directory: string;
  profile: MarkdownPdfRenderBundleCandidate[];
  template: MarkdownPdfRenderBundleCandidate[];
  css: MarkdownPdfRenderBundleCandidate[];
  ignoredProfileFiles: string[];
}

export interface MarkdownPdfRenderBundleExplicitInputs {
  profile?: string;
  template?: string;
  css?: string;
}

export interface MarkdownPdfRenderBundleResolvedInput {
  path: string;
  source: MarkdownPdfRenderBundleResolutionSource;
}

export interface MarkdownPdfRenderBundleResolvedInputs {
  profile?: MarkdownPdfRenderBundleResolvedInput;
  template?: MarkdownPdfRenderBundleResolvedInput;
  css?: MarkdownPdfRenderBundleResolvedInput;
}

export interface ResolveMarkdownPdfRenderBundleOptions {
  displayDirectory?: string;
}

export interface DiscoverMarkdownPdfRenderBundleOptions {
  profileResolved?: boolean;
}

const PROFILE_EXTENSIONS = new Set([".yml", ".yaml", ".json"]);
const PROFILE_ROOT_KEYS = new Set<string>(MARKDOWN_PDF_PROFILE_ROOT_KEYS);

const MARKDOWN_PDF_PROFILE_CODEX_REPORT_TYPE = "markdown-pdf-codex-profile-report";
const MARKDOWN_PDF_TEMPLATE_PROJECT_CODEX_REPORT_TYPES = new Set([
  "markdown-pdf-codex-template-report",
  "markdown-pdf-codex-project-report",
]);
const REPORT_DISCRIMINATOR_READ_LIMIT_BYTES = 64 * 1024;

function isNodeErrorCode(error: unknown, code: string): boolean {
  return (
    error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === code
  );
}

function isReservedCodexReportFilename(filename: string): boolean {
  const normalized = filename.toLowerCase();
  return normalized.endsWith("-codex-report.json") || normalized.endsWith(".codex-report.json");
}

function hasMarkdownPdfCodexReportDiscriminator(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
  if (
    typeof record.artifactType === "string" &&
    MARKDOWN_PDF_TEMPLATE_PROJECT_CODEX_REPORT_TYPES.has(record.artifactType)
  ) {
    return true;
  }
  if (!record.artifact || typeof record.artifact !== "object" || Array.isArray(record.artifact)) {
    return false;
  }
  const artifact = record.artifact as Record<string, unknown>;
  return artifact.type === MARKDOWN_PDF_PROFILE_CODEX_REPORT_TYPE;
}

async function isRecognizedCodexReportJson(path: string, basename: string): Promise<boolean> {
  if (isReservedCodexReportFilename(basename)) {
    return true;
  }
  let handle;
  try {
    handle = await open(path, "r");
    const buffer = Buffer.alloc(REPORT_DISCRIMINATOR_READ_LIMIT_BYTES + 1);
    let offset = 0;
    while (offset < buffer.length) {
      const { bytesRead } = await handle.read(buffer, offset, buffer.length - offset, offset);
      if (bytesRead === 0) {
        break;
      }
      offset += bytesRead;
    }
    if (offset > REPORT_DISCRIMINATOR_READ_LIMIT_BYTES) {
      return false;
    }
    const value: unknown = JSON.parse(buffer.subarray(0, offset).toString("utf8"));
    return hasMarkdownPdfCodexReportDiscriminator(value);
  } catch {
    return false;
  } finally {
    await handle?.close();
  }
}

type MarkdownPdfRenderBundleProfileClassification =
  | { kind: "profile" }
  | { kind: "unclassified" }
  | { error: unknown; kind: "invalid-profile" };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

async function classifyMarkdownPdfRenderBundleProfile(
  path: string,
): Promise<MarkdownPdfRenderBundleProfileClassification> {
  const parsed = await parseMarkdownPdfProfileFile(path);
  if (!parsed.ok || !isPlainObject(parsed.value)) {
    return { kind: "unclassified" };
  }

  const rootKeys = Object.keys(parsed.value);
  if (
    rootKeys.length === 0 ||
    !rootKeys.some((key) => PROFILE_ROOT_KEYS.has(key)) ||
    rootKeys.some((key) => !PROFILE_ROOT_KEYS.has(key))
  ) {
    return { kind: "unclassified" };
  }

  try {
    validateMarkdownPdfProfileShape(parsed.value);
    normalizeMarkdownPdfProfile({ profile: parsed.value });
    return { kind: "profile" };
  } catch (error) {
    return { error, kind: "invalid-profile" };
  }
}

function compareCandidates(
  left: MarkdownPdfRenderBundleCandidate,
  right: MarkdownPdfRenderBundleCandidate,
): number {
  if (left.basename === right.basename) {
    return 0;
  }
  return left.basename < right.basename ? -1 : 1;
}

function candidateRole(extension: string): MarkdownPdfRenderBundleRole | undefined {
  if (PROFILE_EXTENSIONS.has(extension)) {
    return "profile";
  }
  if (extension === ".html") {
    return "template";
  }
  if (extension === ".css") {
    return "css";
  }
  return undefined;
}

export async function discoverMarkdownPdfRenderBundle(
  directory: string,
  options: DiscoverMarkdownPdfRenderBundleOptions = {},
): Promise<MarkdownPdfRenderBundleCandidates> {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (isNodeErrorCode(error, "ENOENT")) {
      throw new CliError(`Markdown PDF bundle directory not found: ${directory}`, {
        code: "FILE_NOT_FOUND",
        exitCode: 2,
      });
    }
    if (isNodeErrorCode(error, "ENOTDIR")) {
      throw new CliError(`Markdown PDF bundle path is not a directory: ${directory}`, {
        code: "INVALID_INPUT",
        exitCode: 2,
      });
    }
    throw new CliError(`Unable to read Markdown PDF bundle directory: ${directory}`, {
      code: "FILE_READ_ERROR",
      exitCode: 2,
    });
  }

  const candidates: MarkdownPdfRenderBundleCandidates = {
    directory,
    profile: [],
    template: [],
    css: [],
    ignoredProfileFiles: [],
  };
  const profileCandidates: MarkdownPdfRenderBundleCandidate[] = [];

  for (const entry of entries) {
    if (!entry.isFile()) {
      continue;
    }
    const extension = extname(entry.name).toLowerCase();
    const role = candidateRole(extension);
    if (!role) {
      continue;
    }
    const path = join(directory, entry.name);
    const candidate = { basename: entry.name, path, role };
    if (role === "profile") {
      profileCandidates.push(candidate);
      continue;
    }
    candidates[role].push(candidate);
  }

  candidates.template.sort(compareCandidates);
  candidates.css.sort(compareCandidates);

  const inspectProfileCandidates =
    !options.profileResolved || (candidates.template.length === 0 && candidates.css.length === 0);
  if (inspectProfileCandidates) {
    profileCandidates.sort(compareCandidates);
    for (const candidate of profileCandidates) {
      const extension = extname(candidate.basename).toLowerCase();
      if (
        extension === ".json" &&
        (await isRecognizedCodexReportJson(candidate.path, candidate.basename))
      ) {
        continue;
      }
      const classification = await classifyMarkdownPdfRenderBundleProfile(candidate.path);
      if (classification.kind === "unclassified") {
        if (!options.profileResolved) {
          candidates.ignoredProfileFiles.push(candidate.basename);
        }
        continue;
      }
      if (classification.kind === "invalid-profile") {
        if (!options.profileResolved) {
          throw classification.error;
        }
        continue;
      }
      candidates.profile.push(candidate);
    }
  }

  candidates.profile.sort(compareCandidates);
  candidates.ignoredProfileFiles.sort();

  if (
    candidates.profile.length === 0 &&
    candidates.template.length === 0 &&
    candidates.css.length === 0
  ) {
    const ignoredFiles = candidates.ignoredProfileFiles;
    const ignoredSection =
      ignoredFiles.length === 0
        ? ""
        : `\n\nIgnored unclassified YAML or JSON files:\n${ignoredFiles
            .map((filename) => `- ${filename}`)
            .join("\n")}`;
    throw new CliError(
      `No Markdown PDF render artifacts found in bundle: ${directory}${ignoredSection}`,
      {
        code: "MARKDOWN_PDF_BUNDLE_EMPTY",
        exitCode: 2,
      },
    );
  }

  return candidates;
}

const ROLE_RESOLUTION_CONFIG = [
  { role: "profile", label: "profile", flag: "--profile" },
  { role: "template", label: "template", flag: "--template" },
  { role: "css", label: "stylesheet", flag: "--css" },
] as const;

interface MarkdownPdfRenderBundleConflict {
  candidates: MarkdownPdfRenderBundleCandidate[];
  flag: string;
  label: string;
}

function bundleConflictMessage(
  directory: string,
  conflicts: MarkdownPdfRenderBundleConflict[],
): string {
  const sections = conflicts.map((conflict) => {
    const candidateLines = conflict.candidates
      .map((candidate) => `- ${candidate.basename}`)
      .join("\n");
    return [
      `Multiple ${conflict.label} candidates were found:`,
      candidateLines,
      "",
      `Select one with ${conflict.flag} <path>, or remove the extra candidate.`,
    ].join("\n");
  });
  return [`Ambiguous Markdown PDF bundle: ${directory}`, ...sections].join("\n\n");
}

export function resolveMarkdownPdfRenderBundleInputs(
  candidates: MarkdownPdfRenderBundleCandidates,
  explicit: MarkdownPdfRenderBundleExplicitInputs = {},
  options: ResolveMarkdownPdfRenderBundleOptions = {},
): MarkdownPdfRenderBundleResolvedInputs {
  const resolved: MarkdownPdfRenderBundleResolvedInputs = {};
  const conflicts: MarkdownPdfRenderBundleConflict[] = [];

  for (const config of ROLE_RESOLUTION_CONFIG) {
    const explicitPath = explicit[config.role];
    if (explicitPath) {
      resolved[config.role] = { path: explicitPath, source: "explicit" };
      continue;
    }
    const roleCandidates = candidates[config.role];
    if (roleCandidates.length > 1) {
      conflicts.push({
        candidates: roleCandidates,
        flag: config.flag,
        label: config.label,
      });
      continue;
    }
    const candidate = roleCandidates[0];
    if (candidate) {
      resolved[config.role] = { path: candidate.path, source: "bundle" };
    }
  }

  if (conflicts.length > 0) {
    throw new CliError(
      bundleConflictMessage(options.displayDirectory?.trim() || candidates.directory, conflicts),
      {
        code: "MARKDOWN_PDF_BUNDLE_AMBIGUOUS",
        exitCode: 2,
      },
    );
  }

  return resolved;
}
