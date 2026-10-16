import { readFile } from "node:fs/promises";

import * as mammoth from "mammoth";

import { readDocxCoreMetadata } from "../../../docx/ooxml-metadata";
import type { DocumentTitleEvidence, DocxHeadingSignal } from "../types";
import { assembleDocxEvidence } from "./docx-evidence";
import { stripHtmlTags, toSingleLine } from "./shared";

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
    const headingSignals: DocxHeadingSignal[] = [];
    for (const match of html.matchAll(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi)) {
      const headingText = toSingleLine(stripHtmlTags(match[2] ?? ""));
      const headingLevel = Number(match[1] ?? 0);
      if (!headingText || !Number.isFinite(headingLevel) || headingLevel < 1 || headingLevel > 6) {
        continue;
      }
      headingSignals.push({ level: headingLevel, text: headingText });
    }

    return assembleDocxEvidence(path, {
      metadataResult,
      rawText,
      headings: headingSignals,
      hasContent: html.trim().length > 0 || rawText.trim().length > 0,
      extractor: "mammoth",
    });
  } catch {
    return { reason: "docx_extract_error" };
  }
}
