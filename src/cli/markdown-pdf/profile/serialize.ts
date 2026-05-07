import { stringify } from "yaml";

import type { MarkdownPdfProfileFormat } from "./types";

export function serializeMarkdownPdfProfile(
  profile: Record<string, unknown>,
  format: MarkdownPdfProfileFormat,
): string {
  if (format === "json") {
    return `${JSON.stringify(profile, null, 2)}\n`;
  }
  return stringify(profile);
}
