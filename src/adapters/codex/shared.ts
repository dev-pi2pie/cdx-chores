import { accessSync, constants, existsSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { Codex } from "@openai/codex-sdk";

import { sleep } from "../../utils/sleep";

export interface CodexEnvironmentInspection {
  authSessionAvailable: boolean;
  configuredSupport: boolean;
  detail?: string;
}

const CODEX_PATH_OVERRIDE_ENV = "CDX_CHORES_CODEX_PATH";

function resolveCodexHome(): string {
  const override = process.env.CODEX_HOME?.trim();
  if (override) {
    return override;
  }
  return join(homedir(), ".codex");
}

export function getCodexPathOverrideFromEnv(): string | undefined {
  const value = process.env[CODEX_PATH_OVERRIDE_ENV]?.trim();
  return value ? value : undefined;
}

function inspectCodexPathOverride(codexPathOverride: string): string | undefined {
  try {
    const stats = statSync(codexPathOverride);
    if (!stats.isFile()) {
      return `Codex override path is not a file: ${codexPathOverride}`;
    }
    accessSync(codexPathOverride, constants.X_OK);
    return undefined;
  } catch (error) {
    return `Codex override path is not executable: ${codexPathOverride} (${error instanceof Error ? error.message : String(error)})`;
  }
}

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

export function startCodexReadOnlyThread(
  workingDirectory: string,
  options: { codexPathOverride?: string } = {},
) {
  const codexPathOverride = options.codexPathOverride ?? getCodexPathOverrideFromEnv();
  const codex = codexPathOverride ? new Codex({ codexPathOverride }) : new Codex();
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

export async function inspectCodexEnvironment(): Promise<CodexEnvironmentInspection> {
  try {
    await import("@openai/codex-sdk");
  } catch (error) {
    return {
      authSessionAvailable: false,
      configuredSupport: false,
      detail: error instanceof Error ? error.message : String(error),
    };
  }

  const codexPathOverride = getCodexPathOverrideFromEnv();
  const hasAuthSignal =
    Boolean(process.env.CODEX_API_KEY?.trim()) ||
    Boolean(process.env.OPENAI_API_KEY?.trim()) ||
    existsSync(join(resolveCodexHome(), "auth.json"));

  if (codexPathOverride) {
    const overrideProblem = inspectCodexPathOverride(codexPathOverride);
    if (overrideProblem) {
      return {
        authSessionAvailable: hasAuthSignal,
        configuredSupport: false,
        detail: overrideProblem,
      };
    }
  }

  if (!hasAuthSignal) {
    return {
      authSessionAvailable: false,
      configuredSupport: true,
      detail: "No Codex auth/session signal found. Sign in to Codex or provide CODEX_API_KEY.",
    };
  }

  return {
    authSessionAvailable: true,
    configuredSupport: true,
  };
}
