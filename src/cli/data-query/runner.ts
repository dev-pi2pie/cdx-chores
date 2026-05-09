import { startCodexReadOnlyThread } from "../../adapters/codex/shared";
import type { DataQueryInputFormat } from "../duckdb/query";
import { parseDataQueryCodexDraft, type DataQueryCodexDraftResult } from "./parse";
import { buildDataQueryCodexPrompt, normalizeDataQueryCodexIntent } from "./prompt";
import type { DataQueryCodexIntrospection } from "./view";

const DATA_QUERY_CODEX_OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    sql: {
      type: "string",
    },
    reasoning_summary: {
      type: "string",
    },
  },
  required: ["sql", "reasoning_summary"],
  additionalProperties: false,
} as const;

const DATA_QUERY_CODEX_TIMEOUT_MS = 30_000;

export type DataQueryCodexRunner = (options: {
  prompt: string;
  workingDirectory: string;
  timeoutMs?: number;
}) => Promise<string>;

async function runDataQueryCodexPrompt(options: {
  prompt: string;
  workingDirectory: string;
  timeoutMs?: number;
}): Promise<string> {
  const thread = startCodexReadOnlyThread(options.workingDirectory);
  const turn = await thread.run([{ type: "text", text: options.prompt }], {
    outputSchema: DATA_QUERY_CODEX_OUTPUT_SCHEMA,
    signal: AbortSignal.timeout(options.timeoutMs ?? DATA_QUERY_CODEX_TIMEOUT_MS),
  });
  return turn.finalResponse;
}

export async function draftDataQueryWithCodex(options: {
  format: DataQueryInputFormat;
  intent: string;
  introspection: DataQueryCodexIntrospection;
  runner?: DataQueryCodexRunner;
  timeoutMs?: number;
  workingDirectory: string;
}): Promise<DataQueryCodexDraftResult> {
  try {
    const runner = options.runner ?? runDataQueryCodexPrompt;
    const normalizedIntent = normalizeDataQueryCodexIntent(options.intent);
    const finalResponse = await runner({
      prompt: buildDataQueryCodexPrompt({
        format: options.format,
        intent: normalizedIntent,
        introspection: options.introspection,
      }),
      workingDirectory: options.workingDirectory,
      timeoutMs: options.timeoutMs,
    });
    return {
      draft: parseDataQueryCodexDraft(finalResponse),
    };
  } catch (error) {
    return {
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  }
}
