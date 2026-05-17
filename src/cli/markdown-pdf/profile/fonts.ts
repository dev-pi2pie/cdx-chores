import type { MarkdownPdfFontConfig, NormalizedMarkdownPdfProfile } from "./types";
import { MARKDOWN_PDF_CODE_FONT_SELECTORS } from "../code-style";

const GENERIC_FONT_FAMILIES = new Set([
  "serif",
  "sans-serif",
  "monospace",
  "cursive",
  "fantasy",
  "system-ui",
]);

function cssFontFamily(value: string): string {
  const trimmed = value.trim();
  if (GENERIC_FONT_FAMILIES.has(trimmed.toLowerCase())) {
    return trimmed;
  }
  return JSON.stringify(trimmed);
}

function fontStack(fonts: string[], generic: string): string {
  const values = fonts.map((font) => font.trim()).filter((font) => font.length > 0);
  if (!values.some((font) => font.toLowerCase() === generic)) {
    values.push(generic);
  }
  return values.map(cssFontFamily).join(", ");
}

function uniqueFonts(fonts: string[]): string[] {
  const seen = new Set<string>();
  return fonts.filter((font) => {
    const key = font.trim().toLowerCase();
    if (!key || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function languageFonts(bodyFonts: MarkdownPdfFontConfig, contentLangs: string[]): string[] {
  const configuredLangs = Object.keys(bodyFonts).filter((key) => key !== "default");
  const orderedLangs = contentLangs.length > 0 ? contentLangs : configuredLangs;
  return orderedLangs.map((lang) => bodyFonts[lang] ?? "").filter((font) => font.length > 0);
}

export function createMarkdownPdfFontCss(
  profile: NormalizedMarkdownPdfProfile | undefined,
): string {
  if (!profile) {
    return "";
  }

  const rules: string[] = [];
  const bodyDefault = profile.fonts.body.default;
  const bodyLanguageFonts = languageFonts(profile.fonts.body, profile.contentLangs);
  const bodyFonts = uniqueFonts([bodyDefault ?? "", ...bodyLanguageFonts]);
  if (bodyFonts.length > 0) {
    rules.push(`body {
  font-family: ${fontStack(bodyFonts, "serif")};
}`);
  }

  const headingDefault = profile.fonts.heading.default;
  if (headingDefault) {
    rules.push(`h1, h2, h3, h4, h5, h6 {
  font-family: ${fontStack([headingDefault], "sans-serif")};
}`);
  }

  const codeFonts = uniqueFonts([
    profile.fonts.code.default ?? "",
    profile.fonts.code.symbols ?? "",
  ]);
  if (codeFonts.length > 0) {
    rules.push(`${MARKDOWN_PDF_CODE_FONT_SELECTORS} {
  font-family: ${fontStack(codeFonts, "monospace")};
}`);
  }

  const pageChromeDefault = profile.fonts.pageChrome.default;
  if (pageChromeDefault) {
    rules.push(`@page {
  font-family: ${fontStack([pageChromeDefault], "sans-serif")};
}`);
  }

  for (const [lang, font] of Object.entries(profile.fonts.body)) {
    if (lang === "default" || !font) {
      continue;
    }
    rules.push(`:lang(${lang}) {
  font-family: ${fontStack([font, bodyDefault ?? ""], "serif")};
}`);
  }

  return rules.length > 0 ? `\n${rules.join("\n\n")}\n` : "";
}
