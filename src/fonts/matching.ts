import type { FontFace } from "./types";

interface MatchedFontFace {
  face: FontFace;
  matchRank: number;
}

const FIRST_LOOSE_MATCH_RANK = 2;

export type FontCheckFaceSelectionReason = "no-matching-family" | "ambiguous-family";

export type FontCheckFaceSelection =
  | { status: "selected"; face: FontFace }
  | { status: "inconclusive"; reason: FontCheckFaceSelectionReason };

export function normalizeFontQuery(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export function fontFamilyMatchRank(
  face: FontFace,
  family: string | undefined,
): number | undefined {
  if (!family) {
    return 0;
  }
  const needle = normalizeFontQuery(family);
  const faceFamily = normalizeFontQuery(face.family);
  const fullName = normalizeFontQuery(face.fullName);

  if (faceFamily === needle) {
    return 0;
  }
  if (fullName === needle) {
    return 1;
  }
  if (faceFamily.includes(needle)) {
    return 2;
  }
  if (fullName.includes(needle)) {
    return 3;
  }
  return undefined;
}

export function matchesFontFamily(face: FontFace, family: string | undefined): boolean {
  return fontFamilyMatchRank(face, family) !== undefined;
}

export function uniqueFontFaces(faces: FontFace[]): FontFace[] {
  const seen = new Set<string>();
  return faces.filter((face) => {
    // Provider metadata is part of identity so separate faces in a TTC collection are not collapsed.
    const key = [
      face.family,
      face.fullName,
      face.style,
      face.weight ?? "",
      face.path ?? "",
      face.format ?? "",
      face.faceIndex ?? "",
    ]
      .join("\0")
      .toLowerCase();
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export function sortFontFaces(left: FontFace, right: FontFace): number {
  return (
    left.family.localeCompare(right.family) ||
    left.fullName.localeCompare(right.fullName) ||
    left.style.localeCompare(right.style) ||
    (left.weight ?? Number.MAX_SAFE_INTEGER) - (right.weight ?? Number.MAX_SAFE_INTEGER) ||
    (left.path ?? "").localeCompare(right.path ?? "")
  );
}

function compareFontProviderMetadata(left: FontFace, right: FontFace): number {
  return (left.faceIndex ?? Number.MAX_SAFE_INTEGER) - (right.faceIndex ?? Number.MAX_SAFE_INTEGER);
}

export function inspectFontFaces(faces: FontFace[], family: string): FontFace[] {
  const matched = uniqueFontFaces(faces).flatMap((face): MatchedFontFace[] => {
    const matchRank = fontFamilyMatchRank(face, family);
    return matchRank === undefined ? [] : [{ face, matchRank }];
  });

  return matched
    .sort(
      (left, right) =>
        left.matchRank - right.matchRank ||
        sortFontFaces(left.face, right.face) ||
        compareFontProviderMetadata(left.face, right.face),
    )
    .map((match) => match.face);
}

function fontPathFormat(path: string): string | undefined {
  const match = /\.([a-z0-9]+)$/i.exec(path);
  return match?.[1]?.toLowerCase();
}

function hasCoverageInspectablePath(face: FontFace): boolean {
  if (!face.path) {
    return false;
  }
  const format = face.format ?? fontPathFormat(face.path);
  return format === "ttf" || format === "otf";
}

function hasAnyPath(face: FontFace): boolean {
  return Boolean(face.path);
}

function styleRank(face: FontFace): number {
  return face.style === "normal" ? 0 : 1;
}

function weightDistance(face: FontFace): number {
  return Math.abs((face.weight ?? 400) - 400);
}

function preferTrue(left: boolean, right: boolean): number {
  return Number(right) - Number(left);
}

function compareFontCheckSelection(left: MatchedFontFace, right: MatchedFontFace): number {
  const comparisons = [
    left.matchRank - right.matchRank,
    preferTrue(hasCoverageInspectablePath(left.face), hasCoverageInspectablePath(right.face)),
    preferTrue(hasAnyPath(left.face), hasAnyPath(right.face)),
    styleRank(left.face) - styleRank(right.face),
    weightDistance(left.face) - weightDistance(right.face),
    (left.face.weight ?? 400) - (right.face.weight ?? 400),
    left.face.fullName.localeCompare(right.face.fullName),
    (left.face.path ?? "").localeCompare(right.face.path ?? ""),
    compareFontProviderMetadata(left.face, right.face),
  ];
  return comparisons.find((comparison) => comparison !== 0) ?? 0;
}

function familyGroupCount(matches: MatchedFontFace[]): number {
  return new Set(matches.map((match) => normalizeFontQuery(match.face.family))).size;
}

function matchedFontFaces(faces: FontFace[], family: string): MatchedFontFace[] {
  return uniqueFontFaces(faces).flatMap((face): MatchedFontFace[] => {
    const matchRank = fontFamilyMatchRank(face, family);
    return matchRank === undefined ? [] : [{ face, matchRank }];
  });
}

function bestMatchRank(matches: MatchedFontFace[]): number {
  return Math.min(...matches.map((match) => match.matchRank));
}

function hasAmbiguousLooseFamilyMatch(matches: MatchedFontFace[], matchRank: number): boolean {
  if (matchRank < FIRST_LOOSE_MATCH_RANK) {
    return false;
  }
  const bestMatches = matches.filter((match) => match.matchRank === matchRank);
  return familyGroupCount(bestMatches) > 1;
}

export function selectFontFaceForCheck(faces: FontFace[], family: string): FontCheckFaceSelection {
  const matched = matchedFontFaces(faces, family);

  if (matched.length === 0) {
    return { status: "inconclusive", reason: "no-matching-family" };
  }

  const matchRank = bestMatchRank(matched);
  if (hasAmbiguousLooseFamilyMatch(matched, matchRank)) {
    return { status: "inconclusive", reason: "ambiguous-family" };
  }

  const selected = matched.sort(compareFontCheckSelection)[0];
  if (!selected) {
    return { status: "inconclusive", reason: "no-matching-family" };
  }
  return { status: "selected", face: selected.face };
}
