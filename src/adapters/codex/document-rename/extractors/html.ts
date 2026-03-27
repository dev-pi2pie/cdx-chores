import { basename, extname } from "node:path";

import type { DocumentTitleEvidence } from "../types";
import { MAX_HEADINGS, MAX_TITLE_CANDIDATES } from "../types";
import { extractHtmlTextLines, firstParagraph, stripHtmlTags, toSingleLine } from "./shared";

export function extractHtmlEvidence(
  path: string,
  content: string,
): DocumentTitleEvidence | { reason: string } {
  const titleCandidates: string[] = [];
  const headings: string[] = [];
  const warnings: string[] = [];

  const titleMatch = content.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch?.[1]) {
    const title = toSingleLine(stripHtmlTags(titleMatch[1]));
    if (title) {
      titleCandidates.push(title);
    }
  }

  const authorMetaMatch =
    content.match(/<meta[^>]+name=["']author["'][^>]+content=["']([^"']+)["'][^>]*>/i) ??
    content.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']author["'][^>]*>/i);
  const author = authorMetaMatch?.[1] ? toSingleLine(authorMetaMatch[1]) : undefined;

  for (const match of content.matchAll(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi)) {
    const heading = toSingleLine(stripHtmlTags(match[2] ?? ""));
    if (!heading) {
      continue;
    }
    headings.push(heading);
    if ((match[1] ?? "") === "1") {
      titleCandidates.push(heading);
    }
  }

  const textLines = extractHtmlTextLines(content);
  const leadText = firstParagraph(textLines);
  if (!leadText) {
    warnings.push("no_lead_text");
  }

  const dedupedTitles = [...new Set(titleCandidates)].slice(0, MAX_TITLE_CANDIDATES);
  const dedupedHeadings = [...new Set(headings)].slice(0, MAX_HEADINGS);

  if (dedupedTitles.length === 0 && !leadText && dedupedHeadings.length === 0) {
    return { reason: content.trim().length > 0 ? "doc_no_title_signal" : "doc_no_text" };
  }

  return {
    filename: basename(path),
    extension: extname(path).toLowerCase(),
    detectedType: "html",
    titleCandidates: dedupedTitles,
    authorCandidates: author ? [author] : undefined,
    headings: dedupedHeadings.length > 0 ? dedupedHeadings : undefined,
    leadText,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}
