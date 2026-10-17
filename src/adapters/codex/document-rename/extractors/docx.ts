import { createDocxSupervisor, type DocxSupervisor } from "../../../../docx/runtime";

import type { DocumentTitleEvidence } from "../types";
import { assembleDocxEvidence } from "./docx-evidence";

/** One factory owner is reused for the complete document-title operation. */
export function createDocxEvidenceExtractor(
  read: DocxSupervisor["read"] = createDocxSupervisor().read,
) {
  return async (path: string): Promise<DocumentTitleEvidence | { reason: string }> => {
    try {
      const result = await read(path);
      if (!result.ok) return { reason: "docx_extract_error" };
      return assembleDocxEvidence(path, { ...result.facts, extractor: "docx-reader" });
    } catch {
      return { reason: "docx_extract_error" };
    }
  };
}

/** A standalone extraction is its own operation; batch callers reuse the factory. */
export async function extractDocxEvidence(path: string) {
  return createDocxEvidenceExtractor()(path);
}
