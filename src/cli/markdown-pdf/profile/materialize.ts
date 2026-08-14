import type { NormalizedMarkdownPdfOptions } from "../validation";
import { DEFAULT_MARKDOWN_PDF_PROFILE } from "./defaults";
import { MARKDOWN_PDF_PROFILE_CURRENT_REVISION } from "./feature-registry";
import type { NormalizedMarkdownPdfProfileIdentity } from "./types";

export interface CreateMarkdownPdfProfileConfigInput {
  identity?: NormalizedMarkdownPdfProfileIdentity;
}

export function createMarkdownPdfProfileConfig(
  options: NormalizedMarkdownPdfOptions,
  input: CreateMarkdownPdfProfileConfigInput = {},
): Record<string, unknown> {
  return {
    schemaVersion: MARKDOWN_PDF_PROFILE_CURRENT_REVISION,
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
