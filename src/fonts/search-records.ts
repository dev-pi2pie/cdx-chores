import { normalizeFontQuery } from "./matching";
import type { FontFace, SearchableFontFamily } from "./types";

function compareFontNames(left: string, right: string): number {
  const normalizedLeft = normalizeFontQuery(left);
  const normalizedRight = normalizeFontQuery(right);
  if (normalizedLeft !== normalizedRight) {
    return normalizedLeft < normalizedRight ? -1 : 1;
  }
  return left === right ? 0 : left < right ? -1 : 1;
}

function addFontName(target: Map<string, string>, value: string | undefined): void {
  const name = value?.trim();
  if (!name) {
    return;
  }
  const normalized = normalizeFontQuery(name);
  const current = target.get(normalized);
  if (!current || compareFontNames(name, current) < 0) {
    target.set(normalized, name);
  }
}

interface SearchableFontFamilyGroup {
  families: Map<string, string>;
  aliases: Map<string, string>;
  fullNames: Map<string, string>;
}

export function collectSearchableFontFamilies(
  faces: readonly Pick<FontFace, "family" | "aliases" | "fullName" | "fullNames">[],
): SearchableFontFamily[] {
  const groups = new Map<string, SearchableFontFamilyGroup>();

  for (const face of faces) {
    const normalizedFamily = normalizeFontQuery(face.family);
    if (!normalizedFamily) {
      continue;
    }
    const group = groups.get(normalizedFamily) ?? {
      families: new Map<string, string>(),
      aliases: new Map<string, string>(),
      fullNames: new Map<string, string>(),
    };
    addFontName(group.families, face.family);
    for (const alias of face.aliases ?? []) {
      addFontName(group.aliases, alias);
    }
    const reportedFullNames = face.fullNames ?? [];
    if (reportedFullNames.length === 0) {
      addFontName(group.fullNames, face.fullName);
    }
    for (const fullName of reportedFullNames) {
      addFontName(group.fullNames, fullName);
    }
    groups.set(normalizedFamily, group);
  }

  return [...groups.entries()]
    .map(([normalizedFamily, group]): SearchableFontFamily => {
      const family = [...group.families.values()].sort(compareFontNames)[0];
      if (!family) {
        throw new TypeError(`Searchable font family group ${normalizedFamily} has no family.`);
      }
      group.aliases.delete(normalizedFamily);
      return {
        family,
        aliases: [...group.aliases.values()].sort(compareFontNames),
        fullNames: [...group.fullNames.values()].sort(compareFontNames),
      };
    })
    .sort((left, right) => compareFontNames(left.family, right.family));
}
