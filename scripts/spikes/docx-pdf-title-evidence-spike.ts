import { performance } from "node:perf_hooks";
import { readFile } from "node:fs/promises";
import { basename, extname } from "node:path";

import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

// The February DOCX experiment is retained in its archived findings. This entry
// now preserves only the PDF comparison used by later font-selection research.
type SpikeFileType = "pdf";

interface SpikeEvidence {
  sourcePath: string;
  fileType: SpikeFileType;
  extractor: string;
  title?: string;
  author?: string;
  headings?: string[];
  tocCandidates?: string[];
  leadText?: string;
  metadata?: Record<string, unknown>;
  warnings?: string[];
}

interface SpikeResult {
  filePath: string;
  backend: "pdfjs-dist";
  elapsedMs: number;
  evidence?: SpikeEvidence;
  error?: string;
}

function toSingleLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

async function extractPdfEvidence(path: string): Promise<SpikeResult> {
  const started = performance.now();
  let pdfDocument: any;
  try {
    const fileBytes = await readFile(path);
    const standardFontDataUrl = new URL(
      "../../node_modules/pdfjs-dist/standard_fonts/",
      import.meta.url,
    ).href;
    const loadingTask = pdfjs.getDocument({
      data: new Uint8Array(fileBytes),
      // Keep spike simple and local; worker-less mode is sufficient for extraction.
      worker: null as any,
      useWorkerFetch: false,
      standardFontDataUrl,
      isOffscreenCanvasSupported: false,
      isImageDecoderSupported: false,
    } as any);
    pdfDocument = await loadingTask.promise;

    const pageCount = pdfDocument.numPages as number;

    let metadataInfo: Record<string, unknown> | undefined;
    const warnings: string[] = [];
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
    } catch {
      warnings.push("pdf_outline_unavailable");
    }

    let firstPageText = "";
    try {
      const page1 = await pdfDocument.getPage(1);
      const textContent = await page1.getTextContent();
      const textItems = (textContent.items ?? []) as Array<{ str?: string }>;
      firstPageText = toSingleLine(
        textItems
          .map((item) => item.str ?? "")
          .join(" ")
          .trim(),
      );
      if (!firstPageText) {
        warnings.push("pdf_no_page1_text");
      }
    } catch {
      warnings.push("pdf_page1_text_unavailable");
    }

    const title =
      (typeof metadataInfo?.Title === "string" ? toSingleLine(metadataInfo.Title) : undefined) ||
      outlineTitles[0] ||
      firstPageText.split(/(?<=[.!?])\s+/)[0] ||
      undefined;
    const author =
      typeof metadataInfo?.Author === "string" ? toSingleLine(metadataInfo.Author) : undefined;
    const leadText = firstPageText ? firstPageText.slice(0, 800) : undefined;

    if (!title) {
      warnings.push("no_title_signal");
    }
    if (!leadText) {
      warnings.push("no_lead_text");
    }

    const elapsedMs = Math.round(performance.now() - started);
    return {
      filePath: path,
      backend: "pdfjs-dist",
      elapsedMs,
      evidence: {
        sourcePath: path,
        fileType: "pdf",
        extractor: "pdfjs-dist@getMetadata+getOutline+page1.getTextContent",
        title,
        author,
        headings: outlineTitles.length > 0 ? outlineTitles.slice(0, 12) : undefined,
        tocCandidates: outlineTitles.length > 0 ? outlineTitles.slice(0, 12) : undefined,
        leadText,
        metadata: {
          pageCount,
          pdfInfo: metadataInfo,
        },
        warnings,
      },
    };
  } catch (error) {
    return {
      filePath: path,
      backend: "pdfjs-dist",
      elapsedMs: Math.round(performance.now() - started),
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    try {
      await pdfDocument?.destroy?.();
    } catch {
      // ignore cleanup issues in spike script
    }
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const targets = args.length > 0 ? args : ["examples/playground/docs/xxx.pdf"];

  const results: SpikeResult[] = [];
  for (const target of targets) {
    const ext = extname(target).toLowerCase();
    if (ext === ".pdf") {
      results.push(await extractPdfEvidence(target));
      continue;
    }
    results.push({
      filePath: target,
      backend: "pdfjs-dist",
      elapsedMs: 0,
      error: `Unsupported spike target extension: ${ext || "(none)"} (${basename(target)})`,
    });
  }

  process.stdout.write(`${JSON.stringify({ results }, null, 2)}\n`);
}

await main();
