import { parse, type DefaultTreeAdapterTypes } from "parse5";

import { CliError } from "../errors";
import type { NormalizedMarkdownPdfProfile } from "./profile";
import {
  inspectMarkdownPdfTemplateBody,
  type MarkdownPdfTemplateBodyInspection,
} from "./template-body";

export interface MarkdownPdfTemplateCompatibilityResult {
  bodyBoundary: "not-required" | "proven" | "legacy-document-origin-fallback";
  coverBoundary?: "built-in" | "managed-proven";
  inspection?: MarkdownPdfTemplateBodyInspection;
}

const COVER_CLASS = "pdf-cover";

type Parse5Node = DefaultTreeAdapterTypes.Node;
type Parse5Element = DefaultTreeAdapterTypes.Element;

function isElement(node: Parse5Node): node is Parse5Element {
  return "tagName" in node;
}

function hasClass(node: Parse5Element, className: string): boolean {
  const value = node.attrs.find((attribute) => attribute.name === "class")?.value;
  return value?.split(/\s+/u).includes(className) === true;
}

function countLiveCoverHooks(node: Parse5Node): number {
  const current = isElement(node) && hasClass(node, COVER_CLASS) ? 1 : 0;
  return (
    current +
    ("childNodes" in node
      ? node.childNodes.reduce((count, childNode) => count + countLiveCoverHooks(childNode), 0)
      : 0)
  );
}

function isManagedTemplateNode(node: DefaultTreeAdapterTypes.Node): boolean {
  if (node.nodeName === "#comment" && "data" in node) {
    return node.data.trimStart().startsWith("cdx-chores md pdf-template codex |");
  }
  if ("tagName" in node && node.tagName === "meta") {
    const attributes = new Map(node.attrs.map((attribute) => [attribute.name, attribute.value]));
    if (
      attributes.get("name")?.toLowerCase() === "generator" &&
      attributes.get("content") === "cdx-chores md pdf-template codex"
    ) {
      return true;
    }
  }
  return (
    "childNodes" in node && node.childNodes.some((childNode) => isManagedTemplateNode(childNode))
  );
}

function isManagedTemplate(templateHtml: string, builtIn: boolean): boolean {
  return builtIn || isManagedTemplateNode(parse(templateHtml));
}

export function assessMarkdownPdfTemplateCoverCompatibility(input: {
  builtIn: boolean;
  profile: NormalizedMarkdownPdfProfile;
  templateHtml: string;
}): Pick<MarkdownPdfTemplateCompatibilityResult, "coverBoundary"> {
  if (!input.profile.cover.enabled) {
    return {};
  }
  if (input.builtIn) {
    return { coverBoundary: "built-in" };
  }

  const parsedTemplate = parse(input.templateHtml);
  if (!isManagedTemplateNode(parsedTemplate)) {
    throw new CliError(
      "An enabled Profile cover requires the built-in Markdown PDF template or a validated managed Project Template; the selected custom Template has no supported cover hook.",
      {
        code: "MARKDOWN_PDF_COVER_BOUNDARY_REQUIRED",
        exitCode: 2,
      },
    );
  }

  const hookCount = countLiveCoverHooks(parsedTemplate);
  if (hookCount !== 1) {
    throw new CliError(
      `The selected managed Markdown PDF template requires exactly one live .pdf-cover element when the Profile cover is enabled (found ${hookCount}).`,
      {
        code: "MARKDOWN_PDF_COVER_BOUNDARY_REQUIRED",
        exitCode: 2,
      },
    );
  }
  return { coverBoundary: "managed-proven" };
}

function bodyBoundaryError(input: {
  inspection: MarkdownPdfTemplateBodyInspection;
  managed: boolean;
  requiresBodyOrigin: boolean;
}): CliError {
  const requirement = input.requiresBodyOrigin
    ? "profile.pageNumbers.countFrom: body requires"
    : input.managed
      ? "The selected managed Markdown PDF template requires"
      : "The selected Markdown PDF template attempted but did not satisfy";
  return new CliError(
    `${requirement} exactly one .document-body element containing the single live $body$ insertion point (found ${input.inspection.status}).`,
    {
      code: "MARKDOWN_PDF_BODY_BOUNDARY_REQUIRED",
      exitCode: 2,
    },
  );
}

/**
 * Resolves the selected Template against the effective Profile before any
 * renderer dependency probes or output planning.
 */
export function assessMarkdownPdfTemplateCompatibility(input: {
  builtIn: boolean;
  profile: NormalizedMarkdownPdfProfile;
  templateHtml: string;
}): MarkdownPdfTemplateCompatibilityResult {
  const cover = assessMarkdownPdfTemplateCoverCompatibility(input);
  const pageNumbers = input.profile.pageNumbers;
  if (!pageNumbers.enabled || pageNumbers.scope === "document") {
    return { bodyBoundary: "not-required", ...cover };
  }

  const inspection = inspectMarkdownPdfTemplateBody(input.templateHtml);
  if (inspection.status === "proven") {
    return { bodyBoundary: "proven", ...cover, inspection };
  }

  const managed = isManagedTemplate(input.templateHtml, input.builtIn);
  if (pageNumbers.countFrom === "document" && !managed && inspection.status === "missing-hook") {
    return {
      bodyBoundary: "legacy-document-origin-fallback",
      ...cover,
      inspection,
    };
  }

  throw bodyBoundaryError({
    inspection,
    managed,
    requiresBodyOrigin: pageNumbers.countFrom === "body",
  });
}
