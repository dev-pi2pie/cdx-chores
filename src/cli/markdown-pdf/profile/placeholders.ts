import type { MarkdownPdfMetadata } from "./types";

export function resolveMarkdownPdfPlaceholderText(
  value: string,
  metadata: MarkdownPdfMetadata,
): string {
  return value.replace(/\{([A-Za-z][A-Za-z0-9_.-]*)\}/g, (_match, key: string) => {
    return metadata[key] ?? "";
  });
}
