import {
  DEFAULT_INSTALLED_FONT_MATCH_LIMIT,
  rankSearchableFontFamilies,
} from "../../../../fonts/search-ranking";
import type { FontFace, SearchableFontFamily } from "../../../../fonts/types";

import {
  compareMarkdownPdfInteractiveFontHintFamilies,
  normalizeMarkdownPdfInteractiveFontHintFamilyName,
  normalizeMarkdownPdfInteractiveFontHintText,
} from "./text";
import type { MarkdownPdfInteractiveFontHintPreferenceChoice } from "./types";

export function collectInstalledFontFamilies(faces: readonly Pick<FontFace, "family">[]): string[] {
  const seen = new Map<string, string>();

  for (const face of faces) {
    const family = normalizeMarkdownPdfInteractiveFontHintText(face.family);
    if (!family) {
      continue;
    }
    const normalized = normalizeMarkdownPdfInteractiveFontHintFamilyName(family);
    const current = seen.get(normalized);
    if (!current || compareMarkdownPdfInteractiveFontHintFamilies(family, current) < 0) {
      seen.set(normalized, family);
    }
  }

  return [...seen.values()].sort(compareMarkdownPdfInteractiveFontHintFamilies);
}

export function filterInstalledFontFamilies(
  families: readonly string[],
  term: string,
  limit = DEFAULT_INSTALLED_FONT_MATCH_LIMIT,
): string[] {
  return rankSearchableFontFamilies(
    families.map((family) => ({ family, aliases: [], fullNames: [] })),
    term,
    limit,
  );
}

export function buildMarkdownPdfInteractiveFontHintPreferenceChoices(input: {
  term?: string;
  families?: readonly string[];
  records?: readonly SearchableFontFamily[];
  current?: string;
}): MarkdownPdfInteractiveFontHintPreferenceChoice[] {
  const typedValue = input.term ?? input.current ?? "";
  const records =
    input.records ??
    (input.families ?? []).map((family) => ({ family, aliases: [], fullNames: [] }));
  const matches = rankSearchableFontFamilies(
    records,
    input.term ?? "",
    DEFAULT_INSTALLED_FONT_MATCH_LIMIT,
  );
  const normalizedTypedValue = normalizeMarkdownPdfInteractiveFontHintFamilyName(typedValue);
  const filteredMatches = matches.filter(
    (family) => normalizeMarkdownPdfInteractiveFontHintFamilyName(family) !== normalizedTypedValue,
  );

  if (!normalizeMarkdownPdfInteractiveFontHintText(typedValue)) {
    return filteredMatches;
  }

  return [
    {
      name: typedValue,
      value: typedValue,
      description: "Use the typed text as a custom font preference.",
    },
    ...filteredMatches,
  ];
}
