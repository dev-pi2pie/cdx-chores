import { startCodexReadOnlyThread } from "../shared";
import { buildMarkdownPdfProfileCodexPrompt } from "./prompt";
import { applyMarkdownPdfCodexDecision, parseMarkdownPdfCodexDecision } from "./decision";
import type {
  MarkdownPdfCodexProfileRequest,
  MarkdownPdfCodexProfileResult,
  MarkdownPdfCodexProfileRunner,
} from "./types";
import { MARKDOWN_PDF_CODEX_FONT_PATCH_ROLES, MARKDOWN_PDF_CODEX_PATCH_PATHS } from "./types";

const MARKDOWN_PDF_CODEX_PROFILE_TIMEOUT_MS = 30_000;

export const MARKDOWN_PDF_CODEX_PROFILE_OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    decision_mode: {
      type: "string",
      enum: ["adapted", "conservative-fallback", "no-usable-profile"],
    },
    selected_candidate_id: { type: "string" },
    accepted_patches: {
      type: "array",
      items: {
        type: "object",
        properties: {
          op: { type: "string", enum: ["replace"] },
          path: { type: "string", enum: [...MARKDOWN_PDF_CODEX_PATCH_PATHS] },
          value: {
            type: ["string", "number", "boolean", "array"],
            items: { type: "string" },
          },
        },
        required: ["op", "path", "value"],
        additionalProperties: false,
      },
    },
    accepted_font_patches: {
      type: "array",
      items: {
        type: "object",
        properties: {
          op: { type: "string", enum: ["replace-font"] },
          role: { type: "string", enum: [...MARKDOWN_PDF_CODEX_FONT_PATCH_ROLES] },
          key: { type: "string" },
          value: { type: "string" },
        },
        required: ["op", "role", "key", "value"],
        additionalProperties: false,
      },
    },
    reasoning: { type: "string" },
    warnings: { type: "array", items: { type: "string" } },
    fallback_reason: { type: "string" },
    unmatched_directions: { type: "array", items: { type: "string" } },
  },
  required: [
    "decision_mode",
    "selected_candidate_id",
    "accepted_patches",
    "accepted_font_patches",
    "reasoning",
    "warnings",
    "fallback_reason",
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

export type MarkdownPdfCodexProfileFailureKind =
  | "structured-output-schema"
  | "malformed-output"
  | "invalid-application"
  | "unavailable";

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
    try {
      return applyMarkdownPdfCodexDecision({
        candidates: request.candidates,
        decision,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new MarkdownPdfCodexProfileError(message, "invalid-application");
    }
  } catch (error) {
    if (error instanceof MarkdownPdfCodexProfileError) {
      throw error;
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new MarkdownPdfCodexProfileError(message, "malformed-output");
  }
}

export type {
  MarkdownPdfCodexDecision,
  MarkdownPdfCodexDecisionMode,
  MarkdownPdfCodexFontPatchRole,
  MarkdownPdfCodexProfileRequest,
  MarkdownPdfCodexProfileFontPatch,
  MarkdownPdfCodexProfileResult,
  MarkdownPdfCodexProfileRunner,
  MarkdownPdfCodexReportPayload,
} from "./types";
export { MARKDOWN_PDF_CODEX_PATCH_VALUE_DOMAINS } from "./value-domains";
