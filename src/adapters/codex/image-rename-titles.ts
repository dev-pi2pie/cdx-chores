import { basename } from "node:path";
import type { Thread } from "@openai/codex-sdk";

import { DEFAULT_CODEX_REQUEST_TIMEOUT_MS } from "../../utils/codex-timeout";
import {
  CODEX_FILENAME_TITLE_OUTPUT_SCHEMA,
  chunkItems,
  executeBatchesWithRetries,
  parseFilenameTitleSuggestions,
  startCodexReadOnlyThread,
  summarizeCodexBatchFailures,
} from "./shared";

export interface CodexImageRenameSuggestion {
  path: string;
  title: string;
}

export interface CodexImageRenameResult {
  suggestions: CodexImageRenameSuggestion[];
  errorMessage?: string;
}

interface SuggestImageTitlesOptions {
  imagePaths: string[];
  workingDirectory: string;
  timeoutMs?: number;
  retries?: number;
  batchSize?: number;
}

function buildPrompt(imagePaths: string[]): string {
  const fileList = imagePaths.map((path, index) => `${index + 1}. ${basename(path)}`).join("\n");
  return [
    "Generate concise semantic titles for these image files.",
    "Return JSON only following the provided schema.",
    "Rules:",
    "- One suggestion per listed filename.",
    "- `title` should be 2-6 words.",
    "- Describe visible subject/content when possible.",
    "- No file extensions.",
    "- No punctuation except spaces and hyphens.",
    "- Lower risk of hallucination: if unclear, use a generic but plausible visual label.",
    "",
    "Filenames in order:",
    fileList,
  ].join("\n");
}

async function suggestSingleBatch(
  options: SuggestImageTitlesOptions,
  startThread: StartCodexRenameThread = startCodexReadOnlyThread,
): Promise<CodexImageRenameResult> {
  if (options.imagePaths.length === 0) {
    return { suggestions: [] };
  }

  const thread = await startThread(options.workingDirectory);

  const input = [
    { type: "text", text: buildPrompt(options.imagePaths) } as const,
    ...options.imagePaths.map((path) => ({ type: "local_image", path }) as const),
  ];

  const turn = await thread.run(input, {
    outputSchema: CODEX_FILENAME_TITLE_OUTPUT_SCHEMA,
    signal: AbortSignal.timeout(options.timeoutMs ?? DEFAULT_CODEX_REQUEST_TIMEOUT_MS),
  });
  const suggestionsByFilename = parseFilenameTitleSuggestions(turn.finalResponse);

  const suggestions: CodexImageRenameSuggestion[] = [];
  for (const path of options.imagePaths) {
    const filename = basename(path);
    const title = suggestionsByFilename.get(filename);
    if (!title) {
      continue;
    }
    suggestions.push({ path, title });
  }

  return { suggestions };
}

type SuggestImageBatch = (options: SuggestImageTitlesOptions) => Promise<CodexImageRenameResult>;
type StartCodexRenameThread = (workingDirectory: string) => Promise<Pick<Thread, "run">>;

async function suggestImageRenameTitles(
  options: SuggestImageTitlesOptions,
  suggestBatch: SuggestImageBatch,
): Promise<CodexImageRenameResult> {
  if (options.imagePaths.length === 0) {
    return { suggestions: [] };
  }

  try {
    const timeoutMs = options.timeoutMs ?? DEFAULT_CODEX_REQUEST_TIMEOUT_MS;
    const batchSize = Math.max(1, Math.trunc(options.batchSize ?? options.imagePaths.length));
    const retries = Math.max(0, Math.trunc(options.retries ?? 0));
    const batches = chunkItems(options.imagePaths, batchSize);
    const { suggestions, batchFailures } = await executeBatchesWithRetries({
      batches,
      retries,
      runBatch: async (batch) =>
        suggestBatch({
          imagePaths: batch,
          workingDirectory: options.workingDirectory,
          timeoutMs,
        }),
    });

    const errorSummary = summarizeCodexBatchFailures({
      batchFailures,
      hasSuggestions: suggestions.length > 0,
      requestLabel: "Codex image-title request",
      timeoutMs,
    });
    if (!errorSummary) {
      return { suggestions };
    }

    return { suggestions, errorMessage: errorSummary };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { suggestions: [], errorMessage: message };
  }
}

export async function suggestImageRenameTitlesWithCodex(
  options: SuggestImageTitlesOptions,
): Promise<CodexImageRenameResult> {
  return suggestImageRenameTitles(options, suggestSingleBatch);
}

export async function __testOnlySuggestImageRenameTitlesWithBatch(
  options: SuggestImageTitlesOptions,
  suggestBatch: SuggestImageBatch,
): Promise<CodexImageRenameResult> {
  return suggestImageRenameTitles(options, suggestBatch);
}

export async function __testOnlySuggestImageRenameTitlesWithThread(
  options: SuggestImageTitlesOptions,
  startThread: StartCodexRenameThread,
): Promise<CodexImageRenameResult> {
  return suggestImageRenameTitles(options, (batchOptions) =>
    suggestSingleBatch(batchOptions, startThread),
  );
}
