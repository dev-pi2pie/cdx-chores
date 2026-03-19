export interface CodexDocumentRenameSuggestion {
  path: string;
  title: string;
}

export interface CodexDocumentRenameReason {
  path: string;
  reason: string;
}

export interface CodexDocumentRenameResult {
  suggestions: CodexDocumentRenameSuggestion[];
  reasons?: CodexDocumentRenameReason[];
  errorMessage?: string;
}

export interface SuggestDocumentTitlesOptions {
  documentPaths: string[];
  workingDirectory: string;
  timeoutMs?: number;
  retries?: number;
  batchSize?: number;
}

export interface DocumentTitleEvidence {
  filename: string;
  extension: string;
  detectedType: "markdown" | "text" | "json" | "yaml" | "toml" | "html" | "xml" | "pdf" | "docx";
  titleCandidates: string[];
  authorCandidates?: string[];
  headings?: string[];
  tocCandidates?: string[];
  leadText?: string;
  keySummary?: string[];
  metadata?: Record<string, unknown>;
  warnings?: string[];
}

export interface PromptDocumentTitleEvidence extends Omit<DocumentTitleEvidence, "filename"> {
  basename: string;
  filename: string;
}

export type ExtractedDocumentTitleEvidence = { evidence?: DocumentTitleEvidence; reason?: string };

export const DOC_MARKDOWN_EXTENSIONS = new Set([".md", ".markdown"]);
export const DOC_PLAIN_TEXT_EXTENSIONS = new Set([".txt"]);
export const DOC_JSON_EXTENSIONS = new Set([".json"]);
export const DOC_YAML_EXTENSIONS = new Set([".yaml", ".yml"]);
export const DOC_TOML_EXTENSIONS = new Set([".toml"]);
export const DOC_HTML_EXTENSIONS = new Set([".html", ".htm"]);
export const DOC_XML_EXTENSIONS = new Set([".xml"]);
export const DOC_PDF_EXTENSIONS = new Set([".pdf"]);
export const DOC_DOCX_EXTENSIONS = new Set([".docx"]);
export const MAX_TITLE_CANDIDATES = 4;
export const MAX_HEADINGS = 8;
export const MAX_LEAD_TEXT_CHARS = 800;
export const MAX_KEY_SUMMARY = 12;
export const DOCX_WEAK_TITLE_CANDIDATES = new Set([
  "agenda",
  "draft",
  "goal",
  "goals",
  "links",
  "meeting notes",
  "notes",
  "outline",
  "overview",
  "references",
  "summary",
  "table of contents",
  "untitled",
]);

export type DocxHeadingSignal = {
  level: number;
  text: string;
};
