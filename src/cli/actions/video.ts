import { resolve } from "node:path";

import { requireCommandAvailable } from "../deps";
import { CliError } from "../errors";
import { defaultOutputPath } from "../fs-utils";
import { execCommand } from "../process";
import type { CliRuntime } from "../types";
import { assertNonEmpty, displayPath, ensureFileExists, printLine } from "./shared";

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
  overwrite?: boolean;
}

async function runFfmpeg(runtime: CliRuntime, args: string[]): Promise<void> {
  await requireCommandAvailable("ffmpeg", runtime.platform);
  const result = await execCommand("ffmpeg", args, { cwd: runtime.cwd });
  if (!result.ok) {
    throw new CliError(`ffmpeg failed (${result.code ?? "unknown"}): ${result.stderr || result.stdout}`.trim(), {
      code: "PROCESS_FAILED",
      exitCode: 1,
    });
  }
}

export async function actionVideoConvert(runtime: CliRuntime, options: VideoConvertOptions): Promise<void> {
  const inputPath = resolve(runtime.cwd, assertNonEmpty(options.input, "Input path"));
  const outputPath = resolve(runtime.cwd, assertNonEmpty(options.output, "Output path"));
  await ensureFileExists(inputPath, "Input");

  const args = [options.overwrite ? "-y" : "-n", "-i", inputPath, outputPath];
  await runFfmpeg(runtime, args);
  printLine(runtime.stdout, `Wrote video: ${displayPath(runtime, outputPath)}`);
}

export async function actionVideoResize(runtime: CliRuntime, options: VideoResizeOptions): Promise<void> {
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

  const args = [
    options.overwrite ? "-y" : "-n",
    "-i",
    inputPath,
    "-vf",
    videoFilter,
    outputPath,
  ];
  await runFfmpeg(runtime, args);
  printLine(runtime.stdout, `Wrote resized video: ${displayPath(runtime, outputPath)}`);
}

export async function actionVideoGif(runtime: CliRuntime, options: VideoGifOptions): Promise<void> {
  const inputPath = resolve(runtime.cwd, assertNonEmpty(options.input, "Input path"));
  const outputPath = resolve(
    runtime.cwd,
    options.output?.trim() || defaultOutputPath(inputPath, ".gif"),
  );
  await ensureFileExists(inputPath, "Input");

  const fps = Number.isFinite(options.fps) && (options.fps ?? 0) > 0 ? Math.trunc(options.fps!) : 10;
  const width = Number.isFinite(options.width) && (options.width ?? 0) > 0 ? Math.trunc(options.width!) : 480;

  const args = [
    options.overwrite ? "-y" : "-n",
    "-i",
    inputPath,
    "-vf",
    `fps=${fps},scale=${width}:-1:flags=lanczos`,
    outputPath,
  ];
  await runFfmpeg(runtime, args);
  printLine(runtime.stdout, `Wrote GIF: ${displayPath(runtime, outputPath)}`);
}
