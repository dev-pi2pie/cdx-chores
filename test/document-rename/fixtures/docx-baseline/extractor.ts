import { readFile } from "node:fs/promises";

import * as mammoth from "mammoth";

import { assembleDocxEvidence } from "../../../../src/adapters/codex/document-rename/extractors/docx-evidence";
import {
  stripHtmlTags,
  toSingleLine,
} from "../../../../src/adapters/codex/document-rename/extractors/shared";
import type {
  DocumentTitleEvidence,
  DocxHeadingSignal,
} from "../../../../src/adapters/codex/document-rename/types";
import { readDocxCoreMetadata } from "../../../../src/adapters/docx/ooxml-metadata";

/** Preserve the pre-integration Mammoth adapter as the live comparison oracle. */
export async function extractBaselineDocxEvidence(
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
