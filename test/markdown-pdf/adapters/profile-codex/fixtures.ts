import type { MarkdownPdfCodexProfileRequest } from "../../../../src/adapters/codex/markdown-pdf-profile/types";
import {
  createMarkdownPdfProfileCandidates,
  type MarkdownPdfProfileCandidate,
} from "../../../../src/cli/markdown-pdf/profile/candidates";

export function candidate(id: string): MarkdownPdfProfileCandidate {
  const found = createMarkdownPdfProfileCandidates().find((item) => item.summary.id === id);
  if (!found) {
    throw new Error(`missing candidate ${id}`);
  }
  return found;
}

export const requestBase: MarkdownPdfCodexProfileRequest = {
  candidates: [candidate("default"), candidate("wide-table")],
  documentSignals: {
    available: true,
    assets: { dataUriCount: 0, localCount: 1, remoteCount: 0 },
    codeFences: { languages: ["ts"], overflowLanguageCount: 0, unlabeledCount: 0 },
    frontmatter: { metadataKeys: ["title"], pdfContentLangs: [], lang: "en" },
    headings: { byDepth: { "1": 1 }, maxDepth: 1, total: 1 },
    scripts: { buckets: { latin: 20 }, scannedChars: 20, truncated: false },
    tables: { maxColumns: 6, maxLineWidth: 120, overflowRows: 0, scannedRows: 4 },
    title: {
      duplicateVisibleTitleRisk: false,
      firstH1: { charCount: 6, present: true },
      frontmatterTitle: { charCount: 0, present: false },
      normalizedTitleMatch: false,
    },
  },
  fontHints: ["prefer system serif"],
  fontSignals: { families: [], overflowFamilyCount: 0 },
  intent: "wide table report",
  selectedBaseProfileSummary: candidate("wide-table").summary,
  signalMode: "mixed-with-base",
  supportedSchemaSummary: ["page.orientation", "toc.enabled", "fonts.body.default"],
  workingDirectory: "/repo",
};
