import { startCodexReadOnlyThread } from "../shared";
import { applyMarkdownPdfCodexDecision, parseMarkdownPdfCodexDecision } from "./decision";
import { buildMarkdownPdfProfileCodexPrompt } from "./prompt";
import type {
  MarkdownPdfCodexProfileRequest,
  MarkdownPdfCodexProfileResult,
  MarkdownPdfCodexProfileRunner,
} from "./types";

export const MARKDOWN_PDF_CODEX_PROFILE_TIMEOUT_MS = 30_000;

export const MARKDOWN_PDF_CODEX_PROFILE_OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    decision_mode: {
      type: "string",
      enum: ["adapted", "conservative-fallback", "no-usable-profile"],
    },
    selected_candidate_id: { type: "string" },
    accepted_fields: { type: "object" },
    reasoning: { type: "string" },
    warnings: { type: "array", items: { type: "string" } },
    fallback_reason: { type: "string" },
    unmatched_directions: { type: "array", items: { type: "string" } },
  },
  required: [
    "decision_mode",
    "selected_candidate_id",
    "accepted_fields",
    "reasoning",
    "warnings",
    "unmatched_directions",
  ],
  additionalProperties: false,
} as const;

async function runMarkdownPdfProfileCodexPrompt(options: {
  prompt: string;
  timeoutMs?: number;
  workingDirectory: string;
}): Promise<string> {
  const thread = await startCodexReadOnlyThread(options.workingDirectory);
  const turn = await thread.run([{ type: "text", text: options.prompt }], {
    outputSchema: MARKDOWN_PDF_CODEX_PROFILE_OUTPUT_SCHEMA,
    signal: AbortSignal.timeout(options.timeoutMs ?? MARKDOWN_PDF_CODEX_PROFILE_TIMEOUT_MS),
  });
  return turn.finalResponse;
}

export type MarkdownPdfCodexProfileFailureKind = "structured-output-schema" | "unavailable";

export function classifyMarkdownPdfCodexProfileFailure(
  error: unknown,
): MarkdownPdfCodexProfileFailureKind {
  const message = error instanceof Error ? error.message : String(error);
  if (
    message.includes("invalid_json_schema") ||
    message.includes("invalid_request_error") ||
    message.includes("response_format") ||
    message.trim().startsWith("{")
  ) {
    return "structured-output-schema";
  }
  return "unavailable";
}

export async function suggestMarkdownPdfProfileWithCodex(
  request: MarkdownPdfCodexProfileRequest & {
    runner?: MarkdownPdfCodexProfileRunner;
    timeoutMs?: number;
  },
): Promise<MarkdownPdfCodexProfileResult> {
  const runner = request.runner ?? runMarkdownPdfProfileCodexPrompt;
  const finalResponse = await runner({
    prompt: buildMarkdownPdfProfileCodexPrompt(request),
    timeoutMs: request.timeoutMs,
    workingDirectory: request.workingDirectory,
  });
  const decision = parseMarkdownPdfCodexDecision(finalResponse);
  return applyMarkdownPdfCodexDecision({
    candidates: request.candidates,
    decision,
  });
}

export { applyMarkdownPdfCodexDecision, parseMarkdownPdfCodexDecision };
export { buildMarkdownPdfProfileCodexPrompt };
export type {
  MarkdownPdfCodexDecision,
  MarkdownPdfCodexDecisionMode,
  MarkdownPdfCodexProfileRequest,
  MarkdownPdfCodexProfileResult,
  MarkdownPdfCodexProfileRunner,
  MarkdownPdfCodexReportPayload,
} from "./types";
