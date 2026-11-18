import type { ModelReasoningEffort } from "@openai/codex-sdk";

import {
  resolveCodexSessionRetention,
  type CodexSessionRetention,
} from "./codex-session-retention";

const CODEX_SPEEDS = ["standard", "fast", "ultrafast"] as const;
export type CodexSpeed = (typeof CODEX_SPEEDS)[number];

export interface CodexExecutionOptions {
  model?: string;
  provider?: string;
  reasoningEffort?: ModelReasoningEffort;
  speed?: CodexSpeed;
  sessionRetention?: CodexSessionRetention;
}

export type ResolvedCodexExecution = Readonly<
  CodexExecutionOptions & { reasoningEffort: ModelReasoningEffort }
>;

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

export function resolveCodexSpeed(value: unknown): CodexSpeed {
  const speed = CODEX_SPEEDS.find((option) => option === value);
  if (speed === undefined) {
    throw new TypeError(`Codex speed must be one of: ${CODEX_SPEEDS.join(", ")}.`);
  }
  return speed;
}

export function resolveCodexSelectors(options?: CodexExecutionOptions): CodexExecutionOptions {
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
  const reasoningEffort = options?.reasoningEffort;
  if (
    reasoningEffort !== undefined &&
    !REASONING_EFFORTS.some((effort) => effort === reasoningEffort)
  ) {
    throw new TypeError(`Codex reasoning effort must be one of: ${REASONING_EFFORTS.join(", ")}.`);
  }

  return {
    ...(model === undefined ? {} : { model }),
    ...(provider === undefined ? {} : { provider }),
    ...(reasoningEffort === undefined ? {} : { reasoningEffort }),
    ...(options?.speed === undefined ? {} : { speed: resolveCodexSpeed(options.speed) }),
    ...(options?.sessionRetention === undefined
      ? {}
      : { sessionRetention: resolveCodexSessionRetention(options.sessionRetention) }),
  };
}

export function resolveCodexExecution(options?: CodexExecutionOptions): ResolvedCodexExecution {
  const selectors = resolveCodexSelectors(options);
  return Object.freeze({ ...selectors, reasoningEffort: selectors.reasoningEffort ?? "low" });
}
