import { basename, extname } from "node:path";

import { parseMarkdown } from "../../../../markdown";
import type { DocumentTitleEvidence } from "../types";
import { MAX_HEADINGS, MAX_TITLE_CANDIDATES } from "../types";
import { firstParagraph, getStringCandidate, toSingleLine } from "./shared";

export function extractMarkdownEvidence(
  path: string,
  content: string,
): DocumentTitleEvidence | { reason: string } {
  const parsed = parseMarkdown(content);
  const titleCandidates: string[] = [];
  const headings: string[] = [];
  const warnings: string[] = [];

  const frontmatterTitle = getStringCandidate(parsed.data, ["title", "name"]);
  if (frontmatterTitle) {
    titleCandidates.push(frontmatterTitle);
  }
  const frontmatterAuthor = getStringCandidate(parsed.data, ["author", "creator"]);

  const contentLines = parsed.content.split(/\r?\n/);
  const nonHeadingLines: string[] = [];
  for (const rawLine of contentLines) {
    const trimmed = rawLine.trim();
    if (!trimmed) {
      nonHeadingLines.push("");
      continue;
    }

    const headingMatch = trimmed.match(/^#{1,6}\s+(.+)$/);
    if (headingMatch) {
      const headingText = toSingleLine(headingMatch[1] ?? "");
      if (headingText) {
        headings.push(headingText);
        if (headingMatch[0].startsWith("# ")) {
          titleCandidates.push(headingText);
        }
      }
      continue;
    }

    nonHeadingLines.push(trimmed);
  }

  const leadText = firstParagraph(nonHeadingLines);
  if (!leadText) {
    warnings.push("no_lead_text");
  }

  const dedupedTitles = [...new Set(titleCandidates.map(toSingleLine).filter(Boolean))].slice(
    0,
    MAX_TITLE_CANDIDATES,
  );
  const dedupedHeadings = [...new Set(headings)].slice(0, MAX_HEADINGS);

  if (dedupedTitles.length === 0 && !leadText && dedupedHeadings.length === 0) {
    const hasAnyText = content.trim().length > 0;
    return { reason: hasAnyText ? "doc_no_title_signal" : "doc_no_text" };
  }

  return {
    filename: basename(path),
    extension: extname(path).toLowerCase(),
    detectedType: "markdown",
    titleCandidates: dedupedTitles,
    authorCandidates: frontmatterAuthor ? [frontmatterAuthor] : undefined,
    headings: dedupedHeadings.length > 0 ? dedupedHeadings : undefined,
    leadText,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}
