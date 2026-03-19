import { access } from "node:fs/promises";
import { basename, extname } from "node:path";
import { fileURLToPath } from "node:url";

import type { DocumentTitleEvidence } from "../types";
import {
  DOCX_WEAK_TITLE_CANDIDATES,
  MAX_KEY_SUMMARY,
  MAX_LEAD_TEXT_CHARS,
  MAX_TITLE_CANDIDATES,
} from "../types";

let pdfStandardFontDataUrlPromise: Promise<string | undefined> | undefined;

export function toSingleLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function firstParagraph(lines: string[]): string | undefined {
  const paragraphLines: string[] = [];
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      if (paragraphLines.length > 0) {
        break;
      }
      continue;
    }
    paragraphLines.push(line);
    if (toSingleLine(paragraphLines.join(" ")).length >= MAX_LEAD_TEXT_CHARS) {
      break;
    }
  }

  if (paragraphLines.length === 0) {
    return undefined;
  }

  return toSingleLine(paragraphLines.join(" ")).slice(0, MAX_LEAD_TEXT_CHARS);
}

function normalizeDocxCandidateKey(value: string): string {
  return toSingleLine(value)
    .toLowerCase()
    .replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, "")
    .replace(/\s+/g, " ");
}

export function isWeakDocxTitleCandidate(value: string): boolean {
  return DOCX_WEAK_TITLE_CANDIDATES.has(normalizeDocxCandidateKey(value));
}

export function pushUniqueTitleCandidate(candidates: string[], value: string | undefined): void {
  if (!value) {
    return;
  }
  const normalized = toSingleLine(value);
  if (!normalized) {
    return;
  }
  if (candidates.includes(normalized)) {
    return;
  }
  candidates.push(normalized);
}

export function getStringCandidate(data: Record<string, unknown> | null, keys: string[]): string | undefined {
  if (!data) {
    return undefined;
  }
  for (const key of keys) {
    const value = data[key];
    if (typeof value === "string") {
      const normalized = toSingleLine(value);
      if (normalized) {
        return normalized;
      }
    }
  }
  return undefined;
}

export function getNestedStringCandidate(
  data: Record<string, unknown> | null,
  paths: string[][],
): string | undefined {
  if (!data) {
    return undefined;
  }

  for (const path of paths) {
    let current: unknown = data;
    let ok = true;
    for (const segment of path) {
      if (!current || typeof current !== "object" || Array.isArray(current)) {
        ok = false;
        break;
      }
      current = (current as Record<string, unknown>)[segment];
    }
    if (!ok || typeof current !== "string") {
      continue;
    }
    const normalized = toSingleLine(current);
    if (normalized) {
      return normalized;
    }
  }

  return undefined;
}

export function collectKeySummary(data: Record<string, unknown> | null): string[] | undefined {
  if (!data) {
    return undefined;
  }

  const keys = Object.keys(data)
    .map((key) => key.trim())
    .filter(Boolean)
    .slice(0, MAX_KEY_SUMMARY);

  return keys.length > 0 ? keys : undefined;
}

export async function resolvePdfStandardFontDataUrl(): Promise<string | undefined> {
  pdfStandardFontDataUrlPromise ??= (async () => {
    const candidates = [
      new URL("../../../../node_modules/pdfjs-dist/standard_fonts/", import.meta.url),
      new URL("../../../../../node_modules/pdfjs-dist/standard_fonts/", import.meta.url),
    ];

    for (const candidate of candidates) {
      try {
        await access(fileURLToPath(candidate));
        return candidate.href;
      } catch {
        // try next
      }
    }

    return undefined;
  })();

  return pdfStandardFontDataUrlPromise;
}

export function buildStructuredLeadText(data: Record<string, unknown> | null): string | undefined {
  if (!data) {
    return undefined;
  }
  const candidates: string[] = [];
  for (const key of ["description", "summary", "subtitle"]) {
    const value = data[key];
    if (typeof value === "string") {
      const normalized = toSingleLine(value);
      if (normalized) {
        candidates.push(normalized);
      }
    }
  }
  if (candidates.length === 0) {
    return undefined;
  }
  return toSingleLine(candidates.join(" ")).slice(0, MAX_LEAD_TEXT_CHARS);
}

export function extractStructuredObjectEvidence(options: {
  path: string;
  data: Record<string, unknown> | null;
  detectedType: DocumentTitleEvidence["detectedType"];
}): DocumentTitleEvidence | { reason: string } {
  const { path, data, detectedType } = options;
  if (!data) {
    return { reason: "doc_no_text" };
  }
  const titleCandidates = [
    getStringCandidate(data, ["title", "name", "subject"]),
    getNestedStringCandidate(data, [
      ["metadata", "title"],
      ["meta", "title"],
      ["package", "name"],
    ]),
  ]
    .filter((value): value is string => Boolean(value))
    .map(toSingleLine);

  const authorCandidate = [
    getStringCandidate(data, ["author", "creator", "owner"]),
    getNestedStringCandidate(data, [
      ["metadata", "author"],
      ["meta", "author"],
      ["package", "author"],
    ]),
  ].find((value): value is string => Boolean(value));

  const leadText = buildStructuredLeadText(data);
  const keySummary = collectKeySummary(data);
  const dedupedTitles = [...new Set(titleCandidates)].slice(0, MAX_TITLE_CANDIDATES);

  if (dedupedTitles.length === 0 && !leadText && !(keySummary && keySummary.length > 0)) {
    return { reason: "doc_no_title_signal" };
  }

  return {
    filename: basename(path),
    extension: extname(path).toLowerCase(),
    detectedType,
    titleCandidates: dedupedTitles,
    authorCandidates: authorCandidate ? [authorCandidate] : undefined,
    leadText,
    keySummary,
  };
}

export function stripHtmlTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

export function extractHtmlTextLines(html: string): string[] {
  return stripHtmlTags(html)
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => toSingleLine(line))
    .filter(Boolean);
}
