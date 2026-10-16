import { assembleDocxEvidence } from "../../../../src/adapters/codex/document-rename/extractors/docx-evidence";
import type { DocxReadResult } from "../../../../src/docx/types";

export { readDocxDocument } from "../../../../src/docx/reader";

/** Exercise the product reader facts through the actual rename evidence assembly. */
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
