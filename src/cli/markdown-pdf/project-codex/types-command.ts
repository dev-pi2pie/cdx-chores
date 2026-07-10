import type { MarkdownPdfCodexProfileRunner } from "../../../adapters/codex/markdown-pdf-profile";
import type { MarkdownPdfTemplateCodexRunner } from "../../../adapters/codex/markdown-pdf-template";
import type { MarkdownPdfProjectCodexIdentityUidFactory } from "./types-identity";

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
  identityUidFactory?: MarkdownPdfProjectCodexIdentityUidFactory;
  profileCodexRunner?: MarkdownPdfCodexProfileRunner;
  templateCodexRunner?: MarkdownPdfTemplateCodexRunner;
}

type MdPdfProjectCodexNonCliOption =
  | "identityUidFactory"
  | "positionalInput"
  | "profileCodexRunner"
  | "templateCodexRunner";

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
