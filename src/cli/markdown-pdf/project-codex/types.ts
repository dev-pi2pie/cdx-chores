export type MarkdownPdfProjectCodexSignalMode =
  | "too-low-signal"
  | "deterministic"
  | "codex-assisted";

export type MarkdownPdfProjectCodexDecisionMode =
  | "deterministic"
  | "adapted"
  | "conservative-fallback"
  | "no-usable-project";

export type MarkdownPdfProjectCodexPhaseName = "profile" | "template";

export type MarkdownPdfProjectCodexProfilePhaseSignalMode =
  | "document-informed"
  | "hint-only"
  | "mixed-with-base"
  | "base-only-deterministic"
  | "basic-default";

export type MarkdownPdfProjectCodexTemplatePhaseSignalMode =
  | "base-profile-only"
  | "cover-image-only"
  | "deterministic"
  | "codex-assisted";

export interface MdPdfProjectCodexOptions {
  input?: string;
  positionalInput?: string;
  intent?: string;
  fontHint?: string[];
  baseProfile?: string;
  coverImage?: string;
  output?: string;
  dryRun?: boolean;
  keepCodexReport?: boolean;
  codexReportOutput?: string;
  overwrite?: boolean;
}

type MdPdfProjectCodexNonCliOption = "positionalInput";

export type MdPdfProjectCodexCliOptions = Omit<
  MdPdfProjectCodexOptions,
  MdPdfProjectCodexNonCliOption
>;

export interface NormalizedMdPdfProjectCodexCommandState {
  inputPath?: string;
  intent?: string;
  fontHints: string[];
  baseProfilePath?: string;
  coverImagePath?: string;
  outputDirectory?: string;
  dryRun: boolean;
  keepCodexReport: boolean;
  codexReportOutputPath?: string;
  overwrite: boolean;
}

export interface MarkdownPdfProjectCodexIdentity {
  createdAt: string;
  projectBundleId: string;
  profileId: string;
  templateBundleId: string;
  outputDirectory?: string;
}

export interface MarkdownPdfProjectCodexPhaseSummary {
  phase: MarkdownPdfProjectCodexPhaseName;
  signalMode:
    | MarkdownPdfProjectCodexProfilePhaseSignalMode
    | MarkdownPdfProjectCodexTemplatePhaseSignalMode;
  decisionMode: MarkdownPdfProjectCodexDecisionMode;
  fallbackReason?: string;
  warnings: string[];
}

export interface MarkdownPdfProjectCodexReportArtifact {
  artifactType: "markdown-pdf-codex-project-report";
  artifact: {
    version: 1;
    advisoryOnly: true;
  };
  project: MarkdownPdfProjectCodexIdentity;
  signalMode: MarkdownPdfProjectCodexSignalMode;
  decisionMode: MarkdownPdfProjectCodexDecisionMode;
  phases: MarkdownPdfProjectCodexPhaseSummary[];
}
