import { basename, extname } from "node:path";

import type { DocumentTitleEvidence } from "../types";
import { MAX_TITLE_CANDIDATES } from "../types";
import { firstParagraph, toSingleLine } from "./shared";

export function extractPlainTextEvidence(
  path: string,
  content: string,
): DocumentTitleEvidence | { reason: string } {
  const lines = content.split(/\r?\n/);
  const nonEmpty = lines.map((line) => line.trim()).filter((line) => line.length > 0);
  if (nonEmpty.length === 0) {
    return { reason: "doc_no_text" };
  }

  const titleCandidates = [toSingleLine(nonEmpty[0] ?? "")]
    .filter(Boolean)
    .slice(0, MAX_TITLE_CANDIDATES);
  const leadText = firstParagraph(lines.map((line) => line.trim()));
  if (titleCandidates.length === 0 && !leadText) {
    return { reason: "doc_no_title_signal" };
  }

  return {
    filename: basename(path),
    extension: extname(path).toLowerCase(),
    detectedType: "text",
    titleCandidates,
    leadText,
  };
}
