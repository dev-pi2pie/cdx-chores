import { DEFAULT_CODEX_REQUEST_TIMEOUT_MS } from "../../utils/codex-timeout";
import {
  resolveCodexExecution,
  type CodexExecutionOptions,
  type ResolvedCodexExecution,
} from "../../utils/codex-execution";

export interface InteractiveSessionOptions {
  codexExecution?: CodexExecutionOptions;
  codexTimeoutMs?: number;
}

export interface InteractiveSession {
  readonly codexExecution: ResolvedCodexExecution;
  codexTimeoutMs: number;
}

export function createInteractiveSession(
  options: InteractiveSessionOptions = {},
): InteractiveSession {
  return {
    codexExecution: resolveCodexExecution(options.codexExecution),
    codexTimeoutMs: options.codexTimeoutMs ?? DEFAULT_CODEX_REQUEST_TIMEOUT_MS,
  };
}
