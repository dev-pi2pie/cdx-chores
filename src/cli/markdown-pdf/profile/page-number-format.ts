import type { MarkdownPdfRendererCapabilityId } from "../renderer-capability-contract";

interface MarkdownPdfPageNumberFormatTokenDefinitionShape {
  introducedIn: number;
  rendererCapability?: MarkdownPdfRendererCapabilityId;
  token: string;
}

export const MARKDOWN_PDF_PAGE_NUMBER_FORMAT_TOKEN_DEFINITIONS = [
  { introducedIn: 2, token: "page" },
  {
    introducedIn: 2,
    rendererCapability: "pageNumbers.logicalFinal",
    token: "pages",
  },
  {
    introducedIn: 3,
    rendererCapability: "pageNumbers.physicalCurrent",
    token: "pdfPage",
  },
  {
    introducedIn: 3,
    rendererCapability: "pageNumbers.physicalTotal",
    token: "pdfPages",
  },
] as const satisfies readonly MarkdownPdfPageNumberFormatTokenDefinitionShape[];

export type MarkdownPdfPageNumberFormatToken =
  (typeof MARKDOWN_PDF_PAGE_NUMBER_FORMAT_TOKEN_DEFINITIONS)[number]["token"];

export type MarkdownPdfPageNumberFormatTokenDefinition = Omit<
  MarkdownPdfPageNumberFormatTokenDefinitionShape,
  "token"
> & { token: MarkdownPdfPageNumberFormatToken };

export const MARKDOWN_PDF_PAGE_NUMBER_FORMAT_TOKENS =
  MARKDOWN_PDF_PAGE_NUMBER_FORMAT_TOKEN_DEFINITIONS.map(({ token }) => token);

export const MARKDOWN_PDF_LOGICAL_PAGE_COUNTER_NAME = "cdx-markdown-pdf-logical-page";
export const MARKDOWN_PDF_LOGICAL_FINAL_TARGET_ID = "cdx-markdown-pdf-logical-final";

export type MarkdownPdfPageNumberFormatSegment =
  | { kind: "text"; value: string }
  | { kind: "token"; token: MarkdownPdfPageNumberFormatToken; value: string }
  | { key: string; kind: "metadata"; value: string };

const PAGE_NUMBER_FORMAT_TOKEN_SET = new Set<string>(MARKDOWN_PDF_PAGE_NUMBER_FORMAT_TOKENS);
const PLACEHOLDER_PATTERN = /\{([A-Za-z][A-Za-z0-9_.-]*)\}/gu;

export function isMarkdownPdfPageNumberFormatToken(
  value: string,
): value is MarkdownPdfPageNumberFormatToken {
  return PAGE_NUMBER_FORMAT_TOKEN_SET.has(value);
}

/**
 * Splits a page-number label without reinterpreting metadata placeholders.
 * Known page-number tokens are deliberately exact and case-sensitive.
 */
export function parseMarkdownPdfPageNumberFormat(
  format: string,
): MarkdownPdfPageNumberFormatSegment[] {
  const segments: MarkdownPdfPageNumberFormatSegment[] = [];
  let textStart = 0;

  for (const match of format.matchAll(PLACEHOLDER_PATTERN)) {
    const index = match.index;
    const value = match[0];
    const name = match[1];
    if (index === undefined || !value || !name) {
      continue;
    }
    if (index > textStart) {
      segments.push({ kind: "text", value: format.slice(textStart, index) });
    }
    segments.push(
      isMarkdownPdfPageNumberFormatToken(name)
        ? { kind: "token", token: name, value }
        : { key: name, kind: "metadata", value },
    );
    textStart = index + value.length;
  }

  if (textStart < format.length) {
    segments.push({ kind: "text", value: format.slice(textStart) });
  }
  return segments;
}

export function markdownPdfPageNumberFormatTokens(
  format: string,
): MarkdownPdfPageNumberFormatToken[] {
  return parseMarkdownPdfPageNumberFormat(format).flatMap((segment) =>
    segment.kind === "token" ? [segment.token] : [],
  );
}
