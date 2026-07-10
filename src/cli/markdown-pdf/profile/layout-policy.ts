import type { MarkdownPdfTableSignals } from "./signals";

export type MarkdownPdfTableLayoutRiskLevel = "none" | "weak" | "strong";

export const MARKDOWN_PDF_TABLE_TEMPLATE_ONLY_DIRECTIONS = [
  "custom table column widths",
  "arbitrary table CSS",
  "rotated individual pages",
  "exact table beautification",
] as const;

export type MarkdownPdfTableTemplateOnlyDirection =
  (typeof MARKDOWN_PDF_TABLE_TEMPLATE_ONLY_DIRECTIONS)[number];

export interface MarkdownPdfTableLayoutSignal {
  level: MarkdownPdfTableLayoutRiskLevel;
  reasons: string[];
  recommendation: string;
  signalLadder: string[];
  templateOnlyDirections: MarkdownPdfTableTemplateOnlyDirection[];
}

export function markdownPdfTableLayoutRiskLevel(
  tables: MarkdownPdfTableSignals,
): MarkdownPdfTableLayoutRiskLevel {
  if (tables.overflowRows > 0 || tables.maxLineWidth >= 100 || tables.maxColumns >= 8) {
    return "strong";
  }
  if (tables.scannedRows > 0 || tables.maxLineWidth >= 80 || tables.maxColumns >= 5) {
    return "weak";
  }
  return "none";
}

export function buildMarkdownPdfTableLayoutSignal(
  tables: MarkdownPdfTableSignals,
): MarkdownPdfTableLayoutSignal {
  const level = markdownPdfTableLayoutRiskLevel(tables);
  const reasons: string[] = [];
  if (tables.overflowRows > 0) {
    reasons.push("table rows exceeded the bounded scan limit");
  }
  if (tables.maxLineWidth >= 100) {
    reasons.push("table rows have high line width");
  } else if (tables.maxLineWidth >= 80) {
    reasons.push("table rows have moderate line width");
  }
  if (tables.maxColumns >= 8) {
    reasons.push("table rows have many columns");
  } else if (tables.maxColumns >= 5) {
    reasons.push("table rows have moderately many columns");
  }
  if (tables.scannedRows > 0 && reasons.length === 0) {
    reasons.push("tables are present but table-fit risk is weak");
  }

  return {
    level,
    reasons,
    recommendation:
      level === "strong"
        ? "Prefer wide-table or landscape/table-friendly profile settings unless intent explicitly requires portrait."
        : level === "weak"
          ? "Treat table presence as supporting evidence only; do not force landscape by itself."
          : "No table layout signal.",
    signalLadder: ["overflowRows", "maxLineWidth", "maxColumns", "scannedRows"],
    templateOnlyDirections: [...MARKDOWN_PDF_TABLE_TEMPLATE_ONLY_DIRECTIONS],
  };
}
