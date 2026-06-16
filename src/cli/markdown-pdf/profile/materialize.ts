import type { NormalizedMarkdownPdfOptions } from "../validation";
import { DEFAULT_MARKDOWN_PDF_PROFILE } from "./defaults";
import type { NormalizedMarkdownPdfProfileIdentity } from "./types";

export interface CreateMarkdownPdfProfileConfigInput {
  identity?: NormalizedMarkdownPdfProfileIdentity;
}

export function createMarkdownPdfProfileConfig(
  options: NormalizedMarkdownPdfOptions,
  input: CreateMarkdownPdfProfileConfigInput = {},
): Record<string, unknown> {
  return {
    ...(input.identity ? { profile: input.identity } : {}),
    ...DEFAULT_MARKDOWN_PDF_PROFILE,
    page: {
      size: options.pageSize,
      orientation: options.orientation,
      marginTop: options.margins.top,
      marginRight: options.margins.right,
      marginBottom: options.margins.bottom,
      marginLeft: options.margins.left,
    },
    toc: {
      enabled: options.toc,
      depth: options.tocDepth,
      pageBreak: options.tocPageBreak,
    },
  };
}
