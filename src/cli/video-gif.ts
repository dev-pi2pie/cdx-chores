import { InvalidArgumentError } from "commander";

import { CliError } from "./errors";

export const VIDEO_GIF_MODE_VALUES = ["compressed", "quality"] as const;
export type VideoGifMode = (typeof VIDEO_GIF_MODE_VALUES)[number];
export const VIDEO_GIF_PROFILE_VALUES = ["video", "motion", "screen"] as const;
export type VideoGifProfile = (typeof VIDEO_GIF_PROFILE_VALUES)[number];

export interface ResolvedVideoGifModeAndProfile {
  mode: VideoGifMode;
  profile: VideoGifProfile | undefined;
}

export interface VideoGifProfileFilterConfig {
  paletteGen: string;
  paletteUse: string;
}

export const VIDEO_GIF_PROFILE_FILTER_CONFIG: Record<VideoGifProfile, VideoGifProfileFilterConfig> = {
  video: {
    paletteGen: "palettegen=max_colors=256:stats_mode=full:reserve_transparent=0",
    paletteUse: "paletteuse=dither=sierra2_4a",
  },
  motion: {
    paletteGen: "palettegen=max_colors=256:stats_mode=diff:reserve_transparent=0",
    paletteUse: "paletteuse=dither=sierra2_4a:diff_mode=rectangle",
  },
  screen: {
    paletteGen: "palettegen=max_colors=256:stats_mode=diff:reserve_transparent=0",
    paletteUse: "paletteuse=dither=bayer:bayer_scale=2:diff_mode=rectangle",
  },
};

export function isVideoGifMode(value: string): value is VideoGifMode {
  return (VIDEO_GIF_MODE_VALUES as readonly string[]).includes(value);
}

export function isVideoGifProfile(value: string): value is VideoGifProfile {
  return (VIDEO_GIF_PROFILE_VALUES as readonly string[]).includes(value);
}

export function resolveVideoGifModeAndProfile(options: {
  mode?: string;
  profile?: string;
}): ResolvedVideoGifModeAndProfile {
  if (options.mode !== undefined && !isVideoGifMode(options.mode)) {
    throw new CliError(`GIF mode must be one of: ${VIDEO_GIF_MODE_VALUES.join(", ")}.`, {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  if (options.profile !== undefined && !isVideoGifProfile(options.profile)) {
    throw new CliError(
      `GIF profile must be one of: ${VIDEO_GIF_PROFILE_VALUES.join(", ")}.`,
      {
        code: "INVALID_INPUT",
        exitCode: 2,
      },
    );
  }

  const mode = options.mode ?? (options.profile ? "quality" : "compressed");

  if (mode === "compressed") {
    if (options.profile !== undefined) {
      throw new CliError("--gif-profile cannot be used with --mode compressed.", {
        code: "INVALID_INPUT",
        exitCode: 2,
      });
    }

    return { mode, profile: undefined };
  }

  return {
    mode,
    profile: options.profile ?? "video",
  };
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

export function parseVideoGifProfileOption(value: string): VideoGifProfile {
  const normalized = value.trim().toLowerCase();
  if (isVideoGifProfile(normalized)) {
    return normalized;
  }

  throw new InvalidArgumentError(
    `--gif-profile must be one of: ${VIDEO_GIF_PROFILE_VALUES.join(", ")}.`,
  );
}

export function getVideoGifProfileFilterConfig(profile: VideoGifProfile): VideoGifProfileFilterConfig {
  return VIDEO_GIF_PROFILE_FILTER_CONFIG[profile];
}
