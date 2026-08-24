import { startCodexReadOnlyThread } from "../../adapters/codex/shared";
import { classifyCodexRequestFailure } from "../../utils/codex-request-failure";
import { DEFAULT_CODEX_REQUEST_TIMEOUT_MS } from "../../utils/codex-timeout";
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
  const thread = await startCodexReadOnlyThread(options.workingDirectory);
  const turn = await thread.run([{ type: "text", text: options.prompt }], {
    outputSchema: DATA_QUERY_CODEX_OUTPUT_SCHEMA,
    signal: AbortSignal.timeout(options.timeoutMs ?? DEFAULT_CODEX_REQUEST_TIMEOUT_MS),
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
    const timeoutMs = options.timeoutMs ?? DEFAULT_CODEX_REQUEST_TIMEOUT_MS;
    const normalizedIntent = normalizeDataQueryCodexIntent(options.intent);
    const finalResponse = await runner({
      prompt: buildDataQueryCodexPrompt({
        format: options.format,
        intent: normalizedIntent,
        introspection: options.introspection,
      }),
      workingDirectory: options.workingDirectory,
      timeoutMs,
    });
    return {
      draft: parseDataQueryCodexDraft(finalResponse),
    };
  } catch (error) {
    return {
      errorMessage: error instanceof Error ? error.message : String(error),
      failureKind: classifyCodexRequestFailure(error),
    };
  }
}
