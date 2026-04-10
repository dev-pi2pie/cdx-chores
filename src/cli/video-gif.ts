import { InvalidArgumentError } from "commander";

import { CliError } from "./errors";

export const VIDEO_GIF_MODE_VALUES = ["compressed", "quality"] as const;
export type VideoGifMode = (typeof VIDEO_GIF_MODE_VALUES)[number];
export const VIDEO_GIF_PROFILE_VALUES = ["video", "motion", "screen"] as const;
export type VideoGifProfile = (typeof VIDEO_GIF_PROFILE_VALUES)[number];
export const VIDEO_GIF_LOOK_VALUES = ["faithful", "vibrant"] as const;
export type VideoGifLook = (typeof VIDEO_GIF_LOOK_VALUES)[number];

export interface ResolvedVideoGifContract {
  mode: VideoGifMode;
  profile: VideoGifProfile | undefined;
  look: VideoGifLook | undefined;
}

export interface VideoGifProfileFilterConfig {
  paletteGen: string;
  paletteUse: string;
}

export interface VideoGifLookFilterConfig {
  prePalette: string | undefined;
}

export const VIDEO_GIF_PROFILE_FILTER_CONFIG: Record<VideoGifProfile, VideoGifProfileFilterConfig> = {
  video: {
    paletteGen: "palettegen=max_colors=256:stats_mode=full:reserve_transparent=1",
    paletteUse: "paletteuse=dither=sierra2_4a",
  },
  motion: {
    paletteGen: "palettegen=max_colors=256:stats_mode=diff:reserve_transparent=1",
    paletteUse: "paletteuse=dither=sierra2_4a:diff_mode=rectangle",
  },
  screen: {
    paletteGen: "palettegen=max_colors=256:stats_mode=diff:reserve_transparent=1",
    paletteUse: "paletteuse=dither=bayer:bayer_scale=2:diff_mode=rectangle",
  },
};

export const VIDEO_GIF_LOOK_FILTER_CONFIG: Record<VideoGifLook, VideoGifLookFilterConfig> = {
  faithful: {
    prePalette: "format=rgba",
  },
  vibrant: {
    prePalette:
      "format=rgba,eq=saturation=1.28:contrast=1.12:brightness=0.01,colorchannelmixer=rr=1.06:gg=1.00:bb=0.98",
  },
};

export function isVideoGifMode(value: string): value is VideoGifMode {
  return (VIDEO_GIF_MODE_VALUES as readonly string[]).includes(value);
}

export function isVideoGifProfile(value: string): value is VideoGifProfile {
  return (VIDEO_GIF_PROFILE_VALUES as readonly string[]).includes(value);
}

export function isVideoGifLook(value: string): value is VideoGifLook {
  return (VIDEO_GIF_LOOK_VALUES as readonly string[]).includes(value);
}

export function resolveVideoGifContract(options: {
  mode?: string;
  profile?: string;
  look?: string;
}): ResolvedVideoGifContract {
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

  if (options.look !== undefined && !isVideoGifLook(options.look)) {
    throw new CliError(`GIF look must be one of: ${VIDEO_GIF_LOOK_VALUES.join(", ")}.`, {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  const mode = options.mode ?? (options.profile || options.look ? "quality" : "compressed");

  if (mode === "compressed") {
    if (options.profile !== undefined) {
      throw new CliError("--gif-profile cannot be used with --mode compressed.", {
        code: "INVALID_INPUT",
        exitCode: 2,
      });
    }

    if (options.look !== undefined) {
      throw new CliError("--gif-look cannot be used with --mode compressed.", {
        code: "INVALID_INPUT",
        exitCode: 2,
      });
    }

    return { mode, profile: undefined, look: undefined };
  }

  return {
    mode,
    profile: options.profile ?? "video",
    look: options.look ?? "faithful",
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

export function parseVideoGifLookOption(value: string): VideoGifLook {
  const normalized = value.trim().toLowerCase();
  if (isVideoGifLook(normalized)) {
    return normalized;
  }

  throw new InvalidArgumentError(
    `--gif-look must be one of: ${VIDEO_GIF_LOOK_VALUES.join(", ")}.`,
  );
}

export function getVideoGifProfileFilterConfig(profile: VideoGifProfile): VideoGifProfileFilterConfig {
  return VIDEO_GIF_PROFILE_FILTER_CONFIG[profile];
}

export function getVideoGifLookFilterConfig(look: VideoGifLook): VideoGifLookFilterConfig {
  return VIDEO_GIF_LOOK_FILTER_CONFIG[look];
}
