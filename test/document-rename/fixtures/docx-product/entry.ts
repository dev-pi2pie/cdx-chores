/** Compiled Node consumers exercise the product adapter and its fixed runtime siblings. */
export {
  createDocxEvidenceExtractor,
  extractDocxEvidence as extractCandidateDocxEvidence,
} from "../../../../src/adapters/codex/document-rename/extractors/docx";
export {
  extractDocumentTitleEvidenceForPath,
  __testOnlySuggestDocumentRenameTitlesWithBatch,
  __testOnlySuggestDocumentRenameTitlesWithThread,
} from "../../../../src/adapters/codex/document-rename/batch";
export { buildDocumentPrompt } from "../../../../src/adapters/codex/document-rename/prompt";
export { readDocxDocument } from "../../../../src/docx/reader";

import { createDocxSupervisor } from "../../../../src/docx/runtime/index";

export const readCandidateDocx = createDocxSupervisor().read;
