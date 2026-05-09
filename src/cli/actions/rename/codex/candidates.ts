import { stat } from "node:fs/promises";
import { extname } from "node:path";

import type { PlannedRename } from "../../../types";

export interface RenameTitleAnalyzerSelection {
  candidateCount: number;
  eligiblePaths: string[];
  skipReasonByPath: Map<string, string>;
}

const IMAGE_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".bmp",
  ".tif",
  ".tiff",
  ".avif",
]);

const CODEX_MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const CODEX_STATIC_IMAGE_EXTENSIONS = new Set(
  [...IMAGE_EXTENSIONS].filter((ext) => ext !== ".gif"),
);

const CODEX_TEXT_DOCUMENT_EXTENSIONS = new Set([
  ".md",
  ".markdown",
  ".txt",
  ".json",
  ".yaml",
  ".yml",
  ".toml",
  ".xml",
  ".html",
  ".htm",
]);
const CODEX_PDF_DOCUMENT_EXTENSIONS = new Set([".pdf"]);
const CODEX_DOCX_DOCUMENT_EXTENSIONS = new Set([".docx"]);
const CODEX_MAX_TEXT_DOCUMENT_BYTES = 512 * 1024;
const CODEX_MAX_PDF_DOCUMENT_BYTES = 20 * 1024 * 1024;
const CODEX_MAX_DOCX_DOCUMENT_BYTES = 10 * 1024 * 1024;

export async function selectCodexStaticImageCandidates(
  plans: PlannedRename[],
): Promise<RenameTitleAnalyzerSelection> {
  const eligiblePaths: string[] = [];
  let candidateCount = 0;
  const skipReasonByPath = new Map<string, string>();

  for (const plan of plans) {
    const sourcePath = plan.fromPath;
    const ext = extname(sourcePath).toLowerCase();
    if (!IMAGE_EXTENSIONS.has(ext)) {
      continue;
    }

    candidateCount += 1;

    if (!CODEX_STATIC_IMAGE_EXTENSIONS.has(ext)) {
      skipReasonByPath.set(sourcePath, "codex_skipped_non_static");
      continue;
    }

    try {
      const fileStats = await stat(sourcePath);
      if (!fileStats.isFile()) {
        skipReasonByPath.set(sourcePath, "codex_skipped_unreadable");
        continue;
      }
      if (fileStats.size > CODEX_MAX_IMAGE_BYTES) {
        skipReasonByPath.set(sourcePath, "codex_skipped_too_large");
        continue;
      }
    } catch {
      skipReasonByPath.set(sourcePath, "codex_skipped_unreadable");
      continue;
    }

    eligiblePaths.push(sourcePath);
  }

  return { candidateCount, eligiblePaths, skipReasonByPath };
}

export async function selectCodexDocumentTextCandidates(
  plans: PlannedRename[],
): Promise<RenameTitleAnalyzerSelection> {
  const eligiblePaths: string[] = [];
  let candidateCount = 0;
  const skipReasonByPath = new Map<string, string>();

  for (const plan of plans) {
    const sourcePath = plan.fromPath;
    const ext = extname(sourcePath).toLowerCase();
    const isTextLike = CODEX_TEXT_DOCUMENT_EXTENSIONS.has(ext);
    const isPdf = CODEX_PDF_DOCUMENT_EXTENSIONS.has(ext);
    const isDocx = CODEX_DOCX_DOCUMENT_EXTENSIONS.has(ext);
    if (!isTextLike && !isPdf && !isDocx) {
      continue;
    }

    candidateCount += 1;

    try {
      const fileStats = await stat(sourcePath);
      if (!fileStats.isFile()) {
        skipReasonByPath.set(
          sourcePath,
          isPdf
            ? "pdf_skipped_unreadable"
            : isDocx
              ? "docx_skipped_unreadable"
              : "doc_skipped_unreadable",
        );
        continue;
      }
      const sizeLimit = isPdf
        ? CODEX_MAX_PDF_DOCUMENT_BYTES
        : isDocx
          ? CODEX_MAX_DOCX_DOCUMENT_BYTES
          : CODEX_MAX_TEXT_DOCUMENT_BYTES;
      if (fileStats.size > sizeLimit) {
        skipReasonByPath.set(
          sourcePath,
          isPdf
            ? "pdf_skipped_too_large"
            : isDocx
              ? "docx_skipped_too_large"
              : "doc_skipped_too_large",
        );
        continue;
      }
    } catch {
      skipReasonByPath.set(
        sourcePath,
        isPdf
          ? "pdf_skipped_unreadable"
          : isDocx
            ? "docx_skipped_unreadable"
            : "doc_skipped_unreadable",
      );
      continue;
    }

    eligiblePaths.push(sourcePath);
  }

  return { candidateCount, eligiblePaths, skipReasonByPath };
}
