export const DEFAULT_CODEX_REQUEST_TIMEOUT_MS = 30_000;
export const MAX_CODEX_REQUEST_TIMEOUT_MS = 600_000;

export function formatCodexTimeoutDuration(timeoutMs: number): string {
  if (Number.isSafeInteger(timeoutMs) && timeoutMs > 0) {
    if (timeoutMs % 60_000 === 0) {
      return `${timeoutMs / 60_000}m`;
    }
    if (timeoutMs % 1_000 === 0) {
      return `${timeoutMs / 1_000}s`;
    }
  }
  return `${timeoutMs}ms`;
}
