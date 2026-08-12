import { parse, type DefaultTreeAdapterTypes } from "parse5";

import { CliError } from "../errors";
import type { NormalizedMarkdownPdfProfile } from "./profile";
import {
  inspectMarkdownPdfTemplateBody,
  type MarkdownPdfTemplateBodyInspection,
} from "./template-body";

export const MARKDOWN_PDF_LEGACY_BODY_VISIBILITY_WARNING =
  "Selected legacy Markdown PDF template has no provable .document-body boundary; body-scoped page-number visibility will use document-origin fallback behavior.";

export interface MarkdownPdfTemplateCompatibilityResult {
  bodyBoundary: "not-required" | "proven" | "legacy-document-origin-fallback";
  inspection?: MarkdownPdfTemplateBodyInspection;
  warnings: string[];
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
  const pageNumbers = input.profile.pageNumbers;
  if (!pageNumbers.enabled || pageNumbers.scope === "document") {
    return { bodyBoundary: "not-required", warnings: [] };
  }

  const inspection = inspectMarkdownPdfTemplateBody(input.templateHtml);
  if (inspection.status === "proven") {
    return { bodyBoundary: "proven", inspection, warnings: [] };
  }

  const managed = isManagedTemplate(input.templateHtml, input.builtIn);
  if (pageNumbers.countFrom === "document" && !managed && inspection.status === "missing-hook") {
    return {
      bodyBoundary: "legacy-document-origin-fallback",
      inspection,
      warnings: [MARKDOWN_PDF_LEGACY_BODY_VISIBILITY_WARNING],
    };
  }

  throw bodyBoundaryError({
    inspection,
    managed,
    requiresBodyOrigin: pageNumbers.countFrom === "body",
  });
}
