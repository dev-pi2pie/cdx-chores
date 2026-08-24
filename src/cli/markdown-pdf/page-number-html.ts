import { defaultTreeAdapter, parse, serialize, type DefaultTreeAdapterTypes } from "parse5";

import { CliError } from "../errors";
import {
  MARKDOWN_PDF_LOGICAL_FINAL_TARGET_ID,
  markdownPdfPageNumberFormatTokens,
  type NormalizedMarkdownPdfPageNumbers,
} from "./profile";
import type { MarkdownPdfTemplateCompatibilityResult } from "./template-compatibility";

type Parse5Node = DefaultTreeAdapterTypes.Node;
type Parse5Element = DefaultTreeAdapterTypes.Element;

export type MarkdownPdfBodyBoundary = MarkdownPdfTemplateCompatibilityResult["bodyBoundary"];

export interface FinalizeMarkdownPdfPageNumberHtmlInput {
  bodyBoundary: MarkdownPdfBodyBoundary;
  html: string;
  pageNumbers: NormalizedMarkdownPdfPageNumbers;
}

function isElement(node: Parse5Node): node is Parse5Element {
  return "tagName" in node;
}

function attributeValue(node: Parse5Element, name: string): string | undefined {
  return node.attrs.find((attribute) => attribute.name === name)?.value;
}

function hasClass(node: Parse5Element, className: string): boolean {
  return attributeValue(node, "class")?.split(/\s+/u).includes(className) === true;
}

function collectActiveElements(node: Parse5Node, elements: Parse5Element[] = []): Parse5Element[] {
  if (isElement(node)) {
    elements.push(node);
  }
  if ("childNodes" in node) {
    for (const child of node.childNodes) {
      collectActiveElements(child, elements);
    }
  }
  return elements;
}

function collectReservedIdElements(
  node: Parse5Node,
  elements: Parse5Element[] = [],
): Parse5Element[] {
  if (isElement(node)) {
    if (attributeValue(node, "id") === MARKDOWN_PDF_LOGICAL_FINAL_TARGET_ID) {
      elements.push(node);
    }
    if (node.tagName === "template" && "content" in node) {
      collectReservedIdElements(node.content, elements);
    }
  }
  if ("childNodes" in node) {
    for (const child of node.childNodes) {
      collectReservedIdElements(child, elements);
    }
  }
  return elements;
}

function bodyBoundaryError(status: "missing-hook" | "duplicate-hook" | "unproven"): CliError {
  const detail =
    status === "unproven"
      ? "countFrom: body requires a proven .document-body boundary"
      : `the proven Template boundary resolved to ${status === "missing-hook" ? "no" : "multiple"} active .document-body elements after Pandoc`;
  return new CliError(`Cannot finalize Markdown PDF page numbering: ${detail}.`, {
    code: "MARKDOWN_PDF_BODY_BOUNDARY_REQUIRED",
    exitCode: 2,
  });
}

function logicalTargetConflictError(): CliError {
  return new CliError(
    `Cannot finalize Markdown PDF page numbering because the reserved logical-final target ID "${MARKDOWN_PDF_LOGICAL_FINAL_TARGET_ID}" already exists in the rendered HTML.`,
    {
      code: "MARKDOWN_PDF_LOGICAL_TARGET_CONFLICT",
      exitCode: 2,
    },
  );
}

function appendLogicalFinalTarget(parent: Parse5Element): void {
  const target = defaultTreeAdapter.createElement("span", parent.namespaceURI, [
    { name: "id", value: MARKDOWN_PDF_LOGICAL_FINAL_TARGET_ID },
    { name: "aria-hidden", value: "true" },
  ]);
  defaultTreeAdapter.appendChild(parent, target);
}

/**
 * Finalizes renderer-owned page-number HTML after Pandoc and optional code
 * highlighting. Disabled page numbers deliberately preserve the HTML bytes.
 */
export function finalizeMarkdownPdfPageNumberHtml(
  input: FinalizeMarkdownPdfPageNumberHtmlInput,
): string {
  if (!input.pageNumbers.enabled) {
    return input.html;
  }

  const document = parse(input.html);
  if (collectReservedIdElements(document).length > 0) {
    throw logicalTargetConflictError();
  }

  const activeElements = collectActiveElements(document);
  const bodyElements = activeElements.filter((element) => element.tagName === "body");
  const documentBodyElements = activeElements.filter((element) =>
    hasClass(element, "document-body"),
  );

  if (input.pageNumbers.countFrom === "body" && input.bodyBoundary !== "proven") {
    throw bodyBoundaryError("unproven");
  }
  if (input.bodyBoundary === "proven" && documentBodyElements.length !== 1) {
    throw bodyBoundaryError(documentBodyElements.length === 0 ? "missing-hook" : "duplicate-hook");
  }

  if (!markdownPdfPageNumberFormatTokens(input.pageNumbers.format).includes("pages")) {
    return input.html;
  }

  const targetParent =
    input.pageNumbers.countFrom === "body" ? documentBodyElements[0] : bodyElements[0];
  if (!targetParent) {
    throw bodyBoundaryError("missing-hook");
  }

  appendLogicalFinalTarget(targetParent);
  return serialize(document);
}
