import { normalizeFontQuery } from "./matching";
import { mergeSearchableFontFamilies } from "./search-records";
import type { SearchableFontFamily } from "./types";

const FONT_SEARCH_MATCH_RANK = {
  exact: 0,
  prefix: 1,
  tokenPrefix: 2,
  substring: 3,
  orderedSubsequence: 4,
} as const;

const FONT_SEARCH_FIELD_RANK = {
  family: 0,
  alias: 1,
  fullName: 2,
} as const;

const MIN_COMPACT_QUERY_LENGTH = 2;
const MIN_ORDERED_SUBSEQUENCE_QUERY_LENGTH = 3;
export const DEFAULT_INSTALLED_FONT_MATCH_LIMIT = 6;

interface FontSearchScore {
  matchRank: number;
  fieldRank: number;
  start: number;
  gaps: number;
  matchedName: string;
}

interface RankedSearchableFontFamily {
  record: SearchableFontFamily;
  score: FontSearchScore;
}

function compactFontName(value: string): string {
  return value.replace(/\s+/g, "");
}

function fontNameInitials(tokens: readonly string[]): string {
  return tokens.map((token) => token[0] ?? "").join("");
}

function compareText(left: string, right: string): number {
  return left === right ? 0 : left < right ? -1 : 1;
}

function orderedTokenPrefixScore(
  queryTokens: readonly string[],
  candidateTokens: readonly string[],
): { start: number; gaps: number } | undefined {
  let candidateIndex = 0;
  let firstMatch = -1;
  let previousMatch = -1;
  let gaps = 0;

  for (const queryToken of queryTokens) {
    let matchedIndex = -1;
    while (candidateIndex < candidateTokens.length) {
      const candidateToken = candidateTokens[candidateIndex];
      if (candidateToken?.startsWith(queryToken)) {
        matchedIndex = candidateIndex;
        candidateIndex += 1;
        break;
      }
      candidateIndex += 1;
    }
    if (matchedIndex < 0) {
      return undefined;
    }
    if (firstMatch < 0) {
      firstMatch = matchedIndex;
    } else {
      gaps += matchedIndex - previousMatch - 1;
    }
    previousMatch = matchedIndex;
  }

  return { start: firstMatch, gaps };
}

function orderedSubsequenceScore(
  query: string,
  candidate: string,
): { start: number; gaps: number } | undefined {
  let candidateIndex = 0;
  let firstMatch = -1;
  let previousMatch = -1;
  let gaps = 0;

  for (const character of query) {
    const matchedIndex = candidate.indexOf(character, candidateIndex);
    if (matchedIndex < 0) {
      return undefined;
    }
    if (firstMatch < 0) {
      firstMatch = matchedIndex;
    } else {
      gaps += matchedIndex - previousMatch - 1;
    }
    previousMatch = matchedIndex;
    candidateIndex = matchedIndex + 1;
  }

  return { start: firstMatch, gaps };
}

function scoreFontName(
  query: string,
  name: string,
  fieldRank: number,
): FontSearchScore | undefined {
  const candidate = normalizeFontQuery(name);
  if (!candidate) {
    return undefined;
  }
  const compactQuery = compactFontName(query);
  const compactCandidate = compactFontName(candidate);
  const base = {
    fieldRank,
    matchedName: candidate,
  };

  if (candidate === query) {
    return { ...base, matchRank: FONT_SEARCH_MATCH_RANK.exact, start: 0, gaps: 0 };
  }
  if (
    candidate.startsWith(query) ||
    (compactQuery.length >= MIN_COMPACT_QUERY_LENGTH && compactCandidate.startsWith(compactQuery))
  ) {
    return { ...base, matchRank: FONT_SEARCH_MATCH_RANK.prefix, start: 0, gaps: 0 };
  }

  const queryTokens = query.split(" ");
  const candidateTokens = candidate.split(" ");
  const tokenPrefix = orderedTokenPrefixScore(queryTokens, candidateTokens);
  if (tokenPrefix) {
    return {
      ...base,
      matchRank: FONT_SEARCH_MATCH_RANK.tokenPrefix,
      ...tokenPrefix,
    };
  }
  if (
    queryTokens.length === 1 &&
    compactQuery.length >= MIN_COMPACT_QUERY_LENGTH &&
    fontNameInitials(candidateTokens).startsWith(compactQuery)
  ) {
    return {
      ...base,
      matchRank: FONT_SEARCH_MATCH_RANK.tokenPrefix,
      start: 0,
      gaps: 0,
    };
  }

  const substringStart = candidate.includes(query)
    ? candidate.indexOf(query)
    : compactQuery.length >= MIN_COMPACT_QUERY_LENGTH
      ? compactCandidate.indexOf(compactQuery)
      : -1;
  if (substringStart >= 0) {
    return {
      ...base,
      matchRank: FONT_SEARCH_MATCH_RANK.substring,
      start: substringStart,
      gaps: 0,
    };
  }

  if (compactQuery.length < MIN_ORDERED_SUBSEQUENCE_QUERY_LENGTH) {
    return undefined;
  }
  const subsequence = orderedSubsequenceScore(compactQuery, compactCandidate);
  return subsequence
    ? {
        ...base,
        matchRank: FONT_SEARCH_MATCH_RANK.orderedSubsequence,
        ...subsequence,
      }
    : undefined;
}

function compareScores(left: FontSearchScore, right: FontSearchScore): number {
  return (
    left.matchRank - right.matchRank ||
    left.fieldRank - right.fieldRank ||
    left.start - right.start ||
    left.gaps - right.gaps ||
    compareText(left.matchedName, right.matchedName)
  );
}

function bestRecordScore(record: SearchableFontFamily, query: string): FontSearchScore | undefined {
  const candidates = [
    scoreFontName(query, record.family, FONT_SEARCH_FIELD_RANK.family),
    ...record.aliases.map((alias) => scoreFontName(query, alias, FONT_SEARCH_FIELD_RANK.alias)),
    ...record.fullNames.map((fullName) =>
      scoreFontName(query, fullName, FONT_SEARCH_FIELD_RANK.fullName),
    ),
  ].filter((score): score is FontSearchScore => score !== undefined);
  return candidates.sort(compareScores)[0];
}

function compareRankedFamilies(
  left: RankedSearchableFontFamily,
  right: RankedSearchableFontFamily,
): number {
  return (
    compareScores(left.score, right.score) ||
    compareText(normalizeFontQuery(left.record.family), normalizeFontQuery(right.record.family)) ||
    compareText(left.record.family, right.record.family)
  );
}

export function rankSearchableFontFamilies(
  records: readonly SearchableFontFamily[],
  term: string,
  limit = DEFAULT_INSTALLED_FONT_MATCH_LIMIT,
): string[] {
  if (!Number.isInteger(limit) || limit < 0) {
    throw new TypeError("Installed font match limit must be a non-negative integer.");
  }
  const grouped = mergeSearchableFontFamilies(records);
  const query = normalizeFontQuery(term);
  if (!query) {
    return grouped.slice(0, limit).map((record) => record.family);
  }

  return grouped
    .flatMap((record): RankedSearchableFontFamily[] => {
      const score = bestRecordScore(record, query);
      return score ? [{ record, score }] : [];
    })
    .sort(compareRankedFamilies)
    .slice(0, limit)
    .map(({ record }) => record.family);
}
