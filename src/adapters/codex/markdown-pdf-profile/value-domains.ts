import {
  MARKDOWN_PDF_ORIENTATIONS,
  MARKDOWN_PDF_PAGE_SIZES,
  MARKDOWN_PDF_TOC_PAGE_BREAKS,
} from "../../../cli/markdown-pdf/validation";
import {
  MARKDOWN_PDF_CODE_THEMES,
  MARKDOWN_PDF_PAGE_CHROME_POSITIONS,
  MARKDOWN_PDF_PAGE_CHROME_FONT_WEIGHTS,
  MARKDOWN_PDF_PAGE_CHROME_SEPARATOR_STYLES,
  MARKDOWN_PDF_PAGE_NUMBER_COUNT_ORIGINS,
  MARKDOWN_PDF_PAGE_NUMBER_SCOPES,
  isMarkdownPdfPageChromeColor,
  isMarkdownPdfPageChromeFontSize,
  isMarkdownPdfPageChromeLineHeight,
  isMarkdownPdfPageChromeSeparatorGap,
  isMarkdownPdfPageChromeSeparatorWidth,
} from "../../../cli/markdown-pdf/profile";
import type { MarkdownPdfCodexPatchPath, MarkdownPdfCodexPatchValue } from "./types";

const MARKDOWN_PDF_COVER_STYLES = ["plain", "report"] as const;
const MARKDOWN_PDF_METADATA_TITLE_BLOCK_MODES = ["auto", "show", "hide"] as const;

export interface MarkdownPdfCodexPatchValueDomain {
  path: MarkdownPdfCodexPatchPath;
  values: readonly (string | number)[];
}

export const MARKDOWN_PDF_CODEX_PATCH_VALUE_DOMAINS = [
  { path: "/page/size", values: MARKDOWN_PDF_PAGE_SIZES },
  { path: "/page/orientation", values: MARKDOWN_PDF_ORIENTATIONS },
  { path: "/toc/pageBreak", values: MARKDOWN_PDF_TOC_PAGE_BREAKS },
  { path: "/cover/style", values: MARKDOWN_PDF_COVER_STYLES },
  { path: "/pageNumbers/position", values: MARKDOWN_PDF_PAGE_CHROME_POSITIONS },
  { path: "/pageNumbers/scope", values: MARKDOWN_PDF_PAGE_NUMBER_SCOPES },
  { path: "/pageNumbers/countFrom", values: MARKDOWN_PDF_PAGE_NUMBER_COUNT_ORIGINS },
  { path: "/header/style/fontWeight", values: MARKDOWN_PDF_PAGE_CHROME_FONT_WEIGHTS },
  {
    path: "/header/style/separator/style",
    values: MARKDOWN_PDF_PAGE_CHROME_SEPARATOR_STYLES,
  },
  { path: "/footer/style/fontWeight", values: MARKDOWN_PDF_PAGE_CHROME_FONT_WEIGHTS },
  {
    path: "/footer/style/separator/style",
    values: MARKDOWN_PDF_PAGE_CHROME_SEPARATOR_STYLES,
  },
  { path: "/titleBlock/metadataTitle", values: MARKDOWN_PDF_METADATA_TITLE_BLOCK_MODES },
  { path: "/code/theme", values: MARKDOWN_PDF_CODE_THEMES },
] as const satisfies readonly MarkdownPdfCodexPatchValueDomain[];

export interface MarkdownPdfCodexPatchValueConstraint {
  path: MarkdownPdfCodexPatchPath;
  requirement: string;
}

export const MARKDOWN_PDF_CODEX_PATCH_VALUE_CONSTRAINTS = [
  { path: "/pageNumbers/start", requirement: "a non-negative integer" },
  { path: "/pageNumbers/increment", requirement: "a positive integer" },
  {
    path: "/header/style/fontSize",
    requirement: "a pt length from 6pt through 12pt with at most one fractional digit",
  },
  { path: "/header/style/lineHeight", requirement: "a number from 1 through 2" },
  { path: "/header/style/color", requirement: "a six-digit hexadecimal color" },
  {
    path: "/header/style/separator/width",
    requirement: "a pt length from 0.25pt through 2pt with at most two fractional digits",
  },
  {
    path: "/header/style/separator/color",
    requirement: "a six-digit hexadecimal color",
  },
  {
    path: "/header/style/separator/gap",
    requirement: "0 or an mm length from 0mm through 4mm with at most one fractional digit",
  },
  {
    path: "/footer/style/fontSize",
    requirement: "a pt length from 6pt through 12pt with at most one fractional digit",
  },
  { path: "/footer/style/lineHeight", requirement: "a number from 1 through 2" },
  { path: "/footer/style/color", requirement: "a six-digit hexadecimal color" },
  {
    path: "/footer/style/separator/width",
    requirement: "a pt length from 0.25pt through 2pt with at most two fractional digits",
  },
  {
    path: "/footer/style/separator/color",
    requirement: "a six-digit hexadecimal color",
  },
  {
    path: "/footer/style/separator/gap",
    requirement: "0 or an mm length from 0mm through 4mm with at most one fractional digit",
  },
] as const satisfies readonly MarkdownPdfCodexPatchValueConstraint[];

const PATCH_VALUE_DOMAINS_BY_PATH = new Map<string, readonly (string | number)[]>(
  MARKDOWN_PDF_CODEX_PATCH_VALUE_DOMAINS.map((domain) => [domain.path, domain.values]),
);

type PatchValuePredicate = (value: unknown) => boolean;

const PATCH_VALUE_PREDICATES_BY_PATH = new Map<MarkdownPdfCodexPatchPath, PatchValuePredicate>([
  ["/header/style/fontSize", isMarkdownPdfPageChromeFontSize],
  ["/header/style/lineHeight", isMarkdownPdfPageChromeLineHeight],
  ["/header/style/color", isMarkdownPdfPageChromeColor],
  ["/header/style/separator/width", isMarkdownPdfPageChromeSeparatorWidth],
  ["/header/style/separator/color", isMarkdownPdfPageChromeColor],
  ["/header/style/separator/gap", isMarkdownPdfPageChromeSeparatorGap],
  ["/footer/style/fontSize", isMarkdownPdfPageChromeFontSize],
  ["/footer/style/lineHeight", isMarkdownPdfPageChromeLineHeight],
  ["/footer/style/color", isMarkdownPdfPageChromeColor],
  ["/footer/style/separator/width", isMarkdownPdfPageChromeSeparatorWidth],
  ["/footer/style/separator/color", isMarkdownPdfPageChromeColor],
  ["/footer/style/separator/gap", isMarkdownPdfPageChromeSeparatorGap],
]);

const PATCH_VALUE_REQUIREMENTS_BY_PATH = new Map<MarkdownPdfCodexPatchPath, string>(
  MARKDOWN_PDF_CODEX_PATCH_VALUE_CONSTRAINTS.map((constraint) => [
    constraint.path,
    constraint.requirement,
  ]),
);

export function validateMarkdownPdfCodexPatchValueDomain(input: {
  context: string;
  path: MarkdownPdfCodexPatchPath;
  value: MarkdownPdfCodexPatchValue;
}): void {
  const values = PATCH_VALUE_DOMAINS_BY_PATH.get(input.path);
  if (values) {
    if (values.includes(input.value as string | number)) {
      return;
    }
    throw new Error(
      `Markdown PDF Codex response ${input.context} for ${input.path} must be one of: ${values.join(", ")}.`,
    );
  }

  const predicate = PATCH_VALUE_PREDICATES_BY_PATH.get(input.path);
  if (!predicate || predicate(input.value)) {
    return;
  }

  const requirement = PATCH_VALUE_REQUIREMENTS_BY_PATH.get(input.path);
  throw new Error(
    `Markdown PDF Codex response ${input.context} for ${input.path} must be ${requirement}.`,
  );
}
