import type { Command } from "commander";

import { InvalidArgumentError } from "commander";
import {
  actionVideoConvert,
  actionVideoFrames,
  actionVideoGif,
  actionVideoResize,
  type VideoFramesOptions,
} from "../actions";
import { parsePositiveIntegerOption, parsePositiveNumberOption } from "../options/parsers";
import type { CliRuntime } from "../types";
import {
  parseVideoGifLookOption,
  parseVideoGifModeOption,
  parseVideoGifProfileOption,
  type VideoGifLook,
  type VideoGifMode,
  type VideoGifProfile,
} from "../video-gif";

export function registerVideoCommands(program: Command, runtime: CliRuntime): void {
  const videoCommand = program.command("video").description("Video utilities (ffmpeg-backed)");

  const once = (flag: string) => (value: string, previous?: string) => {
    if (previous !== undefined)
      throw new InvalidArgumentError(`${flag} may be supplied only once.`);
    return value;
  };
  videoCommand
    .command("frames")
    .description("Export one frame, a fixed frame set, or a whole-video image sequence")
    .requiredOption("-i, --input <path>", "Input video file")
    .option("--first-frame", "First displayed source frame")
    .option("--last-frame", "Final displayed source frame")
    .option("--frame-number <number>", "Source frame number (1-based)", once("--frame-number"))
    .option("--at <timestamp>", "Position HH:MM:SS[.mmm] from the first frame", once("--at"))
    .option("--frame-set <preset>", "first-last or first-middle-last", once("--frame-set"))
    .option("--fps <rate>", "Positive integer or decimal sampling rate", once("--fps"))
    .option(
      "--interval <duration>",
      "Sampling interval, for example 500ms, 2s, or 1m",
      once("--interval"),
    )
    .option("--format <format>", "png (default), jpg, or webp", once("--format"))
    .option(
      "--quality <preset>",
      "low, medium, high, or full (default); PNG requires full",
      once("--quality"),
    )
    .option("--scale <factor>", "Output scale from 0.1 to 1 (default 1)", once("--scale"))
    .option(
      "-o, --output <path>",
      "Image file for one frame; folder for sets/sequences",
      once("--output"),
    )
    .option("--pattern <template>", "Frame-set/sequence filename template", once("--pattern"))
    .option("--serial-start <number>", "Sequence serial start (default 1)", once("--serial-start"))
    .option(
      "--serial-width <digits>",
      "Sequence minimum serial width (default 6)",
      once("--serial-width"),
    )
    .option("--overwrite", "Replace conflicting image files", false)
    .addHelpText(
      "after",
      "\nChoose exactly one selector, frame-set preset, FPS, or interval.\nExamples:\n  video frames -i clip.mp4 --first-frame\n  video frames -i clip.mp4 --frame-set first-middle-last\n  video frames -i clip.mp4 --interval 2s --format webp",
    )
    .action(async (options: VideoFramesOptions) => {
      await actionVideoFrames(runtime, options);
    });

  videoCommand
    .command("convert")
    .description("Convert a video file to another format via ffmpeg")
    .requiredOption("-i, --input <path>", "Input video file")
    .requiredOption("-o, --output <path>", "Output video file")
    .option("--overwrite", "Overwrite output file if it already exists", false)
    .action(async (options: { input: string; output: string; overwrite?: boolean }) => {
      await actionVideoConvert(runtime, options);
    });

  videoCommand
    .command("resize")
    .description("Resize video via ffmpeg")
    .requiredOption("-i, --input <path>", "Input video file")
    .requiredOption("-o, --output <path>", "Output video file")
    .option(
      "-s, --scale <factor>",
      "Scale factor multiplier (for example 0.5 halves size, 2 doubles it)",
      (value) => parsePositiveNumberOption(value, "--scale"),
    )
    .option("--width <px>", "Output width in pixels (requires --height)", (value) =>
      parsePositiveIntegerOption(value, "--width"),
    )
    .option("--height <px>", "Output height in pixels (requires --width)", (value) =>
      parsePositiveIntegerOption(value, "--height"),
    )
    .option("--overwrite", "Overwrite output file if it already exists", false)
    .addHelpText(
      "after",
      [
        "",
        "Resize modes:",
        "  Preferred: --scale 0.5",
        "  Explicit override: --width 1280 --height 720",
      ].join("\n"),
    )
    .action(
      async (options: {
        input: string;
        output: string;
        scale?: number;
        width?: number;
        height?: number;
        overwrite?: boolean;
      }) => {
        await actionVideoResize(runtime, options);
      },
    );

  videoCommand
    .command("gif")
    .description("Convert video to GIF via ffmpeg")
    .requiredOption("-i, --input <path>", "Input video file")
    .option("-o, --output <path>", "Output GIF file path")
    .option("--width <px>", "GIF width", (value) => Number(value))
    .option("--fps <value>", "GIF frames per second", (value) => Number(value))
    .option("--mode <mode>", "GIF mode: compressed (default) or quality", parseVideoGifModeOption)
    .option(
      "--gif-profile <profile>",
      "GIF quality profile: video, motion, or screen (implies quality mode)",
      parseVideoGifProfileOption,
    )
    .option(
      "--gif-look <look>",
      "GIF look: faithful or vibrant (implies quality mode)",
      parseVideoGifLookOption,
    )
    .option("--overwrite", "Overwrite output file if it already exists", false)
    .addHelpText(
      "after",
      [
        "",
        "GIF modes:",
        "  compressed: one-pass ffmpeg conversion (default)",
        "  quality: two-pass palette workflow for better color fidelity",
        "",
        "GIF profiles (quality mode only):",
        "  video: balanced default for most clips",
        "  motion: tuned for fast-moving scenes",
        "  screen: tuned for UI and screen recordings",
        "",
        "GIF looks (quality mode only):",
        "  faithful: normalized closer-to-source look (default)",
        "  vibrant: stronger color lift before palette generation",
      ].join("\n"),
    )
    .action(
      async (options: {
        input: string;
        output?: string;
        width?: number;
        fps?: number;
        mode?: VideoGifMode;
        gifProfile?: VideoGifProfile;
        gifLook?: VideoGifLook;
        overwrite?: boolean;
      }) => {
        await actionVideoGif(runtime, options);
      },
    );
}
