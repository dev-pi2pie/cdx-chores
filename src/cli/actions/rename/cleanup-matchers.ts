import { slugifyName } from "../../../utils/slug";

export const CLEANUP_HINT_VALUES = ["date", "timestamp", "serial", "uid"] as const;
export type CleanupHint = (typeof CLEANUP_HINT_VALUES)[number];
export type CleanupTextStyle = "preserve" | "slug";
export type CleanupTimestampAction = "keep" | "remove";

interface CleanupTimestampMatch {
  prefix: string;
  suffix: string;
  normalizedTimestamp: string;
}

interface CleanupDateMatch {
  prefix: string;
  suffix: string;
  normalizedDate: string;
}

interface CleanupSerialMatch {
  prefix: string;
}

interface CleanupUidMatch {
  prefix: string;
  suffix: string;
}

const MACOS_TIMESTAMP_PATTERN =
  /\b(\d{4})-(\d{2})-(\d{2}) at (\d{1,2})\.(\d{2})\.(\d{2}) (AM|PM)\b/i;
const MACOS_TIMESTAMP_PATTERN_GLOBAL =
  /\b(\d{4})-(\d{2})-(\d{2}) at (\d{1,2})\.(\d{2})\.(\d{2}) (AM|PM)\b/gi;
const DATE_PATTERN_GLOBAL = /\b(\d{4})-(\d{2})-(\d{2})\b/g;

function normalizePreserveStem(value: string): string {
  const normalized = value
    .replace(/\s+/g, " ")
    .replace(/^[\s._-]+|[\s._-]+$/g, "")
    .trim();
  return normalized || "file";
}

function trimCleanupFragmentEdges(value: string): string {
  return value.replace(/^[\s._-]+|[\s._-]+$/g, "").trim();
}

function formatCleanupTimestamp(
  year: string,
  month: string,
  day: string,
  hourText: string,
  minute: string,
  second: string,
  meridiem: string,
): string {
  const hour12 = Number(hourText);
  const normalizedMeridiem = meridiem.toUpperCase();
  const hour24 = normalizedMeridiem === "PM" ? (hour12 % 12) + 12 : hour12 % 12;
  return `${year}${month}${day}-${String(hour24).padStart(2, "0")}${minute}${second}`;
}

function buildNoMatchReason(hints: CleanupHint[]): string {
  if (hints.length === 0) {
    return "no supported hint match";
  }
  if (hints.length === 1) {
    return `no ${hints[0]} match`;
  }
  if (hints.length === 2 && hints.includes("timestamp") && hints.includes("date")) {
    return "no date or timestamp match";
  }
  return "no selected hint match";
}

function buildTextStyleStem(value: string, style: CleanupTextStyle): string {
  return style === "slug" ? slugifyName(value) : normalizePreserveStem(value);
}

function normalizeIntermediateCleanupStem(value: string): string {
  return normalizePreserveStem(value);
}

function findTimestampRanges(stem: string): Array<{ start: number; end: number }> {
  return [...stem.matchAll(MACOS_TIMESTAMP_PATTERN_GLOBAL)]
    .map((match) => {
      if (match.index === undefined) {
        return undefined;
      }
      return {
        start: match.index,
        end: match.index + match[0].length,
      };
    })
    .filter((range): range is { start: number; end: number } => range !== undefined);
}

export function matchCleanupTimestamp(stem: string): CleanupTimestampMatch | undefined {
  const match = MACOS_TIMESTAMP_PATTERN.exec(stem);
  if (!match || match.index === undefined) {
    return undefined;
  }
  const [, year, month, day, hour, minute, second, meridiem] = match;
  if (!year || !month || !day || !hour || !minute || !second || !meridiem) {
    return undefined;
  }

  return {
    prefix: trimCleanupFragmentEdges(stem.slice(0, match.index)),
    suffix: trimCleanupFragmentEdges(stem.slice(match.index + match[0].length)),
    normalizedTimestamp: formatCleanupTimestamp(year, month, day, hour, minute, second, meridiem),
  };
}

export function matchCleanupDate(stem: string): CleanupDateMatch | undefined {
  const timestampRanges = findTimestampRanges(stem);

  for (const match of stem.matchAll(DATE_PATTERN_GLOBAL)) {
    if (match.index === undefined) {
      continue;
    }
    const [fullText, year, month, day] = match;
    if (!fullText || !year || !month || !day) {
      continue;
    }

    const start = match.index;
    const end = start + fullText.length;
    const overlapsTimestamp = timestampRanges.some(
      (range) => start >= range.start && end <= range.end,
    );
    if (overlapsTimestamp) {
      continue;
    }

    return {
      prefix: trimCleanupFragmentEdges(stem.slice(0, start)),
      suffix: trimCleanupFragmentEdges(stem.slice(end)),
      normalizedDate: `${year}${month}${day}`,
    };
  }

  return undefined;
}

export function matchCleanupSerial(stem: string): CleanupSerialMatch | undefined {
  const parenthesizedMatch = /^(.*?)(?:[\s._-]*)\((\d{1,})\)$/.exec(stem);
  if (parenthesizedMatch) {
    const [, rawPrefix, serial] = parenthesizedMatch;
    const prefix = trimCleanupFragmentEdges(rawPrefix ?? "");
    if (serial && prefix) {
      return { prefix };
    }
  }

  const separatedMatch = /^(.*?)(?:[\s_-]+)(0\d+)$/.exec(stem);
  if (!separatedMatch) {
    return undefined;
  }

  const [, rawPrefix, serial] = separatedMatch;
  const prefix = trimCleanupFragmentEdges(rawPrefix ?? "");
  if (!prefix || !serial) {
    return undefined;
  }

  if (/\d$/.test(prefix)) {
    return undefined;
  }

  if (/^(img|dsc)$/i.test(prefix)) {
    return undefined;
  }

  return { prefix };
}

export function matchCleanupUid(stem: string): CleanupUidMatch | undefined {
  const match = /(^|[\s._-]+)(uid-[0-9a-hjkmnpqrstvwxyz]{10,16})(?=$|[\s._-]+)(.*)$/i.exec(stem);
  if (!match || match.index === undefined) {
    return undefined;
  }

  return {
    prefix: trimCleanupFragmentEdges(stem.slice(0, match.index)),
    suffix: trimCleanupFragmentEdges(match[3] ?? ""),
  };
}

function buildTimestampCleanupStem(
  stem: string,
  _style: CleanupTextStyle,
  timestampAction: CleanupTimestampAction,
): { nextStem: string; reason?: string } {
  const match = matchCleanupTimestamp(stem);
  if (!match) {
    return { nextStem: stem, reason: "no timestamp match" };
  }

  const parts = [match.prefix];
  if (timestampAction === "keep") {
    parts.push(match.normalizedTimestamp);
  }
  parts.push(match.suffix);
  return {
    nextStem: normalizeIntermediateCleanupStem(
      parts.filter((part) => part.length > 0).join(" "),
    ),
  };
}

function buildDateCleanupStem(
  stem: string,
  _style: CleanupTextStyle,
): { nextStem: string; reason?: string } {
  const match = matchCleanupDate(stem);
  if (!match) {
    return { nextStem: stem, reason: "no date match" };
  }

  return {
    nextStem: normalizeIntermediateCleanupStem(
      [match.prefix, match.normalizedDate, match.suffix]
        .filter((part) => part.length > 0)
        .join(" "),
    ),
  };
}

function buildSerialCleanupStem(
  stem: string,
  _style: CleanupTextStyle,
): { nextStem: string; reason?: string } {
  const match = matchCleanupSerial(stem);
  if (!match) {
    return { nextStem: stem, reason: "no serial match" };
  }

  return {
    nextStem: normalizeIntermediateCleanupStem(match.prefix),
  };
}

function buildUidCleanupStem(
  stem: string,
  _style: CleanupTextStyle,
): { nextStem: string; reason?: string } {
  const match = matchCleanupUid(stem);
  if (!match) {
    return { nextStem: stem, reason: "no uid match" };
  }

  return {
    nextStem: normalizeIntermediateCleanupStem(
      [match.prefix, match.suffix].filter((part) => part.length > 0).join(" "),
    ),
  };
}

export function buildTemporalCleanupStem(
  stem: string,
  hints: CleanupHint[],
  style: CleanupTextStyle,
  timestampAction: CleanupTimestampAction,
): { nextStem: string; reason?: string } {
  let nextStem = stem;
  let matchedAny = false;

  const orderedHints: CleanupHint[] = ["timestamp", "date", "serial", "uid"];
  for (const hint of orderedHints) {
    if (!hints.includes(hint)) {
      continue;
    }

    const result =
      hint === "timestamp"
        ? buildTimestampCleanupStem(nextStem, style, timestampAction)
        : hint === "date"
          ? buildDateCleanupStem(nextStem, style)
          : hint === "serial"
            ? buildSerialCleanupStem(nextStem, style)
            : buildUidCleanupStem(nextStem, style);

    if (!result.reason) {
      nextStem = result.nextStem;
      matchedAny = true;
    }
  }

  if (matchedAny) {
    return { nextStem: buildTextStyleStem(nextStem, style) };
  }

  return { nextStem: stem, reason: buildNoMatchReason(hints) };
}
