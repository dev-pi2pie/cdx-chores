import type { WeasyPrintCandidate } from "./types";

export const WEASYPRINT_CANDIDATES = [
  {
    id: "wp-65-1",
    weasyPrintVersion: "65.1",
    dependencies: { pydyf: "0.12.1", fontTools: "4.63.0" },
  },
  {
    id: "wp-68-0",
    weasyPrintVersion: "68.0",
    dependencies: { pydyf: "0.12.1", fontTools: "4.63.0" },
  },
  {
    id: "wp-69-0",
    weasyPrintVersion: "69.0",
    dependencies: { pydyf: "0.12.1", fontTools: "4.63.0" },
  },
] as const satisfies readonly WeasyPrintCandidate[];

type TestedWeasyPrintCandidate = (typeof WEASYPRINT_CANDIDATES)[number];
type TestedWeasyPrintCandidateId = TestedWeasyPrintCandidate["id"];
type TestedWeasyPrintVersion = TestedWeasyPrintCandidate["weasyPrintVersion"];

export function candidateIdForVersion(
  version: TestedWeasyPrintVersion,
): TestedWeasyPrintCandidateId {
  const candidate = WEASYPRINT_CANDIDATES.find(
    ({ weasyPrintVersion }) => weasyPrintVersion === version,
  );
  if (!candidate) {
    throw new Error(`Renderer scenario references an unconfigured WeasyPrint version: ${version}.`);
  }
  return candidate.id;
}
