import { startCodexReadOnlyThread } from "../shared";
import {
  resolveMdPdfTemplateCodexFamily,
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
  const family = resolveMdPdfTemplateCodexFamily(input.request.signals);
  return {
    decisionMode: "no-usable-template",
    slots: resolveMdPdfTemplateCodexSlots({
      family,
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
  const prompt = buildMarkdownPdfTemplateCodexPrompt(request);
  let finalResponse: string;
  try {
    finalResponse = await runner({
      prompt,
      timeoutMs: request.timeoutMs,
      workingDirectory: request.workingDirectory,
    });
  } catch {
    return noUsableTemplateResult({
      reason: "Codex template decision unavailable.",
      request,
    });
  }

  try {
    return applyMarkdownPdfTemplateCodexDecision({
      decision: parseMarkdownPdfTemplateCodexDecision(finalResponse),
      request,
    });
  } catch {
    return noUsableTemplateResult({
      reason: "Codex template decision was rejected by validation.",
      request,
    });
  }
}

export type {
  MarkdownPdfTemplateCodexRequest,
  MarkdownPdfTemplateCodexResult,
  MarkdownPdfTemplateCodexRunner,
} from "./types";
export { applyMarkdownPdfTemplateCodexDecision, parseMarkdownPdfTemplateCodexDecision };
export { buildMarkdownPdfTemplateCodexPrompt };
export { MARKDOWN_PDF_TEMPLATE_CODEX_OUTPUT_SCHEMA };
