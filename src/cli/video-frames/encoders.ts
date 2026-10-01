import type { DependencyCommandRunner } from "../deps";
import { CliError } from "../errors";
import { PROCESS_LIMITS, ProcessOperation } from "../process/streaming";
import type { ImageOptions } from "./image-options";

export type ImageEncoderSupport = "supported" | "unsupported" | "unknown";

/** Advertised support for the verified still-image recipe, independent of source support. */
export interface ImageEncoders {
  png: ImageEncoderSupport;
  jpg: ImageEncoderSupport;
  webp: ImageEncoderSupport;
  webpEncoder: ImageEncoderSupport;
  webpBgra: ImageEncoderSupport;
  webpLossless: ImageEncoderSupport;
}

export function unknownImageEncoders(): ImageEncoders {
  return {
    png: "unknown",
    jpg: "unknown",
    webp: "unknown",
    webpEncoder: "unknown",
    webpBgra: "unknown",
    webpLossless: "unknown",
  };
}

export function parseEncoderNames(text: string): Set<string> | undefined {
  const normalized = text.replace(/\r\n/g, "\n");
  if (!/^Encoders:[ \t]*$/m.test(normalized)) return undefined;
  const entries = [
    ...normalized.matchAll(/^[ \t]*([VAS])[.A-Z]{5}[ \t]+([a-zA-Z0-9_]+)[ \t]+.+$/gm),
  ];
  if (!entries.length && !/^[ \t]*------[ \t]*$/m.test(normalized)) return undefined;
  return new Set(entries.filter((entry) => entry[1] === "V").map((entry) => entry[2]!));
}

export function parseWebpHelp(text: string): {
  bgra: ImageEncoderSupport;
  lossless: ImageEncoderSupport;
} {
  const normalized = text.replace(/\r\n/g, "\n");
  if (!/^Encoder libwebp \[[^\r\n]+\]:?[ \t]*$/m.test(normalized))
    return { bgra: "unknown", lossless: "unknown" };
  const formats = normalized
    .match(/^[ \t]*Supported pixel formats:[ \t]*([^\r\n]+)$/m)?.[1]
    ?.trim();
  const lossless = normalized.match(/^[ \t]*-lossless[ \t]+<int>[^\r\n]*$/m)?.[0];
  const knownOptions = /^[ \t]*libwebp(?: encoder)? AVOptions:[ \t]*$/m.test(normalized);
  return {
    bgra: formats
      ? formats.split(/\s+/).includes("bgra")
        ? "supported"
        : "unsupported"
      : "unknown",
    lossless: lossless
      ? /\(from 0 to 1\)/.test(lossless)
        ? "supported"
        : "unknown"
      : knownOptions
        ? "unsupported"
        : "unknown",
  };
}

type EncoderProbe = (args: string[]) => Promise<{ stdout: string; stderr: string; ok: boolean }>;

async function collectImageEncoders(probe: EncoderProbe): Promise<ImageEncoders> {
  const inspect = async (args: string[]) => {
    const result = await probe(args);
    if (
      !result.ok ||
      result.stderr.trim() ||
      Buffer.byteLength(result.stdout) > PROCESS_LIMITS.queuedBytes ||
      Buffer.byteLength(result.stderr) > PROCESS_LIMITS.stderrBytes
    )
      throw inspectionError();
    return result.stdout;
  };
  const names = parseEncoderNames(await inspect(["-hide_banner", "-encoders"]));
  if (!names) return unknownImageEncoders();
  const webpEncoder = names.has("libwebp") ? "supported" : "unsupported";
  const mode = names.has("libwebp")
    ? parseWebpHelp(await inspect(["-hide_banner", "-h", "encoder=libwebp"]))
    : { bgra: "unsupported" as const, lossless: "unsupported" as const };
  return {
    png: names.has("png") ? "supported" : "unsupported",
    jpg: names.has("mjpeg") ? "supported" : "unsupported",
    webp: webpEncoder === "supported" ? mode.bgra : "unsupported",
    webpEncoder,
    webpBgra: mode.bgra,
    webpLossless: mode.lossless,
  };
}

/** Reuses the caller's cancellation and confirmed-child ownership boundary. */
export async function inspectImageEncoders(
  operation: ProcessOperation,
  ffmpeg = "ffmpeg",
): Promise<ImageEncoders> {
  return collectImageEncoders(async (args) => {
    const result = await operation.run(ffmpeg, args, { outputLimit: PROCESS_LIMITS.queuedBytes });
    return { stdout: result.stdout.toString("utf8"), stderr: result.stderr, ok: result.code === 0 };
  });
}

/** Doctor probes only tool metadata, with a bounded output and execution lifetime. */
export async function inspectAdvertisedImageEncoders(
  runner?: DependencyCommandRunner,
): Promise<ImageEncoders> {
  if (runner) {
    try {
      return await collectImageEncoders((args) => runner("ffmpeg", args));
    } catch (error) {
      if (error instanceof CliError && error.code === "FRAME_ENCODER_INSPECTION_FAILED")
        throw error;
      throw inspectionError();
    }
  }
  const operation = new ProcessOperation({ signal: AbortSignal.timeout(10_000) });
  try {
    return await inspectImageEncoders(operation);
  } catch {
    throw inspectionError();
  } finally {
    await operation.dispose();
  }
}

export function requireImageEncoder(encoders: ImageEncoders, options: ImageOptions): void {
  const format = encoders[options.format];
  const lossless = options.format === "webp" && options.quality === "full";
  if (format === "supported" && (!lossless || encoders.webpLossless === "supported")) return;
  const unavailable =
    format === "unsupported" || (lossless && encoders.webpLossless === "unsupported");
  const unknown = !unavailable;
  throw new CliError(
    `Requested ${options.format}/${options.quality} encoder mode ${unknown ? "could not be verified" : "is unavailable"}; use an encoder-enabled FFmpeg build.`,
    { code: unknown ? "FRAME_ENCODER_UNKNOWN" : "FRAME_ENCODER_UNAVAILABLE" },
  );
}

function inspectionError(): CliError {
  return new CliError("FFmpeg encoder inspection failed; no capability result is available.", {
    code: "FRAME_ENCODER_INSPECTION_FAILED",
    exitCode: 2,
  });
}
