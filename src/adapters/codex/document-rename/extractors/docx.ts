import { readFile } from "node:fs/promises";
import { basename, extname } from "node:path";

import * as mammoth from "mammoth";

import { readDocxCoreMetadata } from "../../../docx/ooxml-metadata";
import type { DocumentTitleEvidence, DocxHeadingSignal } from "../types";
import { MAX_HEADINGS, MAX_TITLE_CANDIDATES } from "../types";
import {
  firstParagraph,
  isWeakDocxTitleCandidate,
  pushUniqueTitleCandidate,
  stripHtmlTags,
  toSingleLine,
} from "./shared";

export async function extractDocxEvidence(
  path: string,
): Promise<DocumentTitleEvidence | { reason: string }> {
  try {
    const buffer = await readFile(path);
    const [metadataResult, htmlResult, rawTextResult] = await Promise.all([
      readDocxCoreMetadata(path),
      mammoth.convertToHtml({ buffer }),
      mammoth.extractRawText({ buffer }),
    ]);

    const html = htmlResult.value ?? "";
    const rawText = rawTextResult.value ?? "";

    const titleCandidates: string[] = [];
    const headingSignals: DocxHeadingSignal[] = [];
    const warnings: string[] =
      "reason" in metadataResult
        ? ["docx_metadata_unavailable"]
        : [
            ...new Set(
              metadataResult.warnings.filter(
                (warning): warning is string => typeof warning === "string",
              ),
            ),
          ];
    const metadata = "reason" in metadataResult ? undefined : metadataResult.metadata;

    for (const match of html.matchAll(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi)) {
      const headingText = toSingleLine(stripHtmlTags(match[2] ?? ""));
      const headingLevel = Number(match[1] ?? 0);
      if (!headingText || !Number.isFinite(headingLevel) || headingLevel < 1 || headingLevel > 6) {
        continue;
      }
      headingSignals.push({ level: headingLevel, text: headingText });
    }

    const rawLines = rawText
      .replace(/\r\n/g, "\n")
      .split("\n")
      .map((line: string) => toSingleLine(line))
      .filter(Boolean);
    const headings = headingSignals.map((heading) => heading.text);
    const h1Headings = headingSignals
      .filter((heading) => heading.level === 1)
      .map((heading) => heading.text);
    const strongEarlyHeadings = headingSignals
      .filter((heading, index) => index < 4 && heading.level <= 2)
      .map((heading) => heading.text);
    const firstMeaningfulRawLine = rawLines.find((line) => !isWeakDocxTitleCandidate(line));

    pushUniqueTitleCandidate(
      titleCandidates,
      metadata?.title && !isWeakDocxTitleCandidate(metadata.title) ? metadata.title : undefined,
    );
    for (const heading of h1Headings) {
      if (!isWeakDocxTitleCandidate(heading)) {
        pushUniqueTitleCandidate(titleCandidates, heading);
      }
    }
    for (const heading of strongEarlyHeadings) {
      if (!isWeakDocxTitleCandidate(heading)) {
        pushUniqueTitleCandidate(titleCandidates, heading);
      }
    }
    pushUniqueTitleCandidate(titleCandidates, firstMeaningfulRawLine);
    pushUniqueTitleCandidate(titleCandidates, metadata?.title);
    if (!metadata?.title) {
      for (const heading of h1Headings) {
        pushUniqueTitleCandidate(titleCandidates, heading);
      }
      for (const heading of strongEarlyHeadings) {
        pushUniqueTitleCandidate(titleCandidates, heading);
      }
    }
    pushUniqueTitleCandidate(
      titleCandidates,
      !metadata?.title || !isWeakDocxTitleCandidate(rawLines[0] ?? "") ? rawLines[0] : undefined,
    );

    const leadText = firstParagraph(rawLines.map((line: string) => line));
    if (!leadText) {
      warnings.push("docx_no_lead_text");
    }

    const dedupedTitles = [...new Set(titleCandidates)].slice(0, MAX_TITLE_CANDIDATES);
    const dedupedHeadings = [...new Set(headings)].slice(0, MAX_HEADINGS);

    if (dedupedTitles.length === 0 && !leadText && dedupedHeadings.length === 0) {
      const hasAnyText = html.trim().length > 0 || rawText.trim().length > 0;
      return { reason: hasAnyText ? "docx_no_title_signal" : "docx_extract_error" };
    }

    return {
      filename: basename(path),
      extension: extname(path).toLowerCase(),
      detectedType: "docx",
      titleCandidates: dedupedTitles,
      authorCandidates: metadata?.creator ? [metadata.creator] : undefined,
      headings: dedupedHeadings.length > 0 ? dedupedHeadings : undefined,
      tocCandidates: dedupedHeadings.length > 0 ? dedupedHeadings : undefined,
      leadText,
      metadata: {
        ...metadata,
        extractor: metadata ? "mammoth+ooxml" : "mammoth",
      },
      warnings: warnings.length > 0 ? [...new Set(warnings)] : undefined,
    };
  } catch {
    return { reason: "docx_extract_error" };
  }
}
