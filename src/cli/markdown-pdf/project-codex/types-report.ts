import type { MarkdownPdfCodexPublicPathDisplay } from "../codex-path-display";
import type { MarkdownPdfTemplateCodexCoverImageSignals } from "../template-codex";
import type {
  MarkdownPdfProjectCodexDecisionMode,
  MarkdownPdfProjectCodexSignalMode,
} from "./types-modes";
import type {
  MarkdownPdfProjectCodexProfilePhaseSummary,
  MarkdownPdfProjectCodexTemplatePhaseSummary,
} from "./types-phase";
import type { MarkdownPdfProjectCodexRenderCommand } from "./render-command";
import type { MarkdownPdfProjectCodexValidationResult } from "./validate-project";

export const MARKDOWN_PDF_PROJECT_CODEX_REPORT_ARTIFACT_TYPE = "markdown-pdf-codex-project-report";

export type MarkdownPdfProjectCodexReportFileRole =
  | "profile"
  | "template-html"
  | "style-css"
  | "managed-asset"
  | "project-report";

export interface MarkdownPdfProjectCodexReportManagedAsset {
  role: "cover-image";
  bundlePath: string;
  source: MarkdownPdfCodexPublicPathDisplay;
  format?: NonNullable<MarkdownPdfTemplateCodexCoverImageSignals["format"]>;
  dimensions?: MarkdownPdfTemplateCodexCoverImageSignals["dimensions"];
  aspectRatio?: number;
  orientationBucket: MarkdownPdfTemplateCodexCoverImageSignals["orientationBucket"];
  fitPressure: MarkdownPdfTemplateCodexCoverImageSignals["fitPressure"];
  metadataStatus?: MarkdownPdfTemplateCodexCoverImageSignals["metadataStatus"];
}

export interface MarkdownPdfProjectCodexReportArtifact {
  artifactType: typeof MARKDOWN_PDF_PROJECT_CODEX_REPORT_ARTIFACT_TYPE;
  version: 1;
  advisoryOnly: true;
  reportId: string;
  generatedAt: string;
  identities: {
    projectBundleId: string;
    profileId: string;
    templateBundleId: string;
    createdAt: string;
  };
  project: {
    signalMode: MarkdownPdfProjectCodexSignalMode;
    decisionMode: MarkdownPdfProjectCodexDecisionMode;
    fallbackReason?: string;
  };
  phases: {
    profile: MarkdownPdfProjectCodexProfilePhaseSummary;
    template: MarkdownPdfProjectCodexTemplatePhaseSummary;
  };
  input: {
    markdown?: MarkdownPdfCodexPublicPathDisplay;
    intent?: string;
    fontHints: string[];
    baseProfile?: MarkdownPdfCodexPublicPathDisplay;
    coverImage?: MarkdownPdfProjectCodexReportManagedAsset;
  };
  signals: {
    document: {
      available: boolean;
      headingCount: number;
      maxHeadingDepth: number;
      maxTableColumns: number;
      localAssetCount: number;
      remoteAssetCount: number;
      dataUriAssetCount: number;
      scriptBuckets: Record<string, number>;
      textTruncated: boolean;
    };
    templateOwnedDirections: {
      document: string[];
      intent: string[];
      requiresCodex: boolean;
    };
  };
  unsupportedDirections: string[];
  files: Array<{
    role: MarkdownPdfProjectCodexReportFileRole;
    bundlePath?: string;
    path?: string;
    planned: boolean;
  }>;
  managedAssets: MarkdownPdfProjectCodexReportManagedAsset[];
  validationResults: MarkdownPdfProjectCodexValidationResult[];
  followUpRenderCommand?: MarkdownPdfProjectCodexRenderCommand;
}
