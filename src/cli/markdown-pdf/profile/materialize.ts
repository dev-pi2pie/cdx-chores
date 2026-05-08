import type { NormalizedMarkdownPdfOptions } from "../validation";
import { DEFAULT_MARKDOWN_PDF_PROFILE } from "./defaults";

export function createMarkdownPdfProfileConfig(
  options: NormalizedMarkdownPdfOptions,
): Record<string, unknown> {
  return {
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
