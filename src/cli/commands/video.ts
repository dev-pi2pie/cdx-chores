import type { Command } from "commander";

import { actionVideoConvert, actionVideoGif, actionVideoResize } from "../actions";
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
    .option(
      "--mode <mode>",
      "GIF mode: compressed (default) or quality",
      parseVideoGifModeOption,
    )
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
