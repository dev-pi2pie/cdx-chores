import type { CliRuntime } from "../../../types";
import { printLine } from "../../shared";
import type { RenameCodexAnalysisResult } from "./analyzer";

export function printRenameBatchCodexSummary(
  runtime: CliRuntime,
  options: {
    analysis: RenameCodexAnalysisResult;
    totalCount: number;
    codexRequested: boolean;
  },
): void {
  if (options.analysis.effectiveFlags.codexImages && options.analysis.image) {
    const image = options.analysis.image;
    printLine(
      runtime.stdout,
      `${image.summaryLabel}: ${image.suggestedCount}/${image.candidateCount} image file(s) suggested${image.errorMessage ? " (fallback used for others)" : ""}`,
    );
    if (options.totalCount > 0 && image.candidateCount === 0) {
      printLine(
        runtime.stdout,
        "Codex note: no supported static image files in scope; other file types use deterministic rename.",
      );
    } else if (image.candidateCount > 0 && image.eligibleCount === 0 && !image.errorMessage) {
      printLine(
        runtime.stdout,
        "Codex note: image files were found, but none were eligible static-image inputs (see preview/CSV reasons).",
      );
    }
    if (image.errorMessage && image.candidateCount > 0) {
      printLine(runtime.stdout, `Codex note: ${image.errorMessage}`);
    }
  }

  if (options.analysis.effectiveFlags.codexDocs && options.analysis.doc) {
    const doc = options.analysis.doc;
    printLine(
      runtime.stdout,
      `${doc.summaryLabel}: ${doc.suggestedCount}/${doc.candidateCount} document file(s) suggested${doc.errorMessage ? " (fallback used for others)" : ""}`,
    );
    if (options.totalCount > 0 && doc.candidateCount === 0) {
      printLine(
        runtime.stdout,
        "Codex note: no supported document files in scope for --codex-docs; other file types use deterministic rename.",
      );
    } else if (doc.candidateCount > 0 && doc.eligibleCount === 0 && !doc.errorMessage) {
      printLine(
        runtime.stdout,
        "Codex note: document files were found, but none were eligible document inputs (see preview/CSV reasons).",
      );
    }
    if (doc.errorMessage && doc.candidateCount > 0) {
      printLine(runtime.stdout, `Codex note: ${doc.errorMessage}`);
    }
  }

  if (
    options.codexRequested &&
    !options.analysis.effectiveFlags.codexImages &&
    !options.analysis.effectiveFlags.codexDocs
  ) {
    printLine(
      runtime.stdout,
      "Codex note: no supported Codex analyzer inputs are in scope; deterministic rename is used.",
    );
  }
}

export function printRenameFileCodexSummary(
  runtime: CliRuntime,
  options: {
    analysis: RenameCodexAnalysisResult;
    sourcePath: string;
    codexRequested: boolean;
  },
): void {
  if (options.analysis.effectiveFlags.codexImages && options.analysis.image) {
    const image = options.analysis.image;
    printLine(
      runtime.stdout,
      `${image.summaryLabel}: ${image.suggestedCount}/${image.candidateCount} image file(s) suggested${image.errorMessage ? " (fallback used for others)" : ""}`,
    );
    if (image.candidateCount === 0) {
      printLine(
        runtime.stdout,
        "Codex note: this file is not a supported static image input; deterministic rename is used.",
      );
    } else if (image.eligibleCount === 0 && !image.errorMessage) {
      printLine(
        runtime.stdout,
        "Codex note: this image file is not an eligible static-image input (for example GIF, too large, or unreadable).",
      );
    }
    if (image.errorMessage && image.candidateCount > 0) {
      printLine(runtime.stdout, `Codex note: ${image.errorMessage}`);
    }
  }

  if (options.analysis.effectiveFlags.codexDocs && options.analysis.doc) {
    const doc = options.analysis.doc;
    printLine(
      runtime.stdout,
      `${doc.summaryLabel}: ${doc.suggestedCount}/${doc.candidateCount} document file(s) suggested${doc.errorMessage ? " (fallback used for others)" : ""}`,
    );
    if (doc.candidateCount === 0) {
      printLine(
        runtime.stdout,
        "Codex note: this file is not a supported document input for --codex-docs; deterministic rename is used.",
      );
    } else if (doc.eligibleCount === 0 && !doc.errorMessage) {
      printLine(
        runtime.stdout,
        "Codex note: this document file is not an eligible document input (for example too large or unreadable).",
      );
    }
    if (doc.errorMessage && doc.candidateCount > 0) {
      printLine(runtime.stdout, `Codex note: ${doc.errorMessage}`);
    }
  }

  if (
    options.codexRequested &&
    !options.analysis.effectiveFlags.codexImages &&
    !options.analysis.effectiveFlags.codexDocs
  ) {
    printLine(
      runtime.stdout,
      "Codex note: this file is not a supported Codex analyzer input; deterministic rename is used.",
    );
  }
}
