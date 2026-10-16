import { readFile } from "node:fs/promises";

import { assembleDocxEvidence } from "../../src/adapters/codex/document-rename/extractors/docx-evidence";
import { readDocxDocument } from "../../src/docx/reader";

export { readDocxDocument } from "../../src/docx/reader";

/** Test-only trusted-input adapter; resource supervision is a later phase. */
export async function extractCandidateDocxEvidence(path: string) {
  try {
    const result = await readDocxDocument(await readFile(path));
    if (!result.ok) return { reason: "docx_extract_error" } as const;
    return assembleDocxEvidence(path, { ...result.facts, extractor: "docx-reader" });
  } catch {
    return { reason: "docx_extract_error" } as const;
  }
}
