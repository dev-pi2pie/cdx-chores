import { randomBytes } from "node:crypto";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, extname, join, resolve } from "node:path";

import { requireCommandAvailable } from "../deps";
import { CliError } from "../errors";
import { defaultOutputPath } from "../path-utils";
import { execCommand } from "../process";
import type { CliRuntime } from "../types";
import {
  getVideoGifLookFilterConfig,
  getVideoGifProfileFilterConfig,
  resolveVideoGifContract,
  type VideoGifLook,
  type VideoGifMode,
  type VideoGifProfile,
} from "../video-gif";
import { slugifyName } from "../../utils/slug";
import { assertNonEmpty, displayPath, ensureFileExists, printLine } from "./shared";

export type { VideoGifLook, VideoGifMode, VideoGifProfile } from "../video-gif";

export interface VideoConvertOptions {
  input: string;
  output: string;
  overwrite?: boolean;
}

export interface VideoResizeOptions {
  input: string;
  output: string;
  scale?: number;
  width?: number;
  height?: number;
  overwrite?: boolean;
}

export interface VideoGifOptions {
  input: string;
  output?: string;
  width?: number;
  fps?: number;
  mode?: VideoGifMode;
  gifProfile?: VideoGifProfile;
  gifLook?: VideoGifLook;
  overwrite?: boolean;
}

async function runFfmpeg(runtime: CliRuntime, args: string[]): Promise<void> {
  await requireCommandAvailable("ffmpeg", runtime.platform);
  const result = await execCommand("ffmpeg", args, { cwd: runtime.cwd });
  if (!result.ok) {
    throw new CliError(
      `ffmpeg failed (${result.code ?? "unknown"}): ${result.stderr || result.stdout}`.trim(),
      {
        code: "PROCESS_FAILED",
        exitCode: 1,
      },
    );
  }
}

function buildVideoGifFilter(fps: number, width: number): string {
  return `fps=${fps},scale=${width}:-1:flags=lanczos`;
}

function buildVideoGifPaletteGenFilter(profile: VideoGifProfile, videoFilter: string): string {
  return `${videoFilter},${getVideoGifProfileFilterConfig(profile).paletteGen}`;
}

function buildVideoGifPaletteUseFilter(profile: VideoGifProfile, videoFilter: string): string {
  return `${videoFilter}[x];[x][1:v]${getVideoGifProfileFilterConfig(profile).paletteUse}`;
}

function buildVideoGifQualitySourceFilter(look: VideoGifLook, videoFilter: string): string {
  const prePalette = getVideoGifLookFilterConfig(look).prePalette;
  return prePalette ? `${videoFilter},${prePalette}` : videoFilter;
}

function buildVideoGifPalettePath(outputPath: string): string {
  const outputStem = basename(outputPath, extname(outputPath));
  const readableStem = slugifyName(outputStem, "gif");
  const suffix = randomBytes(3).toString("hex");
  return join(tmpdir(), `cdx-chores-video-gif-${readableStem}-palette-${suffix}.png`);
}

async function removeVideoGifPaletteArtifact(palettePath: string): Promise<void> {
  await rm(palettePath, { force: true });
}

async function runCompressedVideoGif(
  runtime: CliRuntime,
  inputPath: string,
  outputPath: string,
  overwrite: boolean,
  videoFilter: string,
): Promise<void> {
  printLine(runtime.stdout, "Rendering GIF...");
  await runFfmpeg(runtime, [
    overwrite ? "-y" : "-n",
    "-i",
    inputPath,
    "-vf",
    videoFilter,
    outputPath,
  ]);
}

async function runQualityVideoGif(
  runtime: CliRuntime,
  inputPath: string,
  outputPath: string,
  overwrite: boolean,
  videoFilter: string,
  profile: VideoGifProfile,
  look: VideoGifLook,
): Promise<void> {
  const palettePath = buildVideoGifPalettePath(outputPath);
  const qualitySourceFilter = buildVideoGifQualitySourceFilter(look, videoFilter);
  const paletteGenFilter = buildVideoGifPaletteGenFilter(profile, qualitySourceFilter);
  const paletteUseFilter = buildVideoGifPaletteUseFilter(profile, qualitySourceFilter);

  try {
    printLine(runtime.stdout, "Generating GIF palette...");
    await runFfmpeg(runtime, [
      "-y",
      "-i",
      inputPath,
      "-vf",
      paletteGenFilter,
      "-frames:v",
      "1",
      palettePath,
    ]);

    printLine(runtime.stdout, "Rendering GIF from palette...");
    await runFfmpeg(runtime, [
      overwrite ? "-y" : "-n",
      "-i",
      inputPath,
      "-i",
      palettePath,
      "-lavfi",
      paletteUseFilter,
      outputPath,
    ]);
  } finally {
    await removeVideoGifPaletteArtifact(palettePath);
  }
}

export async function actionVideoConvert(
  runtime: CliRuntime,
  options: VideoConvertOptions,
): Promise<void> {
  const inputPath = resolve(runtime.cwd, assertNonEmpty(options.input, "Input path"));
  const outputPath = resolve(runtime.cwd, assertNonEmpty(options.output, "Output path"));
  await ensureFileExists(inputPath, "Input");

  const args = [options.overwrite ? "-y" : "-n", "-i", inputPath, outputPath];
  await runFfmpeg(runtime, args);
  printLine(runtime.stdout, `Wrote video: ${displayPath(runtime, outputPath)}`);
}

export async function actionVideoResize(
  runtime: CliRuntime,
  options: VideoResizeOptions,
): Promise<void> {
  const inputPath = resolve(runtime.cwd, assertNonEmpty(options.input, "Input path"));
  const outputPath = resolve(runtime.cwd, assertNonEmpty(options.output, "Output path"));
  const hasScale = options.scale !== undefined;
  const hasWidth = options.width !== undefined;
  const hasHeight = options.height !== undefined;

  if (hasScale && (hasWidth || hasHeight)) {
    throw new CliError("Use either --scale or both --width and --height, not both.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }
  if (hasWidth !== hasHeight) {
    throw new CliError("Width and height must be provided together.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }
  if (!hasScale && !hasWidth && !hasHeight) {
    throw new CliError("Provide --scale or both --width and --height.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }
  if (hasScale && (!Number.isFinite(options.scale) || options.scale! <= 0)) {
    throw new CliError("Scale must be a positive number.", { code: "INVALID_INPUT", exitCode: 2 });
  }
  if (hasWidth && (!Number.isFinite(options.width) || options.width! <= 0)) {
    throw new CliError("Width must be a positive number.", { code: "INVALID_INPUT", exitCode: 2 });
  }
  if (hasHeight && (!Number.isFinite(options.height) || options.height! <= 0)) {
    throw new CliError("Height must be a positive number.", { code: "INVALID_INPUT", exitCode: 2 });
  }
  await ensureFileExists(inputPath, "Input");

  const videoFilter = hasScale
    ? `scale=trunc(iw*${options.scale!}/2)*2:trunc(ih*${options.scale!}/2)*2`
    : `scale=${Math.trunc(options.width!)}:${Math.trunc(options.height!)}`;

  const args = [options.overwrite ? "-y" : "-n", "-i", inputPath, "-vf", videoFilter, outputPath];
  await runFfmpeg(runtime, args);
  printLine(runtime.stdout, `Wrote resized video: ${displayPath(runtime, outputPath)}`);
}

export async function actionVideoGif(runtime: CliRuntime, options: VideoGifOptions): Promise<void> {
  const inputPath = resolve(runtime.cwd, assertNonEmpty(options.input, "Input path"));
  const outputPath = resolve(
    runtime.cwd,
    options.output?.trim() || defaultOutputPath(inputPath, ".gif"),
  );
  const { mode, profile, look } = resolveVideoGifContract({
    mode: options.mode,
    profile: options.gifProfile,
    look: options.gifLook,
  });
  await ensureFileExists(inputPath, "Input");

  const fps =
    Number.isFinite(options.fps) && (options.fps ?? 0) > 0 ? Math.trunc(options.fps!) : 10;
  const width =
    Number.isFinite(options.width) && (options.width ?? 0) > 0 ? Math.trunc(options.width!) : 480;
  const videoFilter = buildVideoGifFilter(fps, width);

  printLine(runtime.stdout, "Starting GIF conversion...");
  printLine(runtime.stdout, `Mode: ${mode}`);
  if (profile) {
    printLine(runtime.stdout, `GIF profile: ${profile}`);
  }
  if (look) {
    printLine(runtime.stdout, `GIF look: ${look}`);
  }

  if (mode === "compressed") {
    await runCompressedVideoGif(
      runtime,
      inputPath,
      outputPath,
      Boolean(options.overwrite),
      videoFilter,
    );
    printLine(runtime.stdout, `Wrote GIF: ${displayPath(runtime, outputPath)}`);
    return;
  }

  await runQualityVideoGif(
    runtime,
    inputPath,
    outputPath,
    Boolean(options.overwrite),
    videoFilter,
    profile,
    look,
  );

  printLine(runtime.stdout, `Wrote GIF: ${displayPath(runtime, outputPath)}`);
}
