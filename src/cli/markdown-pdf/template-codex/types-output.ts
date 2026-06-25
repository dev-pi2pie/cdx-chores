export interface MarkdownPdfTemplateCodexPlannedFile {
  path: string;
  bundlePath: string;
}

export interface MarkdownPdfTemplateCodexPlannedAsset extends MarkdownPdfTemplateCodexPlannedFile {
  role: "cover-image";
  sourcePath: string;
  sourceBasename: string;
}

export type MarkdownPdfTemplateCodexPlannedReport =
  | MarkdownPdfTemplateCodexPlannedBundleReport
  | MarkdownPdfTemplateCodexPlannedExternalReport;

export interface MarkdownPdfTemplateCodexPlannedBundleReport extends MarkdownPdfTemplateCodexPlannedFile {
  location: "in-bundle";
}

export interface MarkdownPdfTemplateCodexPlannedExternalReport {
  path: string;
  location: "external";
}

export interface MarkdownPdfTemplateCodexOutputPlan {
  bundleId: string;
  outputDirectory: string;
  generatedOutputDirectory: boolean;
  templateHtml: MarkdownPdfTemplateCodexPlannedFile;
  styleCss: MarkdownPdfTemplateCodexPlannedFile;
  report?: MarkdownPdfTemplateCodexPlannedReport;
  assets: MarkdownPdfTemplateCodexPlannedAsset[];
}
