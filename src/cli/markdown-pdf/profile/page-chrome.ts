import type {
  MarkdownPdfPageChromePosition,
  NormalizedMarkdownPdfPageChromeStyle,
  NormalizedMarkdownPdfProfile,
} from "./types";
import {
  MARKDOWN_PDF_LOGICAL_FINAL_TARGET_ID,
  MARKDOWN_PDF_LOGICAL_PAGE_COUNTER_NAME,
  parseMarkdownPdfPageNumberFormat,
} from "./page-number-format";

export type MarkdownPdfPageChromeBodyBoundary =
  | "not-required"
  | "proven"
  | "legacy-document-origin-fallback";

export interface CreateMarkdownPdfPageChromeCssInput {
  bodyBoundary?: MarkdownPdfPageChromeBodyBoundary;
}

function cssString(value: string): string {
  return JSON.stringify(value);
}

function cssContentFromTemplate(value: string, metadata: Record<string, string>): string {
  const tokens = parseMarkdownPdfPageNumberFormat(value).flatMap((segment) => {
    if (segment.kind === "text") {
      return segment.value ? [cssString(segment.value)] : [];
    }
    if (segment.kind === "metadata") {
      const replacement = metadata[segment.key] ?? "";
      return replacement ? [cssString(replacement)] : [];
    }
    switch (segment.token) {
      case "page":
        return [`counter(${MARKDOWN_PDF_LOGICAL_PAGE_COUNTER_NAME})`];
      case "pages":
        return [
          `target-counter(url("#${MARKDOWN_PDF_LOGICAL_FINAL_TARGET_ID}"), ${MARKDOWN_PDF_LOGICAL_PAGE_COUNTER_NAME})`,
        ];
      case "pdfPage":
        return ["counter(page)"];
      case "pdfPages":
        return ["counter(pages)"];
    }
  });

  return tokens.length > 0 ? tokens.join(" ") : cssString("");
}

export function resolveMarkdownPdfPageNumberSlot(position: MarkdownPdfPageChromePosition): {
  area: "header" | "footer";
  slot: "left" | "center" | "right";
} {
  const [area, slot] = position.split("-") as ["top" | "bottom", "left" | "center" | "right"];
  return {
    area: area === "top" ? "header" : "footer",
    slot,
  };
}

function emptyMarginBoxes(): string {
  return `  @top-left {
    content: none;
  }

  @top-center {
    content: none;
  }

  @top-right {
    content: none;
  }

  @bottom-left {
    content: none;
  }

  @bottom-center {
    content: none;
  }

  @bottom-right {
    content: none;
  }`;
}

function marginBoxRule(
  cssArea: "top" | "bottom",
  slot: "left" | "center" | "right",
  value: string,
  metadata: Record<string, string>,
  style?: NormalizedMarkdownPdfPageChromeStyle,
): string {
  const declarations: string[] = [];
  if (style?.fontSize !== undefined) {
    declarations.push(`font-size: ${style.fontSize};`);
  }
  if (style?.fontWeight !== undefined) {
    declarations.push(`font-weight: ${style.fontWeight};`);
  }
  if (style?.lineHeight !== undefined) {
    declarations.push(`line-height: ${style.lineHeight};`);
  }
  if (style?.color !== undefined) {
    declarations.push(`color: ${style.color};`);
  }

  const separator = style?.separator;
  const separatorSide = cssArea === "top" ? "bottom" : "top";
  if (separator?.width !== undefined) {
    declarations.push(`border-${separatorSide}-width: ${separator.width};`);
  }
  if (separator?.style !== undefined) {
    declarations.push(`border-${separatorSide}-style: ${separator.style};`);
  }
  if (separator?.color !== undefined) {
    declarations.push(`border-${separatorSide}-color: ${separator.color};`);
  }
  if (separator?.gap !== undefined) {
    declarations.push(`padding-${separatorSide}: ${separator.gap};`);
  }

  const styleCss = declarations.map((declaration) => `    ${declaration}`).join("\n");
  return `  @${cssArea}-${slot} {
    content: ${cssContentFromTemplate(value, metadata)};${styleCss ? `\n${styleCss}` : ""}
  }`;
}

function pageRule(selector: string, declarations: string[], marginBoxes: string[]): string {
  const content = [...declarations.map((declaration) => `  ${declaration}`), ...marginBoxes].join(
    "\n\n",
  );
  const suffix = !selector ? "" : selector.startsWith(":") ? selector : ` ${selector}`;
  return `@page${suffix} {
${content}
}`;
}

export function createMarkdownPdfPageChromeCss(
  profile: NormalizedMarkdownPdfProfile | undefined,
  input: CreateMarkdownPdfPageChromeCssInput = {},
): string {
  if (!profile) {
    return "";
  }

  const pageNumbers = profile.pageNumbers;
  const bodyBoundary = input.bodyBoundary ?? "proven";
  if (
    pageNumbers.enabled &&
    pageNumbers.countFrom === "body" &&
    bodyBoundary === "legacy-document-origin-fallback"
  ) {
    throw new Error(
      "Markdown PDF page-chrome invariant violated: legacy document-origin fallback cannot satisfy countFrom: body.",
    );
  }
  const usesLegacyDocumentVisibility =
    pageNumbers.enabled &&
    pageNumbers.scope === "body" &&
    bodyBoundary === "legacy-document-origin-fallback";
  const usesProvenBodyVisibility =
    pageNumbers.enabled && pageNumbers.scope === "body" && !usesLegacyDocumentVisibility;
  const usesDocumentVisibility =
    pageNumbers.enabled && (pageNumbers.scope === "document" || usesLegacyDocumentVisibility);
  const numberTarget = pageNumbers.enabled
    ? resolveMarkdownPdfPageNumberSlot(pageNumbers.position)
    : undefined;
  const slots = {
    header: { ...profile.header },
    footer: { ...profile.footer },
  };
  if (numberTarget) {
    // The selected slot remains page-number-owned even when body visibility
    // keeps its content off pre-body pages.
    slots[numberTarget.area][numberTarget.slot] = usesDocumentVisibility ? pageNumbers.format : "";
  }

  const genericMarginBoxes: string[] = [];
  const pageAreas = [
    ["header", "top"],
    ["footer", "bottom"],
  ] as const;
  const pageSlots = ["left", "center", "right"] as const;

  for (const [area, cssArea] of pageAreas) {
    for (const slot of pageSlots) {
      const value = slots[area][slot];
      if (!value) {
        continue;
      }
      genericMarginBoxes.push(
        marginBoxRule(cssArea, slot, value, profile.metadata, slots[area].style),
      );
    }
  }

  const genericDeclarations =
    pageNumbers.enabled && pageNumbers.countFrom === "document"
      ? [`counter-increment: ${MARKDOWN_PDF_LOGICAL_PAGE_COUNTER_NAME} ${pageNumbers.increment};`]
      : [];
  const generatedRules: string[] = [];

  if (genericDeclarations.length > 0 || genericMarginBoxes.length > 0) {
    generatedRules.push(pageRule("", genericDeclarations, genericMarginBoxes));
  }

  if (pageNumbers.enabled && pageNumbers.countFrom === "document") {
    generatedRules.push(
      pageRule(
        ":nth(1)",
        [
          `counter-reset: ${MARKDOWN_PDF_LOGICAL_PAGE_COUNTER_NAME} ${pageNumbers.start - pageNumbers.increment};`,
        ],
        [],
      ),
    );
  }

  if (usesProvenBodyVisibility || (pageNumbers.enabled && pageNumbers.countFrom === "body")) {
    const bodyDeclarations =
      pageNumbers.enabled && pageNumbers.countFrom === "body"
        ? [`counter-increment: ${MARKDOWN_PDF_LOGICAL_PAGE_COUNTER_NAME} ${pageNumbers.increment};`]
        : [];
    const bodyMarginBoxes =
      usesProvenBodyVisibility && numberTarget
        ? [
            marginBoxRule(
              numberTarget.area === "header" ? "top" : "bottom",
              numberTarget.slot,
              pageNumbers.format,
              profile.metadata,
              slots[numberTarget.area].style,
            ),
          ]
        : [];
    generatedRules.push(pageRule("body", bodyDeclarations, bodyMarginBoxes));

    if (pageNumbers.enabled && pageNumbers.countFrom === "body") {
      generatedRules.push(
        pageRule(
          "body:nth(1 of body)",
          [
            `counter-reset: ${MARKDOWN_PDF_LOGICAL_PAGE_COUNTER_NAME} ${pageNumbers.start - pageNumbers.increment};`,
          ],
          [],
        ),
      );
    }
    generatedRules.push(".document-body {\n  page: body;\n}");
  }

  if (generatedRules.length === 0) {
    return "";
  }

  const tocMarginBoxes = [emptyMarginBoxes(), ...genericMarginBoxes];
  generatedRules.push(pageRule("toc", [], tocMarginBoxes));

  return `\n${generatedRules.join("\n\n")}\n`;
}

export { emptyMarginBoxes as createMarkdownPdfEmptyMarginBoxesCss };
