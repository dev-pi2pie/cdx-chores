import type { ModelReasoningEffort } from "@openai/codex-sdk";

export interface CodexExecutionOptions {
  model?: string;
  provider?: string;
  reasoningEffort?: ModelReasoningEffort;
}

export interface ResolvedCodexExecution {
  readonly model?: string;
  readonly provider?: string;
  readonly reasoningEffort: ModelReasoningEffort;
}

const REASONING_EFFORTS = [
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
  "ultra",
  "persistent",
] as const satisfies readonly ModelReasoningEffort[];

function resolveIdentifier(value: unknown, name: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`Codex ${name} must be a non-empty string.`);
  }
  return value.trim();
}

export function resolveCodexExecution(options?: CodexExecutionOptions): ResolvedCodexExecution {
  if (
    options !== undefined &&
    (options === null ||
      typeof options !== "object" ||
      (Object.getPrototypeOf(options) !== Object.prototype &&
        Object.getPrototypeOf(options) !== null))
  ) {
    throw new TypeError("Codex execution options must be an object.");
  }

  const model = resolveIdentifier(options?.model, "model");
  const provider = resolveIdentifier(options?.provider, "provider");
  const reasoningEffort = options?.reasoningEffort === undefined ? "low" : options.reasoningEffort;
  if (!REASONING_EFFORTS.some((effort) => effort === reasoningEffort)) {
    throw new TypeError(`Codex reasoning effort must be one of: ${REASONING_EFFORTS.join(", ")}.`);
  }

  return Object.freeze({
    ...(model === undefined ? {} : { model }),
    ...(provider === undefined ? {} : { provider }),
    reasoningEffort,
  });
}
