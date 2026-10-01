import { expectedSequenceCount, frameCadence } from "../../video-frames/cadence";
import type { ImageEncoders, ImageEncoderSupport } from "../../video-frames/encoders";
import type { ImageFormat, ImageQuality } from "../../video-frames/image-options";
import type { FrameTime } from "../../video-frames/types";

export interface FrameSettingChoice<Value extends string> {
  name: string;
  value: Value;
  disabled?: string;
  description?: string;
}

const unavailable = (support: ImageEncoderSupport): string | undefined =>
  support === "supported"
    ? undefined
    : support === "unsupported"
      ? "Unavailable in this FFmpeg build"
      : "Support could not be verified";

export function frameFormatChoices(encoders: ImageEncoders): FrameSettingChoice<ImageFormat>[] {
  return (["png", "jpg", "webp"] as const).map((format) => ({
    name: format === "webp" ? "WebP (still image)" : format.toUpperCase(),
    value: format,
    disabled: unavailable(encoders[format]),
  }));
}

export function frameQualityLabel(format: ImageFormat, quality: ImageQuality): string {
  if (quality === "full")
    return format === "jpg" ? "Full (highest JPEG quality; lossy)" : "Full (lossless)";
  return `${quality[0]!.toUpperCase()}${quality.slice(1)} (lossy)`;
}

export function frameQualityChoices(
  format: ImageFormat,
  encoders: ImageEncoders,
): FrameSettingChoice<ImageQuality>[] {
  return (
    format === "png" ? (["full"] as const) : (["full", "high", "medium", "low"] as const)
  ).map((quality) => ({
    name: frameQualityLabel(format, quality),
    value: quality,
    disabled:
      format === "webp" && quality === "full" ? unavailable(encoders.webpLossless) : undefined,
  }));
}

export function validateFrameCadenceValue(kind: "fps" | "interval", value: string): true | string {
  if (kind === "fps" && !/^\d+(?:\.\d+)?$/.test(value))
    return "Enter a positive integer or decimal FPS, for example 24 or 23.976.";
  try {
    frameCadence({ [kind]: value });
    return true;
  } catch (error) {
    return (error as Error).message;
  }
}

/** Duration is preliminary metadata; the final display end remains an execution check. */
export function frameCadenceFeedback(
  kind: "fps" | "interval",
  value: string,
  duration?: FrameTime,
): string | undefined {
  if (validateFrameCadenceValue(kind, value) !== true) return;
  const count = expectedSequenceCount(frameCadence({ [kind]: value }), duration);
  if (count === undefined) return "Expected count unavailable; duration is unknown.";
  if (count === 1n) return "Expected 1 image at the start; confirm the end during processing.";
  return `Expected ${count.toLocaleString("en-US")} images (metadata estimate).`;
}

export function validateFrameScale(value: string): true | string {
  return /^\d+(?:\.\d+)?$/.test(value) &&
    Number.isFinite(Number(value)) &&
    Number(value) >= 0.1 &&
    Number(value) <= 1
    ? true
    : "Enter a scale from 0.1 to 1, for example 0.5 for half size.";
}
