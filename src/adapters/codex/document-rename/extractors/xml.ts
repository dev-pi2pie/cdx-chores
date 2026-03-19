import { basename, extname } from "node:path";

import type { DocumentTitleEvidence } from "../types";
import { MAX_TITLE_CANDIDATES } from "../types";
import { extractHtmlTextLines, firstParagraph, stripHtmlTags, toSingleLine } from "./shared";

export function extractXmlEvidence(path: string, content: string): DocumentTitleEvidence | { reason: string } {
  const titleCandidates: string[] = [];
  const warnings: string[] = [];

  const tagCandidates = ["title", "name", "subject"];
  for (const tag of tagCandidates) {
    const match = content.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
    if (!match?.[1]) {
      continue;
    }
    const text = toSingleLine(stripHtmlTags(match[1]));
    if (text) {
      titleCandidates.push(text);
    }
  }

  const textLines = extractHtmlTextLines(content);
  const leadText = firstParagraph(textLines);
  if (!leadText) {
    warnings.push("no_lead_text");
  }

  const dedupedTitles = [...new Set(titleCandidates)].slice(0, MAX_TITLE_CANDIDATES);
  if (dedupedTitles.length === 0 && !leadText) {
    return { reason: content.trim().length > 0 ? "doc_no_title_signal" : "doc_no_text" };
  }

  return {
    filename: basename(path),
    extension: extname(path).toLowerCase(),
    detectedType: "xml",
    titleCandidates: dedupedTitles,
    leadText,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}
