import { CliError } from "../errors";
import { compare, exact } from "./exact";
import type { FrameTime } from "./types";
export interface FrameCadence {
  kind: "fps" | "interval";
  value: string;
  periodMs: FrameTime;
}
export function frameCadence(input: { fps?: unknown; interval?: unknown }): FrameCadence {
  if ((input.fps !== undefined) === (input.interval !== undefined))
    throw new CliError("Choose exactly one FPS or interval cadence.", {
      code: "FRAME_CADENCE_INVALID",
    });
  if (input.fps !== undefined) {
    const value =
      typeof input.fps === "number"
        ? String(input.fps)
        : typeof input.fps === "string"
          ? input.fps.trim()
          : "";
    if (
      value.length > 80 ||
      !/^\d+(?:\.\d+)?$/.test(value) ||
      !Number.isFinite(Number(value)) ||
      Number(value) <= 0
    )
      throw new CliError("FPS must be a positive number, for example 24 or 23.976.", {
        code: "FRAME_FPS_INVALID",
      });
    const [whole, fraction = ""] = value.split(".");
    const rate = exact(BigInt(whole! + fraction), 10n ** BigInt(fraction.length));
    return Object.freeze({
      kind: "fps",
      value,
      periodMs: exact(1000n * rate.denominator, rate.numerator),
    });
  }
  const value = typeof input.interval === "string" ? input.interval : "";
  const parts = value.length <= 80 ? /^(\d+)(ms|s|m)$/.exec(value) : null;
  if (!parts)
    throw new CliError("Interval must be a positive integer followed by ms, s, or m.", {
      code: "FRAME_INTERVAL_INVALID",
    });
  const amount = BigInt(parts[1]!),
    milliseconds = amount * { ms: 1n, s: 1000n, m: 60000n }[parts[2] as "ms" | "s" | "m"];
  if (
    amount < 1n ||
    amount > BigInt(Number.MAX_SAFE_INTEGER) ||
    milliseconds > BigInt(Number.MAX_SAFE_INTEGER)
  )
    throw new CliError("Interval amount and milliseconds must be positive safe integers.", {
      code: "FRAME_INTERVAL_INVALID",
    });
  return Object.freeze({ kind: "interval", value, periodMs: exact(milliseconds) });
}
export function cadenceTarget(cadence: FrameCadence, index: number): FrameTime {
  if (!Number.isSafeInteger(index) || index < 0)
    throw new CliError("Cadence index exceeds safe integer representation.", {
      code: "FRAME_NUMERIC_LIMIT",
    });
  return exact(BigInt(index) * cadence.periodMs.numerator, cadence.periodMs.denominator);
}
/** A count derived from inspected duration is an estimate until clean sequence completion. */
export function expectedSequenceCount(cadence: FrameCadence, end?: FrameTime): bigint | undefined {
  if (!end || compare(end, exact(0n)) <= 0) return;
  const numerator = end.numerator * cadence.periodMs.denominator;
  const denominator = end.denominator * cadence.periodMs.numerator;
  return (numerator + denominator - 1n) / denominator;
}
