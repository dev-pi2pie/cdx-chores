export type MarkdownPdfProjectCodexIdentityUidFactory = (now: Date, attempt: number) => string;

export interface MarkdownPdfProjectCodexIdentity {
  createdAt: string;
  projectBundleId: string;
  profileId: string;
  templateBundleId: string;
  outputDirectory?: string;
}

export interface MarkdownPdfProjectCodexPlannedIdentity extends MarkdownPdfProjectCodexIdentity {
  outputDirectory: string;
}
