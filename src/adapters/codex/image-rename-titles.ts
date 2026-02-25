import { basename } from "node:path";

import { Codex } from "@openai/codex-sdk";

export interface CodexImageRenameSuggestion {
  path: string;
  title: string;
}

export interface CodexImageRenameResult {
  suggestions: CodexImageRenameSuggestion[];
  errorMessage?: string;
}

const OUTPUT_SCHEMA = {
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

function normalizeTitle(value: string): string {
  return value
    .replace(/[`"'“”‘’]/g, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function chunkPaths(paths: string[], size: number): string[][] {
  if (size <= 0) {
    return [paths];
  }
  const chunks: string[][] = [];
  for (let i = 0; i < paths.length; i += size) {
    chunks.push(paths.slice(i, i + size));
  }
  return chunks;
}

async function sleep(ms: number): Promise<void> {
  if (ms <= 0) {
    return;
  }
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function suggestSingleBatch(
  options: SuggestImageTitlesOptions,
): Promise<CodexImageRenameResult> {
  if (options.imagePaths.length === 0) {
    return { suggestions: [] };
  }

  const codex = new Codex();
  const thread = codex.startThread({
    workingDirectory: options.workingDirectory,
    sandboxMode: "read-only",
    approvalPolicy: "never",
    modelReasoningEffort: "low",
    networkAccessEnabled: true,
    webSearchMode: "disabled",
  });

  const input = [
    { type: "text", text: buildPrompt(options.imagePaths) } as const,
    ...options.imagePaths.map((path) => ({ type: "local_image", path } as const)),
  ];

  const turn = await thread.run(input, {
    outputSchema: OUTPUT_SCHEMA,
    signal: AbortSignal.timeout(options.timeoutMs ?? 30_000),
  });
  const parsed = JSON.parse(turn.finalResponse) as {
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

export async function suggestImageRenameTitlesWithCodex(
  options: SuggestImageTitlesOptions,
): Promise<CodexImageRenameResult> {
  if (options.imagePaths.length === 0) {
    return { suggestions: [] };
  }

  try {
    const batchSize = Math.max(1, Math.trunc(options.batchSize ?? options.imagePaths.length));
    const retries = Math.max(0, Math.trunc(options.retries ?? 0));
    const batches = chunkPaths(options.imagePaths, batchSize);
    const suggestions: CodexImageRenameSuggestion[] = [];
    const batchErrors: string[] = [];

    for (const batch of batches) {
      let batchResult: CodexImageRenameResult | null = null;
      let lastError = "";

      for (let attempt = 0; attempt <= retries; attempt += 1) {
        try {
          batchResult = await suggestSingleBatch({
            imagePaths: batch,
            workingDirectory: options.workingDirectory,
            timeoutMs: options.timeoutMs,
          });
          lastError = batchResult.errorMessage ?? "";
          if (!batchResult.errorMessage) {
            break;
          }
        } catch (error) {
          lastError = error instanceof Error ? error.message : String(error);
          batchResult = { suggestions: [], errorMessage: lastError };
        }

        if (attempt < retries) {
          await sleep(300 * (attempt + 1));
        }
      }

      if (batchResult?.suggestions?.length) {
        suggestions.push(...batchResult.suggestions);
      }
      if (lastError) {
        batchErrors.push(lastError);
      }
    }

    if (batchErrors.length === 0) {
      return { suggestions };
    }

    const uniqueErrors = [...new Set(batchErrors)];
    const summary = `${suggestions.length > 0 ? "Partial Codex suggestions." : "Codex title generation failed."} ${uniqueErrors[0]}${uniqueErrors.length > 1 ? ` (+${uniqueErrors.length - 1} more error variant(s))` : ""}`;
    return { suggestions, errorMessage: summary };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { suggestions: [], errorMessage: message };
  }
}
