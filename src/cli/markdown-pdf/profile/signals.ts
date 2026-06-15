import { parseMarkdown } from "../../../markdown";
import { checkMarkdownPdfProfileFontCoverage } from "./font-coverage";
import type {
  CheckMarkdownPdfProfileFontCoverageInput,
  MarkdownPdfProfileFontCoverageResult,
} from "./font-coverage";
import type { NormalizedMarkdownPdfProfile } from "./types";

export const MARKDOWN_PDF_SIGNAL_TEXT_LIMIT = 20_000;
export const MARKDOWN_PDF_SIGNAL_TABLE_ROW_LIMIT = 50;
export const MARKDOWN_PDF_SIGNAL_CODE_LANGUAGE_LIMIT = 12;
export const MARKDOWN_PDF_SIGNAL_FONT_FAMILY_LIMIT = 20;

export interface MarkdownPdfHeadingSignals {
  total: number;
  maxDepth: number;
  byDepth: Record<string, number>;
}

export interface MarkdownPdfTableSignals {
  scannedRows: number;
  maxColumns: number;
  maxLineWidth: number;
  overflowRows: number;
}

export interface MarkdownPdfCodeFenceSignals {
  languages: string[];
  unlabeledCount: number;
  overflowLanguageCount: number;
}

export interface MarkdownPdfAssetSignals {
  localCount: number;
  remoteCount: number;
  dataUriCount: number;
}

export interface MarkdownPdfFrontmatterSignals {
  lang?: string;
  pdfContentLangs: string[];
  metadataKeys: string[];
}

export interface MarkdownPdfScriptSignals {
  scannedChars: number;
  truncated: boolean;
  buckets: Record<string, number>;
}

export interface MarkdownPdfDocumentSignals {
  headings: MarkdownPdfHeadingSignals;
  tables: MarkdownPdfTableSignals;
  codeFences: MarkdownPdfCodeFenceSignals;
  assets: MarkdownPdfAssetSignals;
  frontmatter: MarkdownPdfFrontmatterSignals;
  scripts: MarkdownPdfScriptSignals;
}

export interface MarkdownPdfFontFamilySignal {
  role: "body" | "heading" | "code" | "pageChrome";
  key: string;
  family: string;
  coverageStatus?: MarkdownPdfProfileFontCoverageResult["coverage"]["status"];
  supportsText?: boolean;
}

export interface MarkdownPdfFontSignals {
  families: MarkdownPdfFontFamilySignal[];
  overflowFamilyCount: number;
}

function incrementBucket(buckets: Record<string, number>, bucket: string): void {
  buckets[bucket] = (buckets[bucket] ?? 0) + 1;
}

function scriptBucket(char: string): string | null {
  const codepoint = char.codePointAt(0);
  if (codepoint === undefined) {
    return null;
  }
  if (
    (codepoint >= 0x0041 && codepoint <= 0x005a) ||
    (codepoint >= 0x0061 && codepoint <= 0x007a)
  ) {
    return "latin";
  }
  if (codepoint >= 0x4e00 && codepoint <= 0x9fff) {
    return "han";
  }
  if (codepoint >= 0x3040 && codepoint <= 0x309f) {
    return "hiragana";
  }
  if (codepoint >= 0x30a0 && codepoint <= 0x30ff) {
    return "katakana";
  }
  if (codepoint >= 0xac00 && codepoint <= 0xd7af) {
    return "hangul";
  }
  if (codepoint >= 0x0400 && codepoint <= 0x04ff) {
    return "cyrillic";
  }
  if (codepoint >= 0x0600 && codepoint <= 0x06ff) {
    return "arabic";
  }
  if (codepoint >= 0x0900 && codepoint <= 0x097f) {
    return "devanagari";
  }
  if (codepoint >= 0x1f300 && codepoint <= 0x1faff) {
    return "emoji";
  }
  return null;
}

function collectScriptSignals(content: string): MarkdownPdfScriptSignals {
  const scanned = content.slice(0, MARKDOWN_PDF_SIGNAL_TEXT_LIMIT);
  const buckets: Record<string, number> = {};
  for (const char of scanned) {
    const bucket = scriptBucket(char);
    if (bucket) {
      incrementBucket(buckets, bucket);
    }
  }
  return {
    scannedChars: scanned.length,
    truncated: content.length > scanned.length,
    buckets,
  };
}

function collectHeadingSignals(content: string): MarkdownPdfHeadingSignals {
  const byDepth: Record<string, number> = {};
  let total = 0;
  let maxDepth = 0;
  for (const line of content.split("\n")) {
    const match = /^(#{1,6})[\t ]+\S/.exec(line);
    if (!match) {
      continue;
    }
    const depth = match[1]?.length ?? 0;
    total += 1;
    maxDepth = Math.max(maxDepth, depth);
    byDepth[String(depth)] = (byDepth[String(depth)] ?? 0) + 1;
  }
  return { total, maxDepth, byDepth };
}

function tableColumnCount(line: string): number {
  const trimmed = line.trim();
  if (!trimmed.includes("|")) {
    return 0;
  }
  return trimmed.split("|").filter((cell) => cell.trim().length > 0).length;
}

function collectTableSignals(content: string): MarkdownPdfTableSignals {
  const rows = content.split("\n").filter((line) => tableColumnCount(line) > 1);
  const scannedRows = rows.slice(0, MARKDOWN_PDF_SIGNAL_TABLE_ROW_LIMIT);
  return {
    scannedRows: scannedRows.length,
    maxColumns: Math.max(0, ...scannedRows.map(tableColumnCount)),
    maxLineWidth: Math.max(0, ...scannedRows.map((line) => line.length)),
    overflowRows: Math.max(0, rows.length - scannedRows.length),
  };
}

function collectCodeFenceSignals(content: string): MarkdownPdfCodeFenceSignals {
  const languages: string[] = [];
  const seen = new Set<string>();
  let unlabeledCount = 0;
  let overflowLanguageCount = 0;
  let fenceMarker: string | null = null;

  for (const line of content.split("\n")) {
    const match = /^[\t ]*(```+|~~~+)[\t ]*([^\s`]*)?/.exec(line);
    if (!match) {
      continue;
    }
    const marker = match[1] ?? "";
    if (fenceMarker) {
      if (marker.startsWith(fenceMarker[0] ?? "")) {
        fenceMarker = null;
      }
      continue;
    }
    fenceMarker = marker;
    const label = (match[2] ?? "").trim().toLowerCase();
    if (!label) {
      unlabeledCount += 1;
      continue;
    }
    if (seen.has(label)) {
      continue;
    }
    seen.add(label);
    if (languages.length < MARKDOWN_PDF_SIGNAL_CODE_LANGUAGE_LIMIT) {
      languages.push(label);
    } else {
      overflowLanguageCount += 1;
    }
  }

  return { languages, unlabeledCount, overflowLanguageCount };
}

function collectAssetSignals(content: string): MarkdownPdfAssetSignals {
  const assets = [
    ...content.matchAll(/!\[[^\]]*]\(([^)\s]+)(?:\s+"[^"]*")?\)/g),
    ...content.matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi),
  ].map((match) => match[1] ?? "");

  let localCount = 0;
  let remoteCount = 0;
  let dataUriCount = 0;
  for (const asset of assets) {
    if (/^https?:\/\//i.test(asset)) {
      remoteCount += 1;
    } else if (/^data:/i.test(asset)) {
      dataUriCount += 1;
    } else if (asset.trim().length > 0) {
      localCount += 1;
    }
  }
  return { localCount, remoteCount, dataUriCount };
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function collectFrontmatterSignals(
  data: Record<string, unknown> | null,
): MarkdownPdfFrontmatterSignals {
  if (!data) {
    return { pdfContentLangs: [], metadataKeys: [] };
  }
  const pdf = data.pdf && typeof data.pdf === "object" && !Array.isArray(data.pdf) ? data.pdf : {};
  const lang =
    typeof data.lang === "string" && data.lang.trim().length > 0 ? data.lang.trim() : undefined;
  return {
    ...(lang ? { lang } : {}),
    pdfContentLangs: readStringArray((pdf as Record<string, unknown>)["content-langs"]),
    metadataKeys: Object.keys(data)
      .filter((key) => key !== "pdf" && key !== "lang")
      .sort(),
  };
}

export function collectMarkdownPdfDocumentSignals(markdown: string): MarkdownPdfDocumentSignals {
  const parsed = parseMarkdown(markdown);
  return {
    headings: collectHeadingSignals(parsed.content),
    tables: collectTableSignals(parsed.content),
    codeFences: collectCodeFenceSignals(parsed.content),
    assets: collectAssetSignals(parsed.content),
    frontmatter: collectFrontmatterSignals(parsed.data),
    scripts: collectScriptSignals(parsed.content),
  };
}

function collectConfiguredFamilies(
  profile: NormalizedMarkdownPdfProfile,
): MarkdownPdfFontFamilySignal[] {
  return [
    ...Object.entries(profile.fonts.body).map(([key, family]) => ({
      role: "body" as const,
      key,
      family,
    })),
    ...Object.entries(profile.fonts.heading).map(([key, family]) => ({
      role: "heading" as const,
      key,
      family,
    })),
    ...Object.entries(profile.fonts.code).map(([key, family]) => ({
      role: "code" as const,
      key,
      family,
    })),
    ...Object.entries(profile.fonts.pageChrome).map(([key, family]) => ({
      role: "pageChrome" as const,
      key,
      family,
    })),
  ].filter((item) => item.family.trim().length > 0);
}

function coverageKey(result: MarkdownPdfProfileFontCoverageResult): string {
  return `${result.role}:${result.language ?? "default"}:${result.family.trim().toLowerCase()}`;
}

export function collectMarkdownPdfFontSignals(
  input: Pick<CheckMarkdownPdfProfileFontCoverageInput, "profile" | "inventories" | "checker">,
): MarkdownPdfFontSignals {
  const coverage = checkMarkdownPdfProfileFontCoverage({
    profile: input.profile,
    inventories: input.inventories,
    checker: input.checker,
  });
  const coverageByKey = new Map(coverage.results.map((result) => [coverageKey(result), result]));
  const families = collectConfiguredFamilies(input.profile).map((family) => {
    const coverageResult = coverageByKey.get(
      `${family.role}:${family.role === "body" && family.key !== "default" ? family.key : "default"}:${family.family.trim().toLowerCase()}`,
    );
    return {
      ...family,
      coverageStatus: coverageResult?.coverage.status,
      supportsText: coverageResult?.coverage.supportsText,
    };
  });

  return {
    families: families.slice(0, MARKDOWN_PDF_SIGNAL_FONT_FAMILY_LIMIT),
    overflowFamilyCount: Math.max(0, families.length - MARKDOWN_PDF_SIGNAL_FONT_FAMILY_LIMIT),
  };
}
