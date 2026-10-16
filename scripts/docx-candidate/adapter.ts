import { createDocxSupervisor } from "../../src/docx/runtime/index";
import { createCandidateEvidenceExtractor } from "../../test/document-rename/fixtures/docx-candidate/adapter";

export {
  readDocxDocument,
  createCandidateEvidenceExtractor,
} from "../../test/document-rename/fixtures/docx-candidate/adapter";

const supervisor = createDocxSupervisor();
export const readCandidateDocx = supervisor.read;

export const extractCandidateDocxEvidence = createCandidateEvidenceExtractor(readCandidateDocx);
