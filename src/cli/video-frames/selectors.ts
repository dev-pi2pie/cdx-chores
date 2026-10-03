import { CliError } from "../errors";
import type { FrameTime } from "./types";

export function parseFrameNumber(value: string): number {
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) < 1)
    throw new CliError("Enter a positive, safely representable source frame number.", {
      code: "FRAME_NUMBER_INVALID",
    });
  return Number(value);
}

export function parseFrameTime(value: string, durationMs?: number): FrameTime {
  const match = /^(\d{2,}):([0-5]\d):([0-5]\d)(?:\.(\d{1,3}))?$/.exec(value);
  if (!match)
    throw new CliError("Enter HH:MM:SS[.mmm], with minutes and seconds from 00 to 59.", {
      code: "FRAME_TIME_INVALID",
    });
  const milliseconds =
    BigInt(match[1]!) * 3_600_000n +
    BigInt(match[2]!) * 60_000n +
    BigInt(match[3]!) * 1_000n +
    BigInt((match[4] ?? "").padEnd(3, "0"));
  if (milliseconds > BigInt(Number.MAX_SAFE_INTEGER))
    throw new CliError("Timestamp is too large to represent safely.", {
      code: "FRAME_TIME_INVALID",
    });
  if (Number.isSafeInteger(durationMs) && durationMs! > 0 && milliseconds >= BigInt(durationMs!))
    throw new CliError("Timestamp must be before the video end; use Last for the final frame.", {
      code: "FRAME_OUT_OF_RANGE",
    });
  return { numerator: milliseconds, denominator: 1n };
}
