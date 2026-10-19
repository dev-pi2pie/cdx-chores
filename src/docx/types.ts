import type { ReadDocxCoreMetadataResult } from "../adapters/docx/ooxml-metadata";

export interface DocxDocumentFacts {
  headings: { level: number; text: string }[];
  rawText: string;
  /** Nonempty converter content, including structure without usable title text. */
  hasContent: boolean;
  metadataResult: ReadDocxCoreMetadataResult;
  diagnostics: string[];
}

export type DocxReadResult =
  | { ok: true; facts: DocxDocumentFacts }
  | { ok: false; diagnostic: string };
