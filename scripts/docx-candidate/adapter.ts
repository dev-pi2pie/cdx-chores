import { createDocxSupervisor } from "../../src/docx/runtime/index";
import { createDocxEvidenceExtractor } from "../../src/adapters/codex/document-rename/extractors/docx";

export { readDocxDocument } from "../../src/docx/reader";
export { createDocxEvidenceExtractor as createCandidateEvidenceExtractor };

const supervisor = createDocxSupervisor();
export const readCandidateDocx = supervisor.read;

export const extractCandidateDocxEvidence = createDocxEvidenceExtractor(readCandidateDocx);
