import { relative } from "node:path";

import type { DocumentTitleEvidence, PromptDocumentTitleEvidence } from "./types";

function toPromptFilename(path: string, workingDirectory: string): string {
  return relative(workingDirectory, path).replaceAll("\\", "/");
}

function createPromptEvidence(options: {
  evidence: DocumentTitleEvidence;
  path: string;
  workingDirectory: string;
}): PromptDocumentTitleEvidence {
  return {
    ...options.evidence,
    basename: options.evidence.filename,
    filename: toPromptFilename(options.path, options.workingDirectory),
  };
}

function buildPrompt(evidences: PromptDocumentTitleEvidence[]): string {
  return [
    "Generate concise semantic filename titles for these document files from extracted text evidence.",
    "Return JSON only following the provided schema.",
    "Rules:",
    "- One suggestion per listed filename when there is enough signal.",
    "- Use each item's exact `filename` value in the response so duplicate basenames stay disambiguated.",
    "- `title` should be 2-6 words.",
    "- No file extensions.",
    "- No punctuation except spaces and hyphens.",
    "- Prefer document topic/title over generic words like note/file/document.",
    "- If evidence is weak, use a cautious generic title based on available text only.",
    "",
    "Document evidence JSON:",
    JSON.stringify(evidences, null, 2),
  ].join("\n");
}

export function buildDocumentPrompt(options: {
  evidences: Array<{ path: string; evidence: DocumentTitleEvidence }>;
  workingDirectory: string;
}): string {
  return buildPrompt(
    options.evidences.map((item) =>
      createPromptEvidence({
        evidence: item.evidence,
        path: item.path,
        workingDirectory: options.workingDirectory,
      }),
    ),
  );
}

export function createPromptEvidenceItems(options: {
  evidences: Array<{ path: string; evidence: DocumentTitleEvidence }>;
  workingDirectory: string;
}): Array<{ path: string; promptFilename: string; evidence: DocumentTitleEvidence }> {
  return options.evidences.map((item) => ({
    path: item.path,
    promptFilename: toPromptFilename(item.path, options.workingDirectory),
    evidence: item.evidence,
  }));
}
