import { getCodexPathOverrideFromEnv, runCodexPromptOnly } from "../shared";
import { buildMarkdownPdfProfileCodexPrompt } from "./prompt";
import { applyMarkdownPdfCodexDecision, parseMarkdownPdfCodexDecision } from "./decision";
import type {
  MarkdownPdfCodexProfileRequest,
  MarkdownPdfCodexProfileResult,
  MarkdownPdfCodexProfileRunner,
} from "./types";

const MARKDOWN_PDF_CODEX_PROFILE_TIMEOUT_MS = 30_000;

const MARKDOWN_PDF_CODEX_PROFILE_OUTPUT_SCHEMA = {
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
  return await runCodexPromptOnly({
    outputSchema: MARKDOWN_PDF_CODEX_PROFILE_OUTPUT_SCHEMA,
    prompt: options.prompt,
    timeoutMs: options.timeoutMs ?? MARKDOWN_PDF_CODEX_PROFILE_TIMEOUT_MS,
    work: async ({ outputSchema, prompt, signal, workingDirectory }) => {
      const { Codex } = await import("@openai/codex-sdk");
      const codexPathOverride = getCodexPathOverrideFromEnv();
      const codex = codexPathOverride ? new Codex({ codexPathOverride }) : new Codex();
      const thread = codex.startThread({
        workingDirectory,
        sandboxMode: "read-only",
        approvalPolicy: "never",
        modelReasoningEffort: "low",
        networkAccessEnabled: false,
        webSearchMode: "disabled",
      });
      const turn = await thread.run([{ type: "text", text: prompt }], {
        outputSchema,
        signal,
      });
      return turn.finalResponse;
    },
  });
}

export type MarkdownPdfCodexProfileFailureKind = "structured-output-schema" | "unavailable";

export class MarkdownPdfCodexProfileError extends Error {
  constructor(
    message: string,
    public readonly kind: MarkdownPdfCodexProfileFailureKind,
  ) {
    super(message);
    this.name = "MarkdownPdfCodexProfileError";
  }
}

function isCodexStructuredOutputSchemaError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("invalid_json_schema") ||
    message.includes("invalid_request_error") ||
    message.includes("response_format")
  );
}

export function classifyMarkdownPdfCodexProfileFailure(
  error: unknown,
): MarkdownPdfCodexProfileFailureKind {
  if (error instanceof MarkdownPdfCodexProfileError) {
    return error.kind;
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
  let finalResponse: string;
  try {
    finalResponse = await runner({
      prompt: buildMarkdownPdfProfileCodexPrompt(request),
      timeoutMs: request.timeoutMs,
      workingDirectory: request.workingDirectory,
    });
  } catch (error) {
    if (isCodexStructuredOutputSchemaError(error)) {
      const message = error instanceof Error ? error.message : String(error);
      throw new MarkdownPdfCodexProfileError(message, "structured-output-schema");
    }
    throw error;
  }
  try {
    const decision = parseMarkdownPdfCodexDecision(finalResponse);
    return applyMarkdownPdfCodexDecision({
      candidates: request.candidates,
      decision,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new MarkdownPdfCodexProfileError(message, "structured-output-schema");
  }
}

export type {
  MarkdownPdfCodexDecision,
  MarkdownPdfCodexDecisionMode,
  MarkdownPdfCodexProfileRequest,
  MarkdownPdfCodexProfileResult,
  MarkdownPdfCodexProfileRunner,
  MarkdownPdfCodexReportPayload,
} from "./types";
