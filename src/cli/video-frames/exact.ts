import { CliError } from "../errors";
import type { FrameTime } from "./types";
const MAX = (1n << 256n) - 1n;
const I64_MIN = -(1n << 63n),
  I64_MAX = (1n << 63n) - 1n;
const invalid = () =>
  new CliError("Exact frame timing exceeds the supported numeric representation.", {
    code: "FRAME_NUMERIC_LIMIT",
  });
export function exact(numerator: bigint, denominator = 1n): FrameTime {
  if (denominator <= 0n || numerator > MAX || numerator < -MAX || denominator > MAX)
    throw invalid();
  let a = numerator < 0n ? -numerator : numerator,
    b = denominator;
  while (b) {
    const r = a % b;
    a = b;
    b = r;
  }
  return Object.freeze({ numerator: numerator / (a || 1n), denominator: denominator / (a || 1n) });
}
export function compare(a: FrameTime, b: FrameTime): number {
  a = exact(a.numerator, a.denominator);
  b = exact(b.numerator, b.denominator);
  const delta = a.numerator * b.denominator - b.numerator * a.denominator;
  return delta < 0n ? -1 : delta > 0n ? 1 : 0;
}
export function subtract(a: FrameTime, b: FrameTime): FrameTime {
  return exact(
    a.numerator * b.denominator - b.numerator * a.denominator,
    a.denominator * b.denominator,
  );
}
export function ticksToMs(ticks: bigint, timeBase: FrameTime): FrameTime {
  return exact(ticks * timeBase.numerator * 1000n, timeBase.denominator);
}
export function wireInteger(value: string): bigint {
  if (!/^-?\d{1,19}$/.test(value)) throw invalid();
  const result = BigInt(value);
  if (result < I64_MIN || result > I64_MAX) throw invalid();
  return result;
}
export function timeBase(value: unknown): FrameTime {
  if (typeof value !== "string") throw invalid();
  const match = /^(\d{1,10})\/(\d{1,10})$/.exec(value);
  if (!match) throw invalid();
  const n = BigInt(match[1]!),
    d = BigInt(match[2]!);
  if (n < 1n || d < 1n || n > 2147483647n || d > 2147483647n) throw invalid();
  return exact(n, d);
}
