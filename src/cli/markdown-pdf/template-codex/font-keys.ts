import type { MarkdownPdfTemplateCodexFontRole } from "./types";

function canonicalizeLanguageTag(tag: string): string {
  return tag
    .split("-")
    .map((part, index) => {
      if (index === 0) {
        return part.toLowerCase();
      }
      if (/^[A-Za-z]{4}$/u.test(part)) {
        return `${part[0]?.toUpperCase() ?? ""}${part.slice(1).toLowerCase()}`;
      }
      if (/^(?:[A-Za-z]{2}|\d{3})$/u.test(part)) {
        return part.toUpperCase();
      }
      return part.toLowerCase();
    })
    .join("-");
}

export function canonicalizeMdPdfTemplateFontKey(
  role: MarkdownPdfTemplateCodexFontRole,
  key: string,
): string {
  if (role !== "body" || key === "default") {
    return key;
  }
  return canonicalizeLanguageTag(key);
}
