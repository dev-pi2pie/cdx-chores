import { open, readdir } from "node:fs/promises";
import { extname, join } from "node:path";

import { CliError } from "../../errors";
import {
  MARKDOWN_PDF_PROFILE_ROOT_KEYS,
  normalizeMarkdownPdfProfile,
  parseMarkdownPdfProfileFile,
  validateMarkdownPdfProfileShape,
} from "../profile";
import { SUPPORTED_TEMPLATE_CODEX_COVER_IMAGE_EXTENSIONS } from "../template-codex/image-metadata";
import { MARKDOWN_PDF_PROJECT_CODEX_REPORT_ARTIFACT_TYPE } from "./types-report";

const PROJECT_PROFILE_BASENAME = "profile.yml";
const PROJECT_TEMPLATE_BASENAME = "template.html";
const PROJECT_CSS_BASENAME = "style.css";
const PROJECT_REPORT_BASENAME = "project.codex-report.json";
const REPORT_DISCRIMINATOR_READ_LIMIT_BYTES = 64 * 1024;
const PROFILE_ROOT_KEYS = new Set<string>(MARKDOWN_PDF_PROFILE_ROOT_KEYS);
const PROJECT_WRITABLE_TOP_LEVEL_ENTRIES = new Set([
  PROJECT_PROFILE_BASENAME,
  PROJECT_TEMPLATE_BASENAME,
  PROJECT_CSS_BASENAME,
]);

export interface MarkdownPdfProjectBundleCompleteness {
  assets: string[];
  css: string;
  directory: string;
  profile: string;
  reports: string[];
  template: string;
}

export interface ValidateMdPdfProjectBundleCompletenessOptions {
  displayDirectory?: string;
}

interface ProjectBundleInspection {
  assets: string[];
  cssCandidates: string[];
  invalidProfiles: string[];
  profileCandidates: string[];
  reports: string[];
  templateCandidates: string[];
  topLevelNames: Set<string>;
  unrelated: string[];
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

async function isRecognizedProjectReport(path: string, basename: string): Promise<boolean> {
  if (basename.toLowerCase() === PROJECT_REPORT_BASENAME) {
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
    return (
      isPlainObject(value) && value.artifactType === MARKDOWN_PDF_PROJECT_CODEX_REPORT_ARTIFACT_TYPE
    );
  } catch {
    return false;
  } finally {
    await handle?.close();
  }
}

type ProjectProfileClassification = "invalid-profile" | "profile" | "unclassified";

async function classifyProjectProfile(path: string): Promise<ProjectProfileClassification> {
  const parsed = await parseMarkdownPdfProfileFile(path);
  if (!parsed.ok || !isPlainObject(parsed.value)) {
    return "unclassified";
  }
  const keys = Object.keys(parsed.value);
  if (
    keys.length === 0 ||
    !keys.some((key) => PROFILE_ROOT_KEYS.has(key)) ||
    keys.some((key) => !PROFILE_ROOT_KEYS.has(key))
  ) {
    return "unclassified";
  }
  try {
    validateMarkdownPdfProfileShape(parsed.value);
    normalizeMarkdownPdfProfile({ profile: parsed.value });
    return "profile";
  } catch {
    return "invalid-profile";
  }
}

async function inspectManagedAssets(directory: string): Promise<{
  accepted: string[];
  unrelated: string[];
}> {
  const assetsDirectory = join(directory, "assets");
  const entries = await readdir(assetsDirectory, { withFileTypes: true });
  const accepted: string[] = [];
  const unrelated: string[] = [];
  for (const entry of entries) {
    const bundlePath = `assets/${entry.name}`;
    const extension = extname(entry.name).toLowerCase();
    const isManagedCover =
      entry.isFile() &&
      entry.name === `cover${extension}` &&
      SUPPORTED_TEMPLATE_CODEX_COVER_IMAGE_EXTENSIONS.has(extension);
    if (isManagedCover) {
      accepted.push(bundlePath);
    } else {
      unrelated.push(bundlePath);
    }
  }
  if (accepted.length > 1) {
    unrelated.push(...accepted);
    accepted.length = 0;
  }
  return { accepted: accepted.sort(), unrelated: unrelated.sort() };
}

async function inspectProjectBundle(directory: string): Promise<ProjectBundleInspection> {
  const entries = await readdir(directory, { withFileTypes: true });
  const inspection: ProjectBundleInspection = {
    assets: [],
    cssCandidates: [],
    invalidProfiles: [],
    profileCandidates: [],
    reports: [],
    templateCandidates: [],
    topLevelNames: new Set(entries.map((entry) => entry.name)),
    unrelated: [],
  };

  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory() && entry.name === "assets") {
      const assets = await inspectManagedAssets(directory);
      inspection.assets.push(...assets.accepted);
      inspection.unrelated.push(...assets.unrelated);
      continue;
    }
    if (!entry.isFile()) {
      inspection.unrelated.push(entry.name);
      continue;
    }

    const extension = extname(entry.name).toLowerCase();
    if (extension === ".html") {
      inspection.templateCandidates.push(entry.name);
      continue;
    }
    if (extension === ".css") {
      inspection.cssCandidates.push(entry.name);
      continue;
    }
    if (extension === ".json" && (await isRecognizedProjectReport(path, entry.name))) {
      inspection.reports.push(entry.name);
      continue;
    }
    if (extension === ".yml" || extension === ".yaml" || extension === ".json") {
      const classification = await classifyProjectProfile(path);
      if (classification === "profile") {
        inspection.profileCandidates.push(entry.name);
      } else if (classification === "invalid-profile" || entry.name === PROJECT_PROFILE_BASENAME) {
        inspection.invalidProfiles.push(entry.name);
      } else {
        inspection.unrelated.push(entry.name);
      }
      continue;
    }
    inspection.unrelated.push(entry.name);
  }

  inspection.assets.sort();
  inspection.cssCandidates.sort();
  inspection.invalidProfiles.sort();
  inspection.profileCandidates.sort();
  inspection.reports.sort();
  inspection.templateCandidates.sort();
  inspection.unrelated.sort();
  return inspection;
}

function listSection(label: string, filenames: readonly string[]): string | undefined {
  if (filenames.length === 0) {
    return undefined;
  }
  return `${label}:\n${filenames.map((filename) => `- ${filename}`).join("\n")}`;
}

function projectCompletenessError(input: {
  directory: string;
  duplicateCss: string[];
  duplicateProfiles: string[];
  duplicateTemplates: string[];
  invalidProfiles: string[];
  missing: string[];
  unrelated: string[];
}): CliError {
  const sections = [
    listSection("Missing required Project files", input.missing),
    listSection("Multiple Project profile candidates", input.duplicateProfiles),
    listSection("Multiple Project template candidates", input.duplicateTemplates),
    listSection("Multiple Project stylesheet candidates", input.duplicateCss),
    listSection("Invalid Project profile files", input.invalidProfiles),
    listSection("Unrelated Project bundle entries", input.unrelated),
  ].filter((section): section is string => Boolean(section));
  return new CliError(
    [`Incomplete Markdown PDF Project bundle: ${input.directory}`, ...sections].join("\n\n"),
    {
      code: "MARKDOWN_PDF_PROJECT_BUNDLE_INCOMPLETE",
      exitCode: 2,
    },
  );
}

function roleIssues(
  candidates: string[],
  canonicalBasename: string,
): {
  duplicates: string[];
  unrelated: string[];
} {
  const noncanonical = candidates.filter((candidate) => candidate !== canonicalBasename);
  if (candidates.includes(canonicalBasename) && noncanonical.length > 0) {
    return { duplicates: candidates, unrelated: [] };
  }
  if (noncanonical.length > 1) {
    return { duplicates: noncanonical, unrelated: [] };
  }
  return { duplicates: [], unrelated: noncanonical };
}

/**
 * Validates a completed Project-helper bundle. Unlike generic render-bundle discovery, this
 * boundary is intentionally fail-closed and admits only the canonical Project roles.
 */
export async function validateMdPdfProjectBundleCompleteness(
  directory: string,
  options: ValidateMdPdfProjectBundleCompletenessOptions = {},
): Promise<MarkdownPdfProjectBundleCompleteness> {
  const inspection = await inspectProjectBundle(directory);
  const profileIssues = roleIssues(inspection.profileCandidates, PROJECT_PROFILE_BASENAME);
  const templateIssues = roleIssues(inspection.templateCandidates, PROJECT_TEMPLATE_BASENAME);
  const cssIssues = roleIssues(inspection.cssCandidates, PROJECT_CSS_BASENAME);
  const missing = [
    ...(!inspection.topLevelNames.has(PROJECT_PROFILE_BASENAME) ? [PROJECT_PROFILE_BASENAME] : []),
    ...(!inspection.topLevelNames.has(PROJECT_TEMPLATE_BASENAME)
      ? [PROJECT_TEMPLATE_BASENAME]
      : []),
    ...(!inspection.topLevelNames.has(PROJECT_CSS_BASENAME) ? [PROJECT_CSS_BASENAME] : []),
  ];
  const invalidProfiles = inspection.invalidProfiles;
  const unrelated = [
    ...inspection.unrelated,
    ...profileIssues.unrelated,
    ...templateIssues.unrelated,
    ...cssIssues.unrelated,
  ].sort();

  if (
    missing.length > 0 ||
    profileIssues.duplicates.length > 0 ||
    templateIssues.duplicates.length > 0 ||
    cssIssues.duplicates.length > 0 ||
    invalidProfiles.length > 0 ||
    unrelated.length > 0 ||
    !inspection.profileCandidates.includes(PROJECT_PROFILE_BASENAME)
  ) {
    throw projectCompletenessError({
      directory: options.displayDirectory?.trim() || directory,
      duplicateCss: cssIssues.duplicates,
      duplicateProfiles: profileIssues.duplicates,
      duplicateTemplates: templateIssues.duplicates,
      invalidProfiles,
      missing,
      unrelated,
    });
  }

  return {
    assets: inspection.assets.map((bundlePath) => join(directory, bundlePath)),
    css: join(directory, PROJECT_CSS_BASENAME),
    directory,
    profile: join(directory, PROJECT_PROFILE_BASENAME),
    reports: inspection.reports.map((basename) => join(directory, basename)),
    template: join(directory, PROJECT_TEMPLATE_BASENAME),
  };
}

/** Rejects entries that a Project-helper write cannot safely own while allowing missing outputs. */
export async function assertMdPdfProjectBundleWritePreflight(
  directory: string,
  options: ValidateMdPdfProjectBundleCompletenessOptions = {},
): Promise<void> {
  const inspection = await inspectProjectBundle(directory);
  const profileIssues = roleIssues(inspection.profileCandidates, PROJECT_PROFILE_BASENAME);
  const templateIssues = roleIssues(inspection.templateCandidates, PROJECT_TEMPLATE_BASENAME);
  const cssIssues = roleIssues(inspection.cssCandidates, PROJECT_CSS_BASENAME);
  const unrelated = [
    ...inspection.unrelated.filter((basename) => !PROJECT_WRITABLE_TOP_LEVEL_ENTRIES.has(basename)),
    ...inspection.invalidProfiles.filter((basename) => basename !== PROJECT_PROFILE_BASENAME),
    ...profileIssues.unrelated,
    ...templateIssues.unrelated,
    ...cssIssues.unrelated,
  ].sort();

  if (
    profileIssues.duplicates.length > 0 ||
    templateIssues.duplicates.length > 0 ||
    cssIssues.duplicates.length > 0 ||
    unrelated.length > 0
  ) {
    throw projectCompletenessError({
      directory: options.displayDirectory?.trim() || directory,
      duplicateCss: cssIssues.duplicates,
      duplicateProfiles: profileIssues.duplicates,
      duplicateTemplates: templateIssues.duplicates,
      invalidProfiles: [],
      missing: [],
      unrelated,
    });
  }
}
