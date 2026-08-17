import type { MarkdownPdfPageChromeFontWeight, MarkdownPdfPageChromeSeparatorStyle } from "./types";
import {
  MARKDOWN_PDF_PAGE_CHROME_FONT_WEIGHTS,
  MARKDOWN_PDF_PAGE_CHROME_SEPARATOR_STYLES,
} from "./types";

const SIX_DIGIT_HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

function isBoundedLength(input: {
  fractionDigits: number;
  maximum: number;
  minimum: number;
  unit: "mm" | "pt";
  value: unknown;
}): input is typeof input & { value: string } {
  if (typeof input.value !== "string") {
    return false;
  }

  const match = /^(?:(?:0|[1-9]\d*)(?:\.(\d+))?|\.(\d+))(mm|pt)$/.exec(input.value);
  if (!match || match[3] !== input.unit) {
    return false;
  }
  const fraction = match[1] ?? match[2] ?? "";
  if (fraction.length > input.fractionDigits) {
    return false;
  }

  const numericValue = Number.parseFloat(input.value);
  return numericValue >= input.minimum && numericValue <= input.maximum;
}

export function isMarkdownPdfPageChromeFontSize(value: unknown): value is string {
  return isBoundedLength({
    fractionDigits: 1,
    maximum: 12,
    minimum: 6,
    unit: "pt",
    value,
  });
}

export function isMarkdownPdfPageChromeFontWeight(
  value: unknown,
): value is MarkdownPdfPageChromeFontWeight {
  return (
    typeof value === "number" &&
    (MARKDOWN_PDF_PAGE_CHROME_FONT_WEIGHTS as readonly number[]).includes(value)
  );
}

export function isMarkdownPdfPageChromeLineHeight(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 1 && value <= 2;
}

export function isMarkdownPdfPageChromeColor(value: unknown): value is string {
  return typeof value === "string" && SIX_DIGIT_HEX_COLOR_PATTERN.test(value);
}

export function isMarkdownPdfPageChromeSeparatorWidth(value: unknown): value is string {
  return isBoundedLength({
    fractionDigits: 2,
    maximum: 2,
    minimum: 0.25,
    unit: "pt",
    value,
  });
}

export function isMarkdownPdfPageChromeSeparatorStyle(
  value: unknown,
): value is MarkdownPdfPageChromeSeparatorStyle {
  return (
    typeof value === "string" &&
    (MARKDOWN_PDF_PAGE_CHROME_SEPARATOR_STYLES as readonly string[]).includes(value)
  );
}

export function isMarkdownPdfPageChromeSeparatorGap(value: unknown): value is string | 0 {
  if (value === 0) {
    return true;
  }
  return isBoundedLength({
    fractionDigits: 1,
    maximum: 4,
    minimum: 0,
    unit: "mm",
    value,
  });
}
