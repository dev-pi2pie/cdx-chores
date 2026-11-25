import { readFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";

const rolloutDeadlineMs = 2_000;
const rolloutRetryMs = 50;

interface RolloutEvent {
  type: string;
  turn_id?: string;
  time_to_first_token_ms?: number | null;
  duration_ms?: number | null;
  info?: { total_token_usage?: RolloutUsage } | null;
}

interface RolloutUsage {
  input_tokens?: number;
  output_tokens?: number;
  cached_input_tokens?: number;
  cache_write_input_tokens?: number;
  reasoning_output_tokens?: number;
  total_tokens?: number;
}

export interface SavedTokenUsage {
  inputTokens: number | null;
  outputTokens: number | null;
  cachedInputTokens: number | null;
  cacheWriteInputTokens: number | null;
  reasoningOutputTokens: number | null;
  totalTokens: number | null;
}

interface SavedTurn {
  terminal: RolloutEvent | null;
  usage: SavedTokenUsage | null;
}

function validCount(value: number | undefined): number | null {
  return value !== undefined && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function savedUsage(count: RolloutUsage | undefined): SavedTokenUsage | null {
  if (!count) return null;
  const usage = {
    inputTokens: validCount(count.input_tokens),
    outputTokens: validCount(count.output_tokens),
    cachedInputTokens: validCount(count.cached_input_tokens),
    cacheWriteInputTokens: validCount(count.cache_write_input_tokens),
    reasoningOutputTokens: validCount(count.reasoning_output_tokens),
    totalTokens: validCount(count.total_tokens),
  };
  return Object.values(usage).some((value) => value !== null) ? usage : null;
}

function savedTurn(jsonl: string, turnId: string): SavedTurn {
  const lines = jsonl.split("\n");
  lines.pop(); // The trailing segment may be a write in progress.
  let active = false;
  let usage: SavedTokenUsage | null = null;
  for (const line of lines) {
    if (!line.trim()) continue;
    const record = JSON.parse(line) as { type: string; payload: RolloutEvent };
    if (record.type !== "event_msg") continue;
    const event = record.payload;
    if (event.type === "task_started") {
      if (active) break;
      active = event.turn_id === turnId;
    } else if (active && event.type === "token_count") {
      usage = savedUsage(event.info?.total_token_usage) ?? usage;
    } else if (
      active &&
      event.turn_id === turnId &&
      (event.type === "task_complete" || event.type === "turn_aborted")
    ) {
      return { terminal: event, usage };
    }
  }
  return { terminal: null, usage };
}

export interface RolloutReadOptions {
  deadlineMs?: number;
  onRolloutRead?: (path: string) => Promise<void>;
}

export async function readSavedTurn({
  initialPath,
  turnId,
  receivedAt,
  lookupPath,
  deadlineMs = rolloutDeadlineMs,
  onRolloutRead,
}: RolloutReadOptions & {
  initialPath: string | null;
  turnId: string;
  receivedAt: number;
  lookupPath: (timeoutMs: number) => Promise<string | null>;
}) {
  const deadline = receivedAt + deadlineMs;
  let path = initialPath;
  let saved: SavedTurn = { terminal: null, usage: null };
  let pathLookupAttempts = 0;
  let firstReadFoundTerminal: boolean | null = null;
  let terminalVisibleAfterMs: number | null = null;
  let readError: string | null = null;

  while (performance.now() < deadline) {
    if (!path) {
      try {
        pathLookupAttempts++;
        path = await lookupPath(Math.max(1, Math.ceil(deadline - performance.now())));
        readError = null;
      } catch (error) {
        readError = String(error);
      }
    }
    const remaining = Math.ceil(deadline - performance.now());
    if (path && remaining > 0) {
      try {
        const jsonl = await readFile(path, {
          encoding: "utf8",
          signal: AbortSignal.timeout(remaining),
        });
        if (onRolloutRead) await onRolloutRead(path);
        saved = savedTurn(jsonl, turnId);
        firstReadFoundTerminal ??= saved.terminal !== null;
        readError = null;
        if (saved.terminal) {
          terminalVisibleAfterMs = Math.round(performance.now() - receivedAt);
          break;
        }
      } catch (error) {
        firstReadFoundTerminal ??= false;
        readError = String(error);
      }
    }
    const retryIn = Math.min(rolloutRetryMs, deadline - performance.now());
    if (retryIn > 0) await delay(retryIn);
  }
  return {
    ...saved,
    outputTokens: saved.usage?.outputTokens ?? null,
    pathAtThreadStart: Boolean(initialPath),
    pathLookupAttempts,
    firstReadFoundTerminal,
    terminalVisibleAfterMs,
    readError,
  };
}
