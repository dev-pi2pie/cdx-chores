import type { FontFace } from "../../../../fonts";

import { compareMarkdownPdfInteractiveFontHintFamilies } from "./text";
import {
  normalizeMarkdownPdfInteractiveFontHintFamilyName,
  normalizeMarkdownPdfInteractiveFontHintText,
} from "./text";
import type { MarkdownPdfInteractiveFontHintPreferenceChoice } from "./types";

const DEFAULT_MATCH_LIMIT = 6;

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
  limit = DEFAULT_MATCH_LIMIT,
): string[] {
  const normalizedTerm = normalizeMarkdownPdfInteractiveFontHintFamilyName(term);
  const matching = normalizedTerm
    ? families.filter((family) =>
        normalizeMarkdownPdfInteractiveFontHintFamilyName(family).includes(normalizedTerm),
      )
    : [...families];
  return matching.slice(0, limit);
}

export function buildMarkdownPdfInteractiveFontHintPreferenceChoices(input: {
  term?: string;
  families: readonly string[];
  current?: string;
}): MarkdownPdfInteractiveFontHintPreferenceChoice[] {
  const typedValue = input.term ?? input.current ?? "";
  const matches = filterInstalledFontFamilies(input.families, input.term ?? "");
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
