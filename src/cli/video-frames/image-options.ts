import { CliError } from "../errors";

export type ImageFormat = "png" | "jpg" | "webp";
export type ImageQuality = "low" | "medium" | "high" | "full";
export interface ImageOptions {
  format: ImageFormat;
  quality: ImageQuality;
  scale: number;
}
export function imageOptions(
  input: {
    format?: unknown;
    quality?: unknown;
    scale?: unknown;
  } = {},
): ImageOptions {
  const format = input.format === undefined ? "png" : normalize(input.format);
  const quality = input.quality === undefined ? "full" : normalize(input.quality);
  if (format !== "png" && format !== "jpg" && format !== "webp")
    throw new CliError("Format must be png, jpg, or webp.", { code: "FRAME_FORMAT_INVALID" });
  if (quality !== "low" && quality !== "medium" && quality !== "high" && quality !== "full")
    throw new CliError("Quality must be low, medium, high, or full.", {
      code: "FRAME_QUALITY_INVALID",
    });
  if (format === "png" && quality !== "full")
    throw new CliError("PNG supports only quality full; choose JPG or WebP for lower presets.", {
      code: "FRAME_QUALITY_INVALID",
    });
  const scale = input.scale === undefined ? 1 : input.scale;
  if (typeof scale !== "number" || !Number.isFinite(scale) || scale < 0.1 || scale > 1)
    throw new CliError("Scale must be between 0.1 and 1.", { code: "FRAME_SCALE_INVALID" });
  return Object.freeze({ format, quality, scale });
}
function normalize(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}
export const RGB_TAGS =
  "setparams=range=full:color_primaries=bt709:color_trc=iec61966-2-1:colorspace=gbr";
export function encoderArguments(options: ImageOptions): string[] {
  if (options.format === "png")
    return ["-vf", `format=rgba,setsar=1,${RGB_TAGS}`, "-c:v", "png", "-compression_level", "9"];
  if (options.format === "jpg")
    return [
      "-vf",
      "scale=in_range=pc:out_range=pc:out_color_matrix=bt601,format=yuvj444p,setsar=1",
      "-c:v",
      "mjpeg",
      "-q:v",
      String({ low: 12, medium: 6, high: 3, full: 1 }[options.quality]),
      "-qmin",
      "1",
      "-qmax",
      "31",
    ];
  return [
    "-vf",
    `format=bgra,setsar=1,${RGB_TAGS}`,
    "-c:v",
    "libwebp",
    "-lossless",
    options.quality === "full" ? "1" : "0",
    "-quality",
    String({ low: 40, medium: 70, high: 90, full: 100 }[options.quality]),
    "-compression_level",
    "4",
  ];
}
export function assertOpaque(pixels: Buffer) {
  for (let offset = 3; offset < pixels.length; offset += 4)
    if (pixels[offset] !== 255)
      throw new CliError("JPG cannot preserve transparency; choose PNG or WebP.", {
        code: "FRAME_ALPHA_UNSUPPORTED",
      });
}
export function requireExactWebpPixels(pixels: Buffer, options: ImageOptions) {
  if (options.format !== "webp" || options.quality !== "full") return;
  for (let offset = 3; offset < pixels.length; offset += 4)
    if (pixels[offset] === 0)
      throw new CliError(
        "WebP full cannot preserve RGB values under fully transparent pixels with the supported FFmpeg encoder; choose PNG for exact RGBA output.",
        { code: "FRAME_WEBP_TRANSPARENCY_UNSUPPORTED" },
      );
}
