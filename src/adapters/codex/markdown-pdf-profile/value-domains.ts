import {
  MARKDOWN_PDF_ORIENTATIONS,
  MARKDOWN_PDF_PAGE_SIZES,
  MARKDOWN_PDF_TOC_PAGE_BREAKS,
} from "../../../cli/markdown-pdf/validation";
import { MARKDOWN_PDF_CODE_THEMES } from "../../../cli/markdown-pdf/profile";
import type { MarkdownPdfCodexPatchPath, MarkdownPdfCodexPatchValue } from "./types";

const MARKDOWN_PDF_COVER_STYLES = ["plain", "report"] as const;
const MARKDOWN_PDF_PAGE_NUMBER_POSITIONS = [
  "top-left",
  "top-center",
  "top-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
] as const;
const MARKDOWN_PDF_PAGE_NUMBER_SCOPES = ["body"] as const;
const MARKDOWN_PDF_METADATA_TITLE_BLOCK_MODES = ["auto", "show", "hide"] as const;

export interface MarkdownPdfCodexPatchValueDomain {
  path: MarkdownPdfCodexPatchPath;
  values: readonly string[];
}

export const MARKDOWN_PDF_CODEX_PATCH_VALUE_DOMAINS = [
  { path: "/page/size", values: MARKDOWN_PDF_PAGE_SIZES },
  { path: "/page/orientation", values: MARKDOWN_PDF_ORIENTATIONS },
  { path: "/toc/pageBreak", values: MARKDOWN_PDF_TOC_PAGE_BREAKS },
  { path: "/cover/style", values: MARKDOWN_PDF_COVER_STYLES },
  { path: "/pageNumbers/position", values: MARKDOWN_PDF_PAGE_NUMBER_POSITIONS },
  { path: "/pageNumbers/scope", values: MARKDOWN_PDF_PAGE_NUMBER_SCOPES },
  { path: "/titleBlock/metadataTitle", values: MARKDOWN_PDF_METADATA_TITLE_BLOCK_MODES },
  { path: "/code/theme", values: MARKDOWN_PDF_CODE_THEMES },
] as const satisfies readonly MarkdownPdfCodexPatchValueDomain[];

const PATCH_VALUE_DOMAINS_BY_PATH = new Map<string, readonly string[]>(
  MARKDOWN_PDF_CODEX_PATCH_VALUE_DOMAINS.map((domain) => [domain.path, domain.values]),
);

export function validateMarkdownPdfCodexPatchValueDomain(input: {
  context: string;
  path: MarkdownPdfCodexPatchPath;
  value: MarkdownPdfCodexPatchValue;
}): void {
  const values = PATCH_VALUE_DOMAINS_BY_PATH.get(input.path);
  if (!values) {
    return;
  }

  if (typeof input.value === "string" && values.includes(input.value)) {
    return;
  }

  throw new Error(
    `Markdown PDF Codex response ${input.context} for ${input.path} must be one of: ${values.join(", ")}.`,
  );
}
