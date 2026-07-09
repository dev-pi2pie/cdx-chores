import { open, readdir } from "node:fs/promises";
import { extname, join } from "node:path";

import { CliError } from "../errors";

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

const PROFILE_EXTENSIONS = new Set([".yml", ".yaml", ".json"]);

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
  };

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
    if (extension === ".json" && (await isRecognizedCodexReportJson(path, entry.name))) {
      continue;
    }
    candidates[role].push({ basename: entry.name, path, role });
  }

  candidates.profile.sort(compareCandidates);
  candidates.template.sort(compareCandidates);
  candidates.css.sort(compareCandidates);

  if (
    candidates.profile.length === 0 &&
    candidates.template.length === 0 &&
    candidates.css.length === 0
  ) {
    throw new CliError(`No Markdown PDF render artifacts found in bundle: ${directory}`, {
      code: "MARKDOWN_PDF_BUNDLE_EMPTY",
      exitCode: 2,
    });
  }

  return candidates;
}
