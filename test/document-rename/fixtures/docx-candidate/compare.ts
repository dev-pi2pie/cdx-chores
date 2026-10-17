import { buildDocumentPrompt } from "../../../../src/adapters/codex/document-rename/prompt";
import type { DocxSupervisor } from "../../../../src/docx/runtime/index";
import { assertDocxProductObservation } from "../docx-baseline/assertions";
import type { DocxCapture } from "../docx-baseline/capture";
import type { DocxBaselineCase } from "../docx-baseline/corpus/index";
import type * as candidate from "./adapter";

export type CandidateModule = {
  readDocxDocument: typeof candidate.readDocxDocument;
  extractCandidateDocxEvidence: ReturnType<typeof candidate.createCandidateEvidenceExtractor>;
  readCandidateDocx?: DocxSupervisor["read"];
  createCandidateEvidenceExtractor?: typeof candidate.createCandidateEvidenceExtractor;
};

/** Match baseline capture serialization, including omitted optional fields. */
function captured<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export async function compareDocxReader(
  module: CandidateModule,
  item: DocxBaselineCase,
  baseline: DocxCapture,
  bytes: Buffer,
  path: string,
  directory: string,
  observe?: (value: { read: unknown; evidence: unknown }) => Promise<void>,
): Promise<void> {
  const read = module.readCandidateDocx
    ? await module.readCandidateDocx(path)
    : await module.readDocxDocument(bytes);
  const result = captured(await module.extractCandidateDocxEvidence(path));
  // Retention observes the same reads used by assertions, without extra extraction.
  await observe?.({ read: captured(read), evidence: result });
  const prompt =
    "reason" in result
      ? null
      : buildDocumentPrompt({
          evidences: [{ path, evidence: result }],
          workingDirectory: directory,
        });
  assertDocxProductObservation(item, baseline, bytes, { read, evidence: result, prompt });
}
