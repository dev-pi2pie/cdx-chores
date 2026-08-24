import { expect } from "bun:test";

import {
  createMarkdownPdfPageChromeCss,
  normalizeMarkdownPdfProfile,
} from "../../../src/cli/markdown-pdf";
import {
  MARKDOWN_PDF_LOGICAL_FINAL_TARGET_ID,
  MARKDOWN_PDF_LOGICAL_PAGE_COUNTER_NAME,
} from "../../../src/cli/markdown-pdf/profile/page-number-format";

export const logicalCurrent = `counter(${MARKDOWN_PDF_LOGICAL_PAGE_COUNTER_NAME})`;
export const logicalFinal = `target-counter(url("#${MARKDOWN_PDF_LOGICAL_FINAL_TARGET_ID}"), ${MARKDOWN_PDF_LOGICAL_PAGE_COUNTER_NAME})`;

export function pageChromeCss(
  pageNumbers: Record<string, unknown>,
  input: Parameters<typeof createMarkdownPdfPageChromeCss>[1] = {},
  profile: Record<string, unknown> = {},
): string {
  const normalized = normalizeMarkdownPdfProfile({
    profile: { ...profile, pageNumbers },
  }).profile;
  return createMarkdownPdfPageChromeCss(normalized, input);
}

export function namedPageRule(css: string, selector: string): string {
  const start = css.indexOf(`@page ${selector} {`);
  expect(start).toBeGreaterThanOrEqual(0);
  const nextRule = css.indexOf("\n@page ", start + 1);
  const nextSelector = css.indexOf("\n.document-body", start + 1);
  const candidates = [nextRule, nextSelector].filter((index) => index >= 0);
  const end = candidates.length > 0 ? Math.min(...candidates) : css.length;
  return css.slice(start, end);
}
