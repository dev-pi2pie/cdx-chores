import { InvalidArgumentError } from "commander";

import { CliError } from "./errors";

export const VIDEO_GIF_MODE_VALUES = ["compressed", "quality"] as const;
export type VideoGifMode = (typeof VIDEO_GIF_MODE_VALUES)[number];

export function isVideoGifMode(value: string): value is VideoGifMode {
  return (VIDEO_GIF_MODE_VALUES as readonly string[]).includes(value);
}

export function normalizeVideoGifMode(mode: string | undefined): VideoGifMode {
  if (mode === undefined) {
    return "compressed";
  }

  if (isVideoGifMode(mode)) {
    return mode;
  }

  throw new CliError(`GIF mode must be one of: ${VIDEO_GIF_MODE_VALUES.join(", ")}.`, {
    code: "INVALID_INPUT",
    exitCode: 2,
  });
}

export function parseVideoGifModeOption(value: string): VideoGifMode {
  const normalized = value.trim().toLowerCase();
  if (isVideoGifMode(normalized)) {
    return normalized;
  }

  throw new InvalidArgumentError(
    `--mode must be one of: ${VIDEO_GIF_MODE_VALUES.join(", ")}.`,
  );
}
