import type { RendererEvidenceReport } from "./contract";
import { publicSafeText } from "./pdf";

export function publicEvidenceReport(
  report: RendererEvidenceReport,
): Omit<RendererEvidenceReport, "labPath" | "temporaryImages"> {
  const { labPath: _labPath, temporaryImages: _temporaryImages, ...publicReport } = report;
  return {
    ...publicReport,
    failures: report.failures.map((failure) => ({
      ...failure,
      message: publicSafeText(failure.message),
    })),
    visualConclusions: report.visualConclusions.map((conclusion) => ({
      ...conclusion,
      conclusion: publicSafeText(conclusion.conclusion),
    })),
    retained: false,
  };
}
