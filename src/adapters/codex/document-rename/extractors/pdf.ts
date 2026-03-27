import { readFile } from "node:fs/promises";
import { basename, extname } from "node:path";

import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

import type { DocumentTitleEvidence } from "../types";
import { MAX_HEADINGS, MAX_LEAD_TEXT_CHARS, MAX_TITLE_CANDIDATES } from "../types";
import { resolvePdfStandardFontDataUrl, toSingleLine } from "./shared";

function extractPdfTitleAndSignals(options: {
  path: string;
  pageCount: number;
  metadataInfo?: Record<string, unknown>;
  outlineTitles: string[];
  firstPageText: string;
  warnings: string[];
}): DocumentTitleEvidence | { reason: string } {
  const metadataInfo = options.metadataInfo;
  const metadataTitle =
    typeof metadataInfo?.Title === "string" ? toSingleLine(metadataInfo.Title) : undefined;
  const metadataAuthor =
    typeof metadataInfo?.Author === "string" ? toSingleLine(metadataInfo.Author) : undefined;

  const sentenceTitle =
    options.firstPageText
      .split(/(?<=[.!?])\s+/)
      .map((part) => toSingleLine(part))
      .find(Boolean) ?? undefined;

  const titleCandidates = [metadataTitle, options.outlineTitles[0], sentenceTitle].filter(
    (value): value is string => Boolean(value),
  );
  const dedupedTitles = [...new Set(titleCandidates)].slice(0, MAX_TITLE_CANDIDATES);
  const dedupedOutline = [...new Set(options.outlineTitles)].slice(0, MAX_HEADINGS);
  const leadText = options.firstPageText
    ? options.firstPageText.slice(0, MAX_LEAD_TEXT_CHARS)
    : undefined;

  if (dedupedTitles.length === 0 && !metadataAuthor && !leadText && dedupedOutline.length === 0) {
    return { reason: options.firstPageText ? "pdf_no_title_signal" : "pdf_no_text" };
  }

  return {
    filename: basename(options.path),
    extension: extname(options.path).toLowerCase(),
    detectedType: "pdf",
    titleCandidates: dedupedTitles,
    authorCandidates: metadataAuthor ? [metadataAuthor] : undefined,
    headings: dedupedOutline.length > 0 ? dedupedOutline : undefined,
    tocCandidates: dedupedOutline.length > 0 ? dedupedOutline : undefined,
    leadText,
    metadata: {
      pageCount: options.pageCount,
      pdfTitle: metadataTitle,
      pdfAuthor: metadataAuthor,
      creator: typeof metadataInfo?.Creator === "string" ? metadataInfo.Creator : undefined,
      producer: typeof metadataInfo?.Producer === "string" ? metadataInfo.Producer : undefined,
    },
    warnings: options.warnings.length > 0 ? options.warnings : undefined,
  };
}

export async function extractPdfEvidence(
  path: string,
): Promise<DocumentTitleEvidence | { reason: string }> {
  let pdfDocument: any;
  try {
    const fileBytes = await readFile(path);
    const standardFontDataUrl = await resolvePdfStandardFontDataUrl();
    const loadingTask = (pdfjs as any).getDocument({
      data: new Uint8Array(fileBytes),
      worker: null,
      useWorkerFetch: false,
      standardFontDataUrl,
      isOffscreenCanvasSupported: false,
      isImageDecoderSupported: false,
      verbosity: (pdfjs as any).VerbosityLevel?.ERRORS ?? 0,
    });
    pdfDocument = await loadingTask.promise;
    const pageCount = Number(pdfDocument?.numPages ?? 0);
    const warnings: string[] = [];

    let metadataInfo: Record<string, unknown> | undefined;
    try {
      const metadata = await pdfDocument.getMetadata();
      metadataInfo = (metadata?.info ?? undefined) as Record<string, unknown> | undefined;
    } catch {
      warnings.push("pdf_metadata_unavailable");
    }

    let outlineTitles: string[] = [];
    try {
      const outline = (await pdfDocument.getOutline()) as Array<{ title?: string }> | null;
      outlineTitles =
        outline
          ?.map((item) => toSingleLine(item.title ?? ""))
          .filter(Boolean)
          .slice(0, 20) ?? [];
      if (outlineTitles.length === 0) {
        warnings.push("pdf_outline_unavailable");
      }
    } catch {
      warnings.push("pdf_outline_unavailable");
    }

    let firstPageText = "";
    try {
      if (pageCount >= 1) {
        const page = await pdfDocument.getPage(1);
        const textContent = await page.getTextContent();
        const textItems = (textContent.items ?? []) as Array<{ str?: string }>;
        firstPageText = toSingleLine(
          textItems
            .map((item) => item.str ?? "")
            .join(" ")
            .trim(),
        );
      }
      if (!firstPageText) {
        warnings.push("pdf_no_page1_text");
      }
    } catch {
      warnings.push("pdf_no_page1_text");
    }

    return extractPdfTitleAndSignals({
      path,
      pageCount,
      metadataInfo,
      outlineTitles,
      firstPageText,
      warnings,
    });
  } catch {
    return { reason: "pdf_extract_error" };
  } finally {
    try {
      await pdfDocument?.destroy?.();
    } catch {
      // ignore cleanup issues
    }
  }
}
