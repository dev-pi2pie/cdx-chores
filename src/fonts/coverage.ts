import type {
  CheckFontCoverageInput,
  FontCodepointRange,
  FontCoverage,
  FontCoverageInconclusiveReason,
  FontCoverageInventory,
  FontCoverageProvider,
  FontCoverageProviderInput,
  FontCoverageProviderResult,
} from "./types";

const SCRIPT_RANGES: FontCodepointRange[] = [
  { name: "latin", start: 0x0000, end: 0x007f },
  { name: "latin-extended", start: 0x0100, end: 0x024f },
  { name: "cjk", start: 0x4e00, end: 0x9fff },
  { name: "hiragana", start: 0x3040, end: 0x309f },
  { name: "katakana", start: 0x30a0, end: 0x30ff },
  { name: "hangul", start: 0xac00, end: 0xd7af },
  { name: "arabic", start: 0x0600, end: 0x06ff },
  { name: "hebrew", start: 0x0590, end: 0x05ff },
  { name: "private-use", start: 0xe000, end: 0xf8ff },
  { name: "supplementary-private-use-a", start: 0xf0000, end: 0xffffd },
];

const NERD_FONT_RANGES: FontCodepointRange[] = [
  { name: "private-use", start: 0xe000, end: 0xf8ff },
  { name: "supplementary-private-use-a", start: 0xf0000, end: 0xffffd },
];

const LANGUAGE_SAMPLE_TEXT: Record<string, string> = {
  "zh-Hant": "繁體中文測試",
  "zh-Hans": "简体中文测试",
  ja: "日本語の文章",
  ko: "한국어 문장",
  vi: "Tiếng Việt",
  pl: "Zażółć gęślą jaźń",
  ar: "العربية",
  he: "עברית",
};

export const NERD_FONT_SAMPLE_TEXT = "git \uE0B0 main \uF418";

function codepoints(value: string): number[] {
  return Array.from(value).map((character) => character.codePointAt(0) ?? 0);
}

export function formatFontCodepoint(codepoint: number): string {
  return `U+${codepoint.toString(16).toUpperCase().padStart(4, "0")}`;
}

function uniqueCodepoints(value: string): number[] {
  return Array.from(new Set(codepoints(value)));
}

function isControlCodepoint(codepoint: number): boolean {
  return codepoint <= 0x001f || (codepoint >= 0x007f && codepoint <= 0x009f);
}

export function requiredFontCoverageCodepoints(value: string): number[] {
  return uniqueCodepoints(value).filter((codepoint) => !isControlCodepoint(codepoint));
}

function isInRange(codepoint: number, range: FontCodepointRange): boolean {
  return codepoint >= range.start && codepoint <= range.end;
}

function supportedByInventory(codepoint: number, inventory: FontCoverageInventory): boolean {
  if (inventory.supportedCodepoints?.includes(codepoint)) {
    return true;
  }
  return inventory.supportedRanges?.some((range) => isInRange(codepoint, range)) ?? false;
}

function supportedByRanges(codepoint: number, ranges: FontCodepointRange[]): boolean {
  return ranges.some((range) => isInRange(codepoint, range));
}

function fontPathFormat(path: string): string | undefined {
  const match = /\.([a-z0-9]+)$/i.exec(path);
  return match?.[1]?.toLowerCase();
}

function detectScripts(value: string): string[] {
  const scripts = new Set<string>();
  for (const codepoint of codepoints(value)) {
    for (const range of SCRIPT_RANGES) {
      if (isInRange(codepoint, range)) {
        scripts.add(range.name);
      }
    }
  }
  return Array.from(scripts);
}

function matchedNerdFontRanges(value: string): string[] {
  const matched = new Set<string>();
  for (const codepoint of codepoints(value)) {
    for (const range of NERD_FONT_RANGES) {
      if (isInRange(codepoint, range)) {
        matched.add(range.name);
      }
    }
  }
  return Array.from(matched);
}

export function sampleTextForLanguage(language: string): string | undefined {
  return LANGUAGE_SAMPLE_TEXT[language];
}

export function parseFontconfigCharset(value: string): FontCodepointRange[] {
  const ranges: FontCodepointRange[] = [];
  const tokens = value.split(/[\s,]+/).filter(Boolean);

  for (const token of tokens) {
    const match = /^([0-9a-f]{1,6})(?:-([0-9a-f]{1,6}))?$/i.exec(token);
    if (!match) {
      continue;
    }

    const start = Number.parseInt(match[1] as string, 16);
    const end = Number.parseInt((match[2] ?? match[1]) as string, 16);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
      continue;
    }

    ranges.push({
      name: "fontconfig-charset",
      start,
      end,
    });
  }

  return ranges;
}

export async function checkFontconfigCoverage(
  input: FontCoverageProviderInput,
): Promise<FontCoverageProviderResult> {
  const face = input.face;
  const path = face.path;
  const checkedCodepoints = requiredFontCoverageCodepoints(input.text).map(formatFontCodepoint);

  const inconclusive = (reason: FontCoverageInconclusiveReason): FontCoverageProviderResult => ({
    status: "inconclusive",
    reason,
    checkedCodepoints,
    missingCodepoints: [],
    face,
    ...(path ? { path } : {}),
  });

  if (checkedCodepoints.length === 0) {
    return inconclusive("empty-required-codepoints");
  }

  if (!path) {
    return inconclusive("no-inspectable-font-file");
  }

  const format = face.format ?? fontPathFormat(path);
  if (format === "ttc") {
    return inconclusive("unsupported-ttc-collection");
  }
  if (format && !["ttf", "otf"].includes(format)) {
    return inconclusive("unsupported-font-format");
  }

  const available = await input.runner("fc-query", ["--version"]);
  if (!available.ok) {
    return inconclusive("fontconfig-unavailable");
  }

  const queried = await input.runner("fc-query", ["--format=%{charset}\\n", path]);
  if (!queried.ok) {
    return inconclusive("fontconfig-query-failed");
  }

  const ranges = parseFontconfigCharset(queried.stdout);
  if (ranges.length === 0) {
    return inconclusive("fontconfig-charset-unavailable");
  }

  const required = requiredFontCoverageCodepoints(input.text);
  const missingCodepoints = required
    .filter((codepoint) => !supportedByRanges(codepoint, ranges))
    .map(formatFontCodepoint);

  return {
    status: "checked",
    supportsText: missingCodepoints.length === 0,
    checkedCodepoints,
    missingCodepoints,
    face,
    path,
  };
}

export const fontconfigCoverageProvider: FontCoverageProvider = {
  name: "fontconfig",
  check: checkFontconfigCoverage,
};

export function checkFontCoverage(input: CheckFontCoverageInput): FontCoverage {
  const matchedRanges = matchedNerdFontRanges(input.text);
  const nerdFontDetected = input.inventory?.nerdFont === true;

  if (!input.inventory) {
    return {
      family: input.family,
      status: "unknown",
      supportsText: false,
      missingCodepoints: codepoints(input.text).map(formatFontCodepoint),
      scripts: detectScripts(input.text),
      nerdFont: {
        detected: nerdFontDetected,
        matchedRanges,
      },
    };
  }

  const missingCodepoints = codepoints(input.text)
    .filter(
      (codepoint) => !supportedByInventory(codepoint, input.inventory as FontCoverageInventory),
    )
    .map(formatFontCodepoint);

  const missingNerdFont = input.requireNerdFont && input.inventory.nerdFont !== true;

  return {
    family: input.family,
    status: "known",
    supportsText: missingCodepoints.length === 0 && !missingNerdFont,
    missingCodepoints,
    scripts: detectScripts(input.text),
    nerdFont: {
      detected: input.inventory.nerdFont === true,
      matchedRanges,
    },
  };
}
