import { describe, expect, test } from "bun:test";
import { parse, type DefaultTreeAdapterTypes } from "parse5";

import { CliError } from "../src/cli/errors";
import { finalizeMarkdownPdfPageNumberHtml } from "../src/cli/markdown-pdf/page-number-html";
import {
  DEFAULT_NORMALIZED_MARKDOWN_PDF_PROFILE,
  MARKDOWN_PDF_LOGICAL_FINAL_TARGET_ID,
  type NormalizedMarkdownPdfPageNumbers,
} from "../src/cli/markdown-pdf/profile";

type Parse5Node = DefaultTreeAdapterTypes.Node;
type Parse5Element = DefaultTreeAdapterTypes.Element;

function pageNumbers(
  overrides: Partial<NormalizedMarkdownPdfPageNumbers> = {},
): NormalizedMarkdownPdfPageNumbers {
  return {
    ...DEFAULT_NORMALIZED_MARKDOWN_PDF_PROFILE.pageNumbers,
    enabled: true,
    ...overrides,
  };
}

function elements(node: Parse5Node, result: Parse5Element[] = []): Parse5Element[] {
  if ("tagName" in node) {
    result.push(node);
  }
  if ("childNodes" in node) {
    for (const child of node.childNodes) {
      elements(child, result);
    }
  }
  return result;
}

function attribute(node: Parse5Element, name: string): string | undefined {
  return node.attrs.find((candidate) => candidate.name === name)?.value;
}

function finalize(input: {
  bodyBoundary?: "not-required" | "proven" | "legacy-document-origin-fallback";
  format?: string;
  html: string;
  countFrom?: "body" | "document";
  enabled?: boolean;
}): string {
  return finalizeMarkdownPdfPageNumberHtml({
    bodyBoundary: input.bodyBoundary ?? "not-required",
    html: input.html,
    pageNumbers: pageNumbers({
      countFrom: input.countFrom ?? "document",
      enabled: input.enabled ?? true,
      format: input.format ?? "{pages}",
    }),
  });
}

function expectCliErrorCode(action: () => unknown, code: string): void {
  try {
    action();
    throw new Error("Expected finalization to fail");
  } catch (error) {
    expect(error).toBeInstanceOf(CliError);
    expect(error).toMatchObject({ code, exitCode: 2 });
  }
}

describe("Markdown PDF page-number HTML finalization", () => {
  test("is a byte-for-byte no-op when page numbers are disabled", () => {
    const html = `<main id="${MARKDOWN_PDF_LOGICAL_FINAL_TARGET_ID}">\n  Report\n</main>`;

    expect(
      finalize({
        bodyBoundary: "proven",
        enabled: false,
        html,
      }),
    ).toBe(html);
  });

  test.each([
    "{page}",
    "{pdfPage}",
    "{pdfPages}",
    "{page} / {pdfPages}",
    "{Pages}",
    "{pages.total}",
    "{pagesSuffix}",
  ])("does not inject a logical-final target for %s", (format) => {
    const html =
      '<!doctype html><html><body><main class="document-body">Report</main></body></html>';

    expect(finalize({ bodyBoundary: "proven", format, html })).toBe(html);
  });

  test("injects one empty hidden target as the final child of body for document origin", () => {
    const result = finalize({
      format: "{pages} / {pages}",
      html: "<!doctype html><html><body><main>Report</main>\n</body></html>",
    });
    const parsed = elements(parse(result));
    const body = parsed.find((element) => element.tagName === "body");
    const target = parsed.find(
      (element) => attribute(element, "id") === MARKDOWN_PDF_LOGICAL_FINAL_TARGET_ID,
    );

    expect(target).toBeDefined();
    expect(target?.tagName).toBe("span");
    expect(attribute(target as Parse5Element, "aria-hidden")).toBe("true");
    expect(attribute(target as Parse5Element, "style")).toBeUndefined();
    expect(target?.childNodes).toHaveLength(0);
    expect(body?.childNodes.at(-1)).toBe(target);
  });

  test("injects the target as the final child of the sole proven document body", () => {
    const result = finalize({
      bodyBoundary: "proven",
      countFrom: "body",
      html: '<html><body><main class="document-body"><p>Report</p>\n</main></body></html>',
    });
    const documentBody = elements(parse(result)).find((element) =>
      attribute(element, "class")?.split(/\s+/u).includes("document-body"),
    );
    const target = documentBody?.childNodes.at(-1);

    expect(target && "tagName" in target ? target.tagName : undefined).toBe("span");
    expect(target && "attrs" in target ? attribute(target, "id") : undefined).toBe(
      MARKDOWN_PDF_LOGICAL_FINAL_TARGET_ID,
    );
  });

  test("supports document-origin finalization for legacy HTML without a body hook", () => {
    const result = finalize({
      bodyBoundary: "legacy-document-origin-fallback",
      html: "<main>Legacy report</main>",
    });

    expect(result).toContain(`id="${MARKDOWN_PDF_LOGICAL_FINAL_TARGET_ID}"`);
  });

  test.each([
    {
      html: "<html><body><main>Report</main></body></html>",
      label: "missing",
    },
    {
      html: '<html><body><main class="document-body"></main><aside class="document-body"></aside></body></html>',
      label: "duplicate",
    },
  ])("rejects a $label post-Pandoc body promised by a proven Template", ({ html }) => {
    expectCliErrorCode(
      () => finalize({ bodyBoundary: "proven", countFrom: "body", format: "{page}", html }),
      "MARKDOWN_PDF_BODY_BOUNDARY_REQUIRED",
    );
  });

  test("rejects body-origin finalization without a proven boundary", () => {
    expectCliErrorCode(
      () =>
        finalize({
          bodyBoundary: "legacy-document-origin-fallback",
          countFrom: "body",
          format: "{pdfPage}",
          html: '<html><body><main class="document-body">Report</main></body></html>',
        }),
      "MARKDOWN_PDF_BODY_BOUNDARY_REQUIRED",
    );
  });

  test.each([
    `<span id="${MARKDOWN_PDF_LOGICAL_FINAL_TARGET_ID}"></span>`,
    `<template><span id="${MARKDOWN_PDF_LOGICAL_FINAL_TARGET_ID}"></span></template>`,
  ])("rejects a pre-existing reserved target ID", (reservedElement) => {
    expectCliErrorCode(
      () => finalize({ html: `<html><body>${reservedElement}</body></html>` }),
      "MARKDOWN_PDF_LOGICAL_TARGET_CONFLICT",
    );
  });

  test("rejects a second finalization", () => {
    const once = finalize({ html: "<html><body>Report</body></html>" });

    expectCliErrorCode(() => finalize({ html: once }), "MARKDOWN_PDF_LOGICAL_TARGET_CONFLICT");
  });
});
