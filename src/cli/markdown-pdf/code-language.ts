import { bundledLanguages, bundledLanguagesInfo, type BundledLanguage } from "shiki";

const STRUCTURAL_CODE_CLASSES = new Set(["numberLines", "numberSource", "sourceCode"]);

const SHIKI_LANGUAGE_BY_TOKEN = new Map<string, BundledLanguage>();

for (const language of bundledLanguagesInfo) {
  const languageId = language.id as BundledLanguage;
  SHIKI_LANGUAGE_BY_TOKEN.set(language.id.toLowerCase(), languageId);
  for (const alias of language.aliases ?? []) {
    SHIKI_LANGUAGE_BY_TOKEN.set(alias.toLowerCase(), languageId);
  }
}

for (const language of Object.keys(bundledLanguages) as BundledLanguage[]) {
  const key = language.toLowerCase();
  if (!SHIKI_LANGUAGE_BY_TOKEN.has(key)) {
    SHIKI_LANGUAGE_BY_TOKEN.set(key, language);
  }
}

export function normalizeMarkdownPdfShikiLanguage(
  language: string | undefined,
): BundledLanguage | undefined {
  const key = language?.trim().toLowerCase();
  if (!key) {
    return undefined;
  }
  return SHIKI_LANGUAGE_BY_TOKEN.get(key);
}

export function isMarkdownPdfCodeStructuralClass(className: string): boolean {
  return STRUCTURAL_CODE_CLASSES.has(className);
}
