import { CliError } from "../errors";
import { ProcessOperation } from "../process/streaming";
import type { ImageOptions } from "./image-options";
export interface ImageEncoders {
  png: boolean;
  jpg: boolean;
  webp: boolean;
  webpLossless: boolean | undefined;
}
export function parseEncoderNames(text: string): Set<string> {
  if (!/^Encoders:/m.test(text)) throw inspectionError();
  return new Set([...text.matchAll(/^\s*V[.A-Z]{5}\s+([a-zA-Z0-9_]+)\s+/gm)].map((m) => m[1]!));
}
export function parseWebpHelp(text: string): { bgra: boolean; lossless: boolean | undefined } {
  if (!/^Encoder libwebp \[/m.test(text)) return { bgra: false, lossless: undefined };
  return {
    bgra: /^\s*Supported pixel formats:.*\bbgra\b/m.test(text),
    lossless: /^\s+-lossless\s+<int>.*\(from 0 to 1\)/m.test(text),
  };
}
export async function inspectImageEncoders(
  operation: ProcessOperation,
  ffmpeg = "ffmpeg",
): Promise<ImageEncoders> {
  const inventory = await operation.run(ffmpeg, ["-hide_banner", "-encoders"]);
  if (inventory.code !== 0 || inventory.stderr.trim()) throw inspectionError();
  const names = parseEncoderNames(inventory.stdout.toString("utf8"));
  let webp = false,
    webpLossless: boolean | undefined;
  if (names.has("libwebp")) {
    const help = await operation.run(ffmpeg, ["-hide_banner", "-h", "encoder=libwebp"]);
    if (help.code !== 0 || help.stderr.trim()) throw inspectionError();
    const mode = parseWebpHelp(help.stdout.toString("utf8"));
    webp = mode.bgra;
    webpLossless = mode.lossless;
  }
  return { png: names.has("png"), jpg: names.has("mjpeg"), webp, webpLossless };
}
export function requireImageEncoder(encoders: ImageEncoders, options: ImageOptions) {
  if (
    !encoders[options.format] ||
    (options.format === "webp" && options.quality === "full" && encoders.webpLossless !== true)
  )
    throw new CliError(
      `Requested ${options.format}/${options.quality} encoder mode is unavailable; use an encoder-enabled FFmpeg build.`,
      {
        code: "FRAME_ENCODER_UNAVAILABLE",
      },
    );
}
function inspectionError() {
  return new CliError("FFmpeg encoder inspection failed; no capability result is available.", {
    code: "FRAME_ENCODER_INSPECTION_FAILED",
    exitCode: 2,
  });
}
