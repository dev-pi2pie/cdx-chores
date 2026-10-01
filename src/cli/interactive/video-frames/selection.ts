import type { FrameTime, FrameRequest } from "../../video-frames/types";
export type { FrameTime, FrameRequest } from "../../video-frames/types";
export { parseFrameNumber, parseFrameTime } from "../../video-frames/selectors";

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
