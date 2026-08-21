import { formatCodexTimeoutDuration } from "../../utils/codex-timeout";

export type CodexRequestFailureKind = "timeout" | "aborted" | "other";

const MAX_CODEX_FAILURE_CAUSE_DEPTH = 8;

function readObjectProperty(value: object, property: "name" | "cause"): unknown {
  try {
    return Reflect.get(value, property);
  } catch {
    return undefined;
  }
}

export function classifyCodexRequestFailure(error: unknown): CodexRequestFailureKind {
  let current = error;
  let sawAbort = false;
  const visited = new Set<object>();

  for (let depth = 0; depth < MAX_CODEX_FAILURE_CAUSE_DEPTH; depth += 1) {
    if ((typeof current !== "object" && typeof current !== "function") || current === null) {
      break;
    }

    if (visited.has(current)) {
      break;
    }
    visited.add(current);

    const name = readObjectProperty(current, "name");
    if (name === "TimeoutError") {
      return "timeout";
    }
    if (name === "AbortError") {
      sawAbort = true;
    }

    current = readObjectProperty(current, "cause");
  }

  return sawAbort ? "aborted" : "other";
}

export function formatCodexTimeoutFailure(options: {
  requestLabel: string;
  timeoutMs: number;
  attemptsUsed: number;
}): string {
  const attemptContext =
    options.attemptsUsed > 1 ? `; ${options.attemptsUsed} attempts were exhausted` : "";
  return `${options.requestLabel} timed out after the ${formatCodexTimeoutDuration(options.timeoutMs)} per-attempt limit${attemptContext}.`;
}
