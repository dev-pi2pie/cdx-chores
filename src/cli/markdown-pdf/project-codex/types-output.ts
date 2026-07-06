import type { MarkdownPdfProjectCodexPlannedIdentity } from "./types-identity";

export interface MarkdownPdfProjectCodexPlannedFile {
  path: string;
  bundlePath: string;
}

export interface MarkdownPdfProjectCodexPlannedAsset extends MarkdownPdfProjectCodexPlannedFile {
  role: "cover-image";
  sourcePath: string;
  sourceBasename: string;
}

export type MarkdownPdfProjectCodexPlannedReport =
  | MarkdownPdfProjectCodexPlannedBundleReport
  | MarkdownPdfProjectCodexPlannedExternalReport;

export interface MarkdownPdfProjectCodexPlannedBundleReport extends MarkdownPdfProjectCodexPlannedFile {
  location: "in-bundle";
}

export interface MarkdownPdfProjectCodexPlannedExternalReport {
  path: string;
  location: "external";
}

export interface MarkdownPdfProjectCodexOutputPlan {
  identity: MarkdownPdfProjectCodexPlannedIdentity;
  outputDirectory: string;
  generatedOutputDirectory: boolean;
  profile: MarkdownPdfProjectCodexPlannedFile;
  templateHtml: MarkdownPdfProjectCodexPlannedFile;
  styleCss: MarkdownPdfProjectCodexPlannedFile;
  report?: MarkdownPdfProjectCodexPlannedReport;
  assets: MarkdownPdfProjectCodexPlannedAsset[];
}
