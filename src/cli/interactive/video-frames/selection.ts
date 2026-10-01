export interface FrameTime {
  numerator: bigint;
  denominator: bigint;
}

export type FrameRequest =
  | { kind: "first" }
  | { kind: "last" }
  | { kind: "frame"; frameNumber: number }
  | { kind: "time"; timeMs: FrameTime };

export interface FrameIdentity {
  frameNumber: number;
  // The prototype uses integer milliseconds. Exact tool timing is established in Phase 3.
  startMs?: number;
}

export interface FramePickerState {
  request: FrameRequest;
  resolved?: FrameIdentity;
  glyphs: "unicode" | "ascii";
}

export function parseFrameNumber(value: string): number {
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) < 1) {
    throw new Error("Enter a positive, safely representable source frame number.");
  }
  return Number(value);
}

export function parseFrameTime(value: string, durationMs?: number): FrameTime {
  const match = /^(\d{2,}):([0-5]\d):([0-5]\d)(?:\.(\d{1,3}))?$/.exec(value);
  if (!match) throw new Error("Enter HH:MM:SS[.mmm], with minutes and seconds from 00 to 59.");
  const milliseconds =
    BigInt(match[1]!) * 3_600_000n +
    BigInt(match[2]!) * 60_000n +
    BigInt(match[3]!) * 1_000n +
    BigInt((match[4] ?? "").padEnd(3, "0"));
  if (milliseconds > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error("Timestamp is too large to represent safely.");
  }
  if (isUsableDuration(durationMs) && milliseconds >= BigInt(durationMs)) {
    throw new Error("Timestamp must be before the video end; use Last for the final frame.");
  }
  return { numerator: milliseconds, denominator: 1n };
}

export function isUsableDuration(durationMs: number | undefined): durationMs is number {
  return durationMs !== undefined && Number.isSafeInteger(durationMs) && durationMs > 0;
}

export function formatFrameTime(time: FrameTime | number): string {
  const milliseconds =
    typeof time === "number" ? BigInt(Math.round(time)) : time.numerator / time.denominator;
  const hours = milliseconds / 3_600_000n;
  const minutes = (milliseconds / 60_000n) % 60n;
  const seconds = (milliseconds / 1_000n) % 60n;
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}.${(milliseconds % 1_000n).toString().padStart(3, "0")}`;
}

export function describeFrameRequest(request: FrameRequest): string {
  switch (request.kind) {
    case "first":
      return "First source frame";
    case "last":
      return "Last source frame";
    case "frame":
      return `Source frame ${request.frameNumber}`;
    case "time":
      return `Time ${formatFrameTime(request.timeMs)}`;
  }
}

export function selectionPosition(
  state: FramePickerState,
  durationMs: number,
): FrameTime | undefined {
  if (state.request.kind === "first") return { numerator: 0n, denominator: 1n };
  if (state.request.kind === "last") return { numerator: BigInt(durationMs), denominator: 1n };
  if (state.request.kind === "time") return state.request.timeMs;
  if (
    state.resolved?.startMs !== undefined &&
    Number.isSafeInteger(state.resolved.startMs) &&
    state.resolved.startMs >= 0
  ) {
    return { numerator: BigInt(state.resolved.startMs), denominator: 1n };
  }
  return undefined;
}

export function nearestPosition(
  state: FramePickerState,
  durationMs: number,
  positions: number,
): number {
  const time = selectionPosition(state, durationMs);
  if (!time) return 0;
  const numerator = time.numerator * BigInt(positions - 1);
  const denominator = time.denominator * BigInt(durationMs);
  return Math.max(
    0,
    Math.min(positions - 1, Number((numerator * 2n + denominator) / (denominator * 2n))),
  );
}

export function moveFrameCandidate(
  state: FramePickerState,
  durationMs: number,
  positions: number,
  direction: "left" | "right",
): FramePickerState {
  const current = selectionPosition(state, durationMs);
  if (!current) return state;
  const numerator = current.numerator * BigInt(positions - 1);
  const denominator = current.denominator * BigInt(durationMs);
  const floor = numerator / denominator;
  const next =
    direction === "right" ? floor + 1n : floor - (numerator % denominator === 0n ? 1n : 0n);
  if (next < 0n || next >= BigInt(positions)) return state;
  const request: FrameRequest =
    next === 0n
      ? { kind: "first" }
      : next === BigInt(positions - 1)
        ? { kind: "last" }
        : {
            kind: "time",
            timeMs: { numerator: next * BigInt(durationMs), denominator: BigInt(positions - 1) },
          };
  return { request, glyphs: state.glyphs };
}
