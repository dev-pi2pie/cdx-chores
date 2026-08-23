import { DEFAULT_CODEX_REQUEST_TIMEOUT_MS } from "../../utils/codex-timeout";

export interface InteractiveSessionOptions {
  codexTimeoutMs?: number;
}

export interface InteractiveSession {
  codexTimeoutMs: number;
}

export function createInteractiveSession(
  options: InteractiveSessionOptions = {},
): InteractiveSession {
  return {
    codexTimeoutMs: options.codexTimeoutMs ?? DEFAULT_CODEX_REQUEST_TIMEOUT_MS,
  };
}
