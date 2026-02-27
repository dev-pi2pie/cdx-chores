import { Codex } from "@openai/codex-sdk";

import { sleep } from "../../utils/sleep";

export interface CodexFilenameTitleSuggestionResult<TSuggestion> {
  suggestions: TSuggestion[];
  errorMessage?: string;
}

export const CODEX_FILENAME_TITLE_OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    suggestions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          filename: { type: "string" },
          title: { type: "string" },
        },
        required: ["filename", "title"],
        additionalProperties: false,
      },
    },
  },
  required: ["suggestions"],
  additionalProperties: false,
} as const;

export function startCodexReadOnlyThread(workingDirectory: string) {
  const codex = new Codex();
  return codex.startThread({
    workingDirectory,
    sandboxMode: "read-only",
    approvalPolicy: "never",
    modelReasoningEffort: "low",
    networkAccessEnabled: true,
    webSearchMode: "disabled",
  });
}

export function normalizeTitle(value: string): string {
  return value
    .replace(/[`"'“”‘’]/g, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function chunkItems<T>(items: T[], size: number): T[][] {
  if (size <= 0) {
    return [items];
  }
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

export function parseFilenameTitleSuggestions(finalResponse: string): Map<string, string> {
  const parsed = JSON.parse(finalResponse) as {
    suggestions?: Array<{ filename?: string; title?: string }>;
  };

  const suggestionsByFilename = new Map<string, string>();
  for (const item of parsed.suggestions ?? []) {
    const filename = (item.filename ?? "").trim();
    const title = normalizeTitle((item.title ?? "").trim());
    if (!filename || !title) {
      continue;
    }
    suggestionsByFilename.set(filename, title);
  }

  return suggestionsByFilename;
}

function retryDelayMs(attempt: number): number {
  return 300 * (attempt + 1);
}

export async function executeBatchesWithRetries<TBatch, TSuggestion>(options: {
  batches: TBatch[];
  retries: number;
  runBatch: (batch: TBatch) => Promise<CodexFilenameTitleSuggestionResult<TSuggestion>>;
}): Promise<{ suggestions: TSuggestion[]; batchErrors: string[] }> {
  const suggestions: TSuggestion[] = [];
  const batchErrors: string[] = [];

  for (const batch of options.batches) {
    let batchResult: CodexFilenameTitleSuggestionResult<TSuggestion> | null = null;
    let lastError = "";

    for (let attempt = 0; attempt <= options.retries; attempt += 1) {
      try {
        batchResult = await options.runBatch(batch);
        lastError = batchResult.errorMessage ?? "";
        if (!batchResult.errorMessage) {
          break;
        }
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        batchResult = { suggestions: [], errorMessage: lastError };
      }

      if (attempt < options.retries) {
        await sleep(retryDelayMs(attempt));
      }
    }

    if (batchResult?.suggestions?.length) {
      suggestions.push(...batchResult.suggestions);
    }
    if (lastError) {
      batchErrors.push(lastError);
    }
  }

  return { suggestions, batchErrors };
}

export function summarizeBatchErrors(batchErrors: string[], hasSuggestions: boolean): string | undefined {
  if (batchErrors.length === 0) {
    return undefined;
  }
  const uniqueErrors = [...new Set(batchErrors)];
  return `${hasSuggestions ? "Partial Codex suggestions." : "Codex title generation failed."} ${uniqueErrors[0]}${uniqueErrors.length > 1 ? ` (+${uniqueErrors.length - 1} more error variant(s))` : ""}`;
}
