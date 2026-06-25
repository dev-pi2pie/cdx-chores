import { startCodexReadOnlyThread } from "../shared";
import {
  resolveMdPdfTemplateCodexSlots,
  type MarkdownPdfTemplateCodexDecision,
} from "../../../cli/markdown-pdf/template-codex";
import {
  applyMarkdownPdfTemplateCodexDecision,
  parseMarkdownPdfTemplateCodexDecision,
} from "./decision";
import { buildMarkdownPdfTemplateCodexPrompt } from "./prompt";
import { MARKDOWN_PDF_TEMPLATE_CODEX_OUTPUT_SCHEMA } from "./schema";
import type {
  MarkdownPdfTemplateCodexRequest,
  MarkdownPdfTemplateCodexResult,
  MarkdownPdfTemplateCodexRunner,
} from "./types";

const MARKDOWN_PDF_TEMPLATE_CODEX_TIMEOUT_MS = 30_000;
const MARKDOWN_PDF_TEMPLATE_CODEX_APPLICATION_REPAIR_ATTEMPTS = 1;

export type MarkdownPdfTemplateCodexFailureKind =
  | "structured-output-schema"
  | "malformed-output"
  | "invalid-application"
  | "unavailable";

export class MarkdownPdfTemplateCodexError extends Error {
  constructor(
    message: string,
    public readonly kind: MarkdownPdfTemplateCodexFailureKind,
  ) {
    super(message);
    this.name = "MarkdownPdfTemplateCodexError";
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

export function classifyMarkdownPdfTemplateCodexFailure(
  error: unknown,
): MarkdownPdfTemplateCodexFailureKind {
  if (error instanceof MarkdownPdfTemplateCodexError) {
    return error.kind;
  }
  return "unavailable";
}

function fallbackReasonForFailure(kind: MarkdownPdfTemplateCodexFailureKind): string {
  return `Codex template decision failed: ${kind}.`;
}

function summarizeApplicationError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/\{[^{}]*\}/gu, "{ [css-redacted] }")
    .replace(/\bhttps?:\/\/[^\s"'`<>)]*/giu, "[remote-url]")
    .replace(/\bfile:\/\/[^\s"'`<>)]*/giu, "[local-path]")
    .replace(/(^|[\s"'`(=:[,])(?:[A-Za-z]:[\\/][^\s"'`<>),;}]*)/gu, "$1[local-path]")
    .replace(/(^|[\s"'`(=:[,])(?:\\\\[^\s"'`<>),;}]*)/gu, "$1[local-path]")
    .replace(/(^|[\s"'`(=:[,])(?:\/(?!\/)|~\/|\.\.\/)[^\s"'`<>),;}]*/gu, "$1[local-path]")
    .replace(/\s+/gu, " ")
    .slice(0, 600);
}

function buildApplicationRepairPrompt(input: {
  basePrompt: string;
  validationError: string;
}): string {
  return [
    input.basePrompt,
    "",
    "Correction request:",
    "The previous JSON response matched the structured-output schema but failed local Template-Codex validation.",
    `Validation error: ${input.validationError}`,
    "Return corrected JSON only, using the same structured-output schema and deterministic facts.",
    "Do not introduce new files, local paths, remote URLs, raw CSS font-family stacks, or unsupported role/key pairs.",
  ].join("\n");
}

async function runMarkdownPdfTemplateCodexPrompt(options: {
  prompt: string;
  timeoutMs?: number;
  workingDirectory: string;
}): Promise<string> {
  const thread = await startCodexReadOnlyThread(options.workingDirectory);
  const turn = await thread.run([{ type: "text", text: options.prompt }], {
    outputSchema: MARKDOWN_PDF_TEMPLATE_CODEX_OUTPUT_SCHEMA,
    signal: AbortSignal.timeout(options.timeoutMs ?? MARKDOWN_PDF_TEMPLATE_CODEX_TIMEOUT_MS),
  });
  return turn.finalResponse;
}

function createNoUsableTemplateDecision(input: {
  reason: string;
  request: MarkdownPdfTemplateCodexRequest;
}): MarkdownPdfTemplateCodexDecision {
  return {
    decisionMode: "no-usable-template",
    slots: resolveMdPdfTemplateCodexSlots({
      family: "document-layered",
      signals: input.request.signals,
    }),
    cssBlocks: [],
    fontDecisions: [],
    managedAssets: [],
    warnings: [input.reason],
    unsupportedDirections: [],
    fallbackReason: input.reason,
  };
}

function noUsableTemplateResult(input: {
  reason: string;
  request: MarkdownPdfTemplateCodexRequest;
}): MarkdownPdfTemplateCodexResult {
  return applyMarkdownPdfTemplateCodexDecision({
    decision: createNoUsableTemplateDecision(input),
    request: input.request,
  });
}

export async function suggestMarkdownPdfTemplateWithCodex(
  request: MarkdownPdfTemplateCodexRequest & {
    runner?: MarkdownPdfTemplateCodexRunner;
    timeoutMs?: number;
  },
): Promise<MarkdownPdfTemplateCodexResult> {
  const runner = request.runner ?? runMarkdownPdfTemplateCodexPrompt;
  const basePrompt = buildMarkdownPdfTemplateCodexPrompt(request);
  let prompt = basePrompt;
  for (
    let attempt = 0;
    attempt <= MARKDOWN_PDF_TEMPLATE_CODEX_APPLICATION_REPAIR_ATTEMPTS;
    attempt += 1
  ) {
    let finalResponse: string;
    try {
      finalResponse = await runner({
        prompt,
        timeoutMs: request.timeoutMs,
        workingDirectory: request.workingDirectory,
      });
    } catch (error) {
      return noUsableTemplateResult({
        reason: fallbackReasonForFailure(
          isCodexStructuredOutputSchemaError(error) ? "structured-output-schema" : "unavailable",
        ),
        request,
      });
    }

    let decision: MarkdownPdfTemplateCodexDecision;
    try {
      decision = parseMarkdownPdfTemplateCodexDecision(finalResponse);
    } catch {
      return noUsableTemplateResult({
        reason: fallbackReasonForFailure("malformed-output"),
        request,
      });
    }

    try {
      return applyMarkdownPdfTemplateCodexDecision({ decision, request });
    } catch (error) {
      if (attempt < MARKDOWN_PDF_TEMPLATE_CODEX_APPLICATION_REPAIR_ATTEMPTS) {
        prompt = buildApplicationRepairPrompt({
          basePrompt,
          validationError: summarizeApplicationError(error),
        });
        continue;
      }
      return noUsableTemplateResult({
        reason: fallbackReasonForFailure("invalid-application"),
        request,
      });
    }
  }
  return noUsableTemplateResult({
    reason: fallbackReasonForFailure("invalid-application"),
    request,
  });
}

export type {
  MarkdownPdfTemplateCodexRequest,
  MarkdownPdfTemplateCodexResult,
  MarkdownPdfTemplateCodexRunner,
} from "./types";
export { applyMarkdownPdfTemplateCodexDecision, parseMarkdownPdfTemplateCodexDecision };
export { buildMarkdownPdfTemplateCodexPrompt };
export { MARKDOWN_PDF_TEMPLATE_CODEX_OUTPUT_SCHEMA };
