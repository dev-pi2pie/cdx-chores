import {
  resolveCodexExecution,
  type CodexExecutionOptions,
  type ResolvedCodexExecution,
} from "../../../utils/codex-execution";
import { startCodexReadOnlyThread } from "../shared";
import { DEFAULT_CODEX_REQUEST_TIMEOUT_MS } from "../../../utils/codex-timeout";
import { buildMarkdownPdfProfileCodexPrompt } from "./prompt";
import { applyMarkdownPdfCodexDecision, parseMarkdownPdfCodexDecision } from "./decision";
import type {
  MarkdownPdfCodexProfileRequest,
  MarkdownPdfCodexProfileResult,
  MarkdownPdfCodexProfileRunner,
} from "./types";
import {
  MARKDOWN_PDF_CODEX_FONT_PATCH_ROLES,
  MARKDOWN_PDF_CODEX_PATCH_PATHS,
  MARKDOWN_PDF_PROJECT_COVER_INTENTS,
} from "./types";

export const MARKDOWN_PDF_CODEX_PROFILE_TIMEOUT_MS = DEFAULT_CODEX_REQUEST_TIMEOUT_MS;

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

/** Standalone Profile requests keep their existing output contract. */
export const MARKDOWN_PDF_PROJECT_PROFILE_OUTPUT_SCHEMA = {
  ...MARKDOWN_PDF_CODEX_PROFILE_OUTPUT_SCHEMA,
  properties: {
    ...MARKDOWN_PDF_CODEX_PROFILE_OUTPUT_SCHEMA.properties,
    project_cover_intent: { type: "string", enum: [...MARKDOWN_PDF_PROJECT_COVER_INTENTS] },
  },
  required: [...MARKDOWN_PDF_CODEX_PROFILE_OUTPUT_SCHEMA.required, "project_cover_intent"],
} as const;

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
  return message.includes("invalid_json_schema") || message.includes("response_format");
}

function applyMarkdownPdfProfileCodexFinalResponse(input: {
  candidates: MarkdownPdfCodexProfileRequest["candidates"];
  finalResponse: string;
  projectRequest: boolean;
}): MarkdownPdfCodexProfileResult {
  try {
    const decision = parseMarkdownPdfCodexDecision(input.finalResponse, {
      projectRequest: input.projectRequest,
    });
    try {
      return applyMarkdownPdfCodexDecision({
        candidates: input.candidates,
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

export function classifyMarkdownPdfCodexProfileFailure(
  error: unknown,
): MarkdownPdfCodexProfileFailureKind {
  if (error instanceof MarkdownPdfCodexProfileError) {
    return error.kind;
  }
  return "unavailable";
}

async function runMarkdownPdfProfileCodexPrompt(options: {
  prompt: string;
  codexExecution: ResolvedCodexExecution;
  timeoutMs?: number;
  workingDirectory: string;
  projectRequest: boolean;
  onModelRequestAttempt?: () => void;
}): Promise<string> {
  const thread = await startCodexReadOnlyThread(options.workingDirectory, {
    codexExecution: options.codexExecution,
  });
  const signal = AbortSignal.timeout(options.timeoutMs ?? MARKDOWN_PDF_CODEX_PROFILE_TIMEOUT_MS);
  options.onModelRequestAttempt?.();
  const turn = await thread.run([{ type: "text", text: options.prompt }], {
    outputSchema: options.projectRequest
      ? MARKDOWN_PDF_PROJECT_PROFILE_OUTPUT_SCHEMA
      : MARKDOWN_PDF_CODEX_PROFILE_OUTPUT_SCHEMA,
    signal,
  });
  return turn.finalResponse;
}

export async function suggestMarkdownPdfProfileWithCodex(
  request: MarkdownPdfCodexProfileRequest & {
    runner?: MarkdownPdfCodexProfileRunner;
    timeoutMs?: number;
    codexExecution?: CodexExecutionOptions;
    onModelRequestAttempt?: () => void;
  },
): Promise<MarkdownPdfCodexProfileResult> {
  const codexExecution = resolveCodexExecution(request.codexExecution);
  let finalResponse: string;
  try {
    const options = {
      prompt: buildMarkdownPdfProfileCodexPrompt(request),
      timeoutMs: request.timeoutMs,
      codexExecution,
      workingDirectory: request.workingDirectory,
    };
    if (request.runner) {
      request.onModelRequestAttempt?.();
      finalResponse = await request.runner(options);
    } else {
      finalResponse = await runMarkdownPdfProfileCodexPrompt({
        ...options,
        projectRequest: request.projectCoverImageAvailable !== undefined,
        onModelRequestAttempt: request.onModelRequestAttempt,
      });
    }
  } catch (error) {
    if (isCodexStructuredOutputSchemaError(error)) {
      const message = error instanceof Error ? error.message : String(error);
      throw new MarkdownPdfCodexProfileError(message, "structured-output-schema");
    }
    throw error;
  }
  return applyMarkdownPdfProfileCodexFinalResponse({
    candidates: request.candidates,
    finalResponse,
    projectRequest: request.projectCoverImageAvailable !== undefined,
  });
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
export {
  MARKDOWN_PDF_CODEX_PATCH_VALUE_CONSTRAINTS,
  MARKDOWN_PDF_CODEX_PATCH_VALUE_DOMAINS,
} from "./value-domains";
