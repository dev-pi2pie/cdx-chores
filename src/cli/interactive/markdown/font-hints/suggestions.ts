import { rankSearchableFontFamilies } from "../../../../fonts/search-ranking";
import { collectSearchableFontFamilies } from "../../../../fonts/search-records";
import type { FontFace, SearchableFontFamily } from "../../../../fonts/types";

import {
  normalizeMarkdownPdfInteractiveFontHintFamilyName,
  normalizeMarkdownPdfInteractiveFontHintText,
} from "./text";
import type { MarkdownPdfInteractiveFontHintPreferenceChoice } from "./types";

const DEFAULT_MATCH_LIMIT = 6;

export function collectInstalledFontFamilies(faces: readonly Pick<FontFace, "family">[]): string[] {
  return collectSearchableFontFamilies(
    faces.map((face) => ({
      family: face.family,
      fullName: face.family,
    })),
  ).map((record) => record.family);
}

export function filterInstalledFontFamilies(
  families: readonly string[],
  term: string,
  limit = DEFAULT_MATCH_LIMIT,
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
  const matches = rankSearchableFontFamilies(records, input.term ?? "", DEFAULT_MATCH_LIMIT);
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
