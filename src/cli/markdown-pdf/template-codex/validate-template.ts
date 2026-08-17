import { dirname, isAbsolute, relative } from "node:path";

import { CliError } from "../../errors";
import { assessMarkdownPdfTemplateCompatibility } from "../template-compatibility";
import { inspectMarkdownPdfTemplateBody } from "../template-body";
import {
  MARKDOWN_PDF_TEMPLATE_CODEX_CONTRACT,
  MARKDOWN_PDF_TEMPLATE_CODEX_FAMILIES,
} from "./families";
import type {
  MarkdownPdfTemplateCodexOutputPlan,
  MarkdownPdfTemplateCodexSynthesisResult,
} from "./types";
import type { NormalizedMarkdownPdfProfile } from "../profile";

const REMOTE_REFERENCE_PATTERN = /\b(?:https?|ftp):\/\/|\/\/[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/iu;
const FILE_URL_PATTERN = /\bfile:\/\//iu;
const WINDOWS_ABSOLUTE_PATH_PATTERN = /(?:^|[\s"'(=])(?:[A-Za-z]:\\|\\\\)/u;
const UNIX_ABSOLUTE_PATH_PATTERN = /(?:^|[\s"'(=])\/(?![/*])(?:[^\s"'(){};]|\\.)+/u;
const HTML_REFERENCE_PATTERN = /\b(?:src|href)\s*=\s*(["'])(.*?)\1/giu;
const CSS_URL_PATTERN = /\burl\(\s*(["']?)(.*?)\1\s*\)/giu;

function validationError(message: string): never {
  throw new CliError(message, {
    code: "TEMPLATE_VALIDATION_FAILED",
    exitCode: 2,
  });
}

function assertContains(value: string, marker: string, label: string, fileLabel: string): void {
  if (value.includes(marker)) {
    return;
  }
  validationError(`${fileLabel} is missing required ${label}: ${marker}`);
}

function assertTocRegion(templateHtml: string): void {
  const tocIf = templateHtml.indexOf(MARKDOWN_PDF_TEMPLATE_CODEX_CONTRACT.html.tocConditional);
  const tocPlaceholder = templateHtml.indexOf(
    MARKDOWN_PDF_TEMPLATE_CODEX_CONTRACT.html.tocPlaceholder,
  );
  const tocEnd = templateHtml.indexOf("$endif$", tocPlaceholder);
  if (tocIf < 0 || tocPlaceholder < 0 || tocEnd < 0 || tocIf > tocPlaceholder) {
    validationError(
      "template.html must preserve the Pandoc ToC region: $if(toc)$ ... $toc$ ... $endif$.",
    );
  }
  assertContains(
    templateHtml,
    `id="${MARKDOWN_PDF_TEMPLATE_CODEX_CONTRACT.html.tocId}"`,
    "ToC layout target",
    "template.html",
  );
}

function assertFamilyHooks(input: {
  outputPlan: MarkdownPdfTemplateCodexOutputPlan;
  synthesis: MarkdownPdfTemplateCodexSynthesisResult;
}): void {
  const family = MARKDOWN_PDF_TEMPLATE_CODEX_FAMILIES[input.synthesis.templateFamily];
  for (const hook of family.requiredTemplateHooks) {
    assertContains(input.synthesis.templateHtml, hook.marker, hook.id, "template.html");
  }
  for (const hook of family.requiredCssHooks) {
    assertContains(input.synthesis.styleCss, hook.marker, hook.id, "style.css");
  }
  assertContains(input.synthesis.styleCss, "@page", "page chrome hook", "style.css");
  assertContains(input.synthesis.styleCss, "body", "body style hook", "style.css");

  if (
    family.requiresCoverImage &&
    !input.synthesis.managedAssets.some((asset) => asset.role === "cover-image")
  ) {
    validationError(`${family.id} requires an accepted managed cover image asset.`);
  }
}

function referenceLooksAbsoluteOrEscaping(value: string): boolean {
  const trimmed = value.trim();
  return (
    trimmed.startsWith("/") ||
    trimmed.startsWith("\\") ||
    trimmed.includes("../") ||
    trimmed.includes("..\\") ||
    /^[A-Za-z]:[\\/]/u.test(trimmed)
  );
}

function extractReferences(value: string): string[] {
  const references: string[] = [];
  for (const match of value.matchAll(HTML_REFERENCE_PATTERN)) {
    references.push(match[2] ?? "");
  }
  for (const match of value.matchAll(CSS_URL_PATTERN)) {
    references.push(match[2] ?? "");
  }
  return references;
}

function assertNoUnsafeReferences(input: {
  content: string;
  fileLabel: string;
  acceptedAssetPaths: Set<string>;
}): void {
  if (REMOTE_REFERENCE_PATTERN.test(input.content)) {
    validationError(`${input.fileLabel} must not reference remote URLs.`);
  }
  if (FILE_URL_PATTERN.test(input.content)) {
    validationError(`${input.fileLabel} must not reference file:// URLs.`);
  }
  if (WINDOWS_ABSOLUTE_PATH_PATTERN.test(input.content)) {
    validationError(`${input.fileLabel} must not reference absolute local paths.`);
  }
  if (UNIX_ABSOLUTE_PATH_PATTERN.test(input.content)) {
    validationError(`${input.fileLabel} must not reference absolute local paths.`);
  }

  for (const reference of extractReferences(input.content)) {
    if (!reference || reference.startsWith("#") || reference.startsWith("$")) {
      continue;
    }
    if (/^(?:data:|https?:|ftp:|file:)/iu.test(reference)) {
      validationError(`${input.fileLabel} must not reference unsafe URLs: ${reference}`);
    }
    if (referenceLooksAbsoluteOrEscaping(reference)) {
      validationError(
        `${input.fileLabel} must not reference paths outside the bundle: ${reference}`,
      );
    }
    if (!input.acceptedAssetPaths.has(reference)) {
      validationError(`${input.fileLabel} references an unmanaged asset: ${reference}`);
    }
  }
}

function assertBundlePathInsideOutput(input: {
  bundlePath: string;
  outputDirectory: string;
  path: string;
  pathLabel: string;
}): void {
  if (
    input.bundlePath.startsWith("/") ||
    input.bundlePath.startsWith("\\") ||
    input.bundlePath.includes("..")
  ) {
    validationError(`${input.pathLabel} must use a bundle-relative path.`);
  }
  const relativePath = relative(input.outputDirectory, input.path);
  if (relativePath.length > 0 && !relativePath.startsWith("..") && !isAbsolute(relativePath)) {
    return;
  }
  validationError(`${input.pathLabel} must stay inside the template output directory.`);
}

export function validateMdPdfTemplateCodexSynthesis(input: {
  compatibilityProfile?: NormalizedMarkdownPdfProfile;
  deferBodyBoundaryValidationToProject?: boolean;
  outputPlan: MarkdownPdfTemplateCodexOutputPlan;
  synthesis: MarkdownPdfTemplateCodexSynthesisResult;
}): void {
  assertBundlePathInsideOutput({
    bundlePath: input.outputPlan.templateHtml.bundlePath,
    outputDirectory: input.outputPlan.outputDirectory,
    path: input.outputPlan.templateHtml.path,
    pathLabel: "template.html",
  });
  assertBundlePathInsideOutput({
    bundlePath: input.outputPlan.styleCss.bundlePath,
    outputDirectory: input.outputPlan.outputDirectory,
    path: input.outputPlan.styleCss.path,
    pathLabel: "style.css",
  });
  for (const asset of input.outputPlan.assets) {
    assertBundlePathInsideOutput({
      bundlePath: asset.bundlePath,
      outputDirectory: input.outputPlan.outputDirectory,
      path: asset.path,
      pathLabel: `managed asset ${asset.bundlePath}`,
    });
  }
  if (input.outputPlan.report?.location === "in-bundle") {
    assertBundlePathInsideOutput({
      bundlePath: input.outputPlan.report.bundlePath,
      outputDirectory: input.outputPlan.outputDirectory,
      path: input.outputPlan.report.path,
      pathLabel: "template Codex report",
    });
  }

  if (input.synthesis.decisionMode === "no-usable-template") {
    if (input.synthesis.templateHtml.length > 0 || input.synthesis.styleCss.length > 0) {
      validationError("no-usable-template decisions must not include recipe files.");
    }
    return;
  }

  if (!input.deferBodyBoundaryValidationToProject) {
    assertContains(
      input.synthesis.templateHtml,
      MARKDOWN_PDF_TEMPLATE_CODEX_CONTRACT.html.bodyPlaceholder,
      "Pandoc body placeholder",
      "template.html",
    );
    const bodyInspection = inspectMarkdownPdfTemplateBody(input.synthesis.templateHtml);
    if (bodyInspection.status !== "proven") {
      validationError(
        `template.html must contain exactly one .document-body element owning the single live $body$ insertion point (found ${bodyInspection.status}).`,
      );
    }
  }
  if (input.compatibilityProfile) {
    assessMarkdownPdfTemplateCompatibility({
      builtIn: false,
      profile: input.compatibilityProfile,
      templateHtml: input.synthesis.templateHtml,
    });
  }
  assertTocRegion(input.synthesis.templateHtml);
  assertFamilyHooks(input);

  const acceptedAssetPaths = new Set(
    input.synthesis.managedAssets.map((asset) => asset.bundlePath),
  );
  assertNoUnsafeReferences({
    content: input.synthesis.templateHtml,
    fileLabel: "template.html",
    acceptedAssetPaths,
  });
  assertNoUnsafeReferences({
    content: input.synthesis.styleCss,
    fileLabel: "style.css",
    acceptedAssetPaths,
  });

  for (const asset of input.outputPlan.assets) {
    if (dirname(asset.bundlePath) !== "assets") {
      validationError(`managed asset ${asset.bundlePath} must be written under assets/.`);
    }
  }
}
