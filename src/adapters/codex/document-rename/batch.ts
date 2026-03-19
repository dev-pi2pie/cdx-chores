import { extname, basename } from "node:path";
import { readFile } from "node:fs/promises";

import {
  CODEX_FILENAME_TITLE_OUTPUT_SCHEMA,
  chunkItems,
  executeBatchesWithRetries,
  parseFilenameTitleSuggestions,
  startCodexReadOnlyThread,
  summarizeBatchErrors,
} from "../shared";
import { parseTomlFrontmatter } from "../../../markdown/toml-simple";
import {
  DOC_DOCX_EXTENSIONS,
  DOC_HTML_EXTENSIONS,
  DOC_JSON_EXTENSIONS,
  DOC_MARKDOWN_EXTENSIONS,
  DOC_PDF_EXTENSIONS,
  DOC_PLAIN_TEXT_EXTENSIONS,
  DOC_TOML_EXTENSIONS,
  DOC_XML_EXTENSIONS,
  DOC_YAML_EXTENSIONS,
  type CodexDocumentRenameReason,
  type CodexDocumentRenameResult,
  type DocumentTitleEvidence,
  type ExtractedDocumentTitleEvidence,
  type SuggestDocumentTitlesOptions,
} from "./types";
import { extractDocxEvidence } from "./extractors/docx";
import { extractHtmlEvidence } from "./extractors/html";
import { extractMarkdownEvidence } from "./extractors/markdown";
import { extractPdfEvidence } from "./extractors/pdf";
import { extractJsonEvidence, extractTomlEvidence, extractYamlEvidence } from "./extractors/structured";
import { extractPlainTextEvidence } from "./extractors/text";
import { extractXmlEvidence } from "./extractors/xml";
import { buildDocumentPrompt, createPromptEvidenceItems } from "./prompt";

async function extractEvidenceForPath(
  path: string,
): Promise<ExtractedDocumentTitleEvidence> {
  const ext = extname(path).toLowerCase();

  if (DOC_PDF_EXTENSIONS.has(ext)) {
    const extracted = await extractPdfEvidence(path);
    return "reason" in extracted ? { reason: extracted.reason } : { evidence: extracted };
  }

  if (DOC_DOCX_EXTENSIONS.has(ext)) {
    const extracted = await extractDocxEvidence(path);
    return "reason" in extracted ? { reason: extracted.reason } : { evidence: extracted };
  }

  let content: string;
  try {
    content = await readFile(path, "utf8");
  } catch {
    return { reason: "doc_extract_error" };
  }

  if (DOC_MARKDOWN_EXTENSIONS.has(ext)) {
    const extracted = extractMarkdownEvidence(path, content);
    return "reason" in extracted ? { reason: extracted.reason } : { evidence: extracted };
  }

  if (DOC_PLAIN_TEXT_EXTENSIONS.has(ext)) {
    const extracted = extractPlainTextEvidence(path, content);
    return "reason" in extracted ? { reason: extracted.reason } : { evidence: extracted };
  }

  if (DOC_JSON_EXTENSIONS.has(ext)) {
    const extracted = extractJsonEvidence(path, content);
    return "reason" in extracted ? { reason: extracted.reason } : { evidence: extracted };
  }

  if (DOC_YAML_EXTENSIONS.has(ext)) {
    const extracted = extractYamlEvidence(path, content);
    return "reason" in extracted ? { reason: extracted.reason } : { evidence: extracted };
  }

  if (DOC_TOML_EXTENSIONS.has(ext)) {
    const extracted = extractTomlEvidence(path, content);
    return "reason" in extracted ? { reason: extracted.reason } : { evidence: extracted };
  }

  if (DOC_HTML_EXTENSIONS.has(ext)) {
    const extracted = extractHtmlEvidence(path, content);
    return "reason" in extracted ? { reason: extracted.reason } : { evidence: extracted };
  }

  if (DOC_XML_EXTENSIONS.has(ext)) {
    const extracted = extractXmlEvidence(path, content);
    return "reason" in extracted ? { reason: extracted.reason } : { evidence: extracted };
  }

  return { reason: "doc_unsupported_type" };
}

async function suggestSingleBatch(options: {
  evidences: Array<{ path: string; promptFilename: string; evidence: DocumentTitleEvidence }>;
  workingDirectory: string;
  timeoutMs?: number;
}): Promise<CodexDocumentRenameResult> {
  if (options.evidences.length === 0) {
    return { suggestions: [] };
  }

  const thread = startCodexReadOnlyThread(options.workingDirectory);
  const turn = await thread.run(
    [{
      type: "text",
      text: buildDocumentPrompt({
        evidences: options.evidences.map((item) => ({ path: item.path, evidence: item.evidence })),
        workingDirectory: options.workingDirectory,
      }),
    }],
    {
      outputSchema: CODEX_FILENAME_TITLE_OUTPUT_SCHEMA,
      signal: AbortSignal.timeout(options.timeoutMs ?? 30_000),
    },
  );

  const suggestionsByFilename = parseFilenameTitleSuggestions(turn.finalResponse);

  const suggestions = [];
  for (const item of options.evidences) {
    const title = suggestionsByFilename.get(item.promptFilename);
    if (!title) {
      continue;
    }
    suggestions.push({ path: item.path, title });
  }

  return { suggestions };
}

export async function suggestDocumentRenameTitlesWithCodex(
  options: SuggestDocumentTitlesOptions,
): Promise<CodexDocumentRenameResult> {
  if (options.documentPaths.length === 0) {
    return { suggestions: [] };
  }

  const reasons: CodexDocumentRenameReason[] = [];
  const extractedItems: Array<{ path: string; evidence: DocumentTitleEvidence }> = [];

  for (const path of options.documentPaths) {
    const extracted = await extractEvidenceForPath(path);
    if (extracted.reason) {
      reasons.push({ path, reason: extracted.reason });
      continue;
    }
    if (extracted.evidence) {
      extractedItems.push({ path, evidence: extracted.evidence });
    }
  }

  if (extractedItems.length === 0) {
    return { suggestions: [], reasons };
  }

  try {
    const evidenceItems = createPromptEvidenceItems({
      evidences: extractedItems,
      workingDirectory: options.workingDirectory,
    });
    const batchSize = Math.max(1, Math.trunc(options.batchSize ?? evidenceItems.length));
    const retries = Math.max(0, Math.trunc(options.retries ?? 0));
    const batches = chunkItems(evidenceItems, batchSize);
    const { suggestions, batchErrors } = await executeBatchesWithRetries({
      batches,
      retries,
      runBatch: async (batch) =>
        suggestSingleBatch({
          evidences: batch,
          workingDirectory: options.workingDirectory,
          timeoutMs: options.timeoutMs,
        }),
    });

    const errorSummary = summarizeBatchErrors(batchErrors, suggestions.length > 0);
    if (!errorSummary) {
      return { suggestions, reasons };
    }

    return { suggestions, reasons, errorMessage: errorSummary };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { suggestions: [], reasons, errorMessage: message };
  }
}

export async function extractDocumentTitleEvidenceForPath(
  path: string,
): Promise<ExtractedDocumentTitleEvidence> {
  return extractEvidenceForPath(path);
}
