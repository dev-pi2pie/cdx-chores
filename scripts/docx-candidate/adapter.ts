import { assembleDocxEvidence } from "../../src/adapters/codex/document-rename/extractors/docx-evidence";
import { createDocxSupervisor } from "../../src/docx/runtime/index";
import type { DocxReadResult } from "../../src/docx/types";

export { readDocxDocument } from "../../src/docx/reader";

const supervisor = createDocxSupervisor();
export const readCandidateDocx = supervisor.read;

/** Private evidence assembly shared by inline semantic tests and supervised evaluation. */
export function createCandidateEvidenceExtractor(read: (path: string) => Promise<DocxReadResult>) {
  return async (path: string) => {
    try {
      const result = await read(path);
      if (!result.ok) return { reason: "docx_extract_error" } as const;
      return assembleDocxEvidence(path, { ...result.facts, extractor: "docx-reader" });
    } catch {
      return { reason: "docx_extract_error" } as const;
    }
  };
}

export const extractCandidateDocxEvidence = createCandidateEvidenceExtractor(readCandidateDocx);
