import { CliError } from "../errors";
import { ProcessOperation, type StreamingResult } from "../process/streaming";
import { ticksToMs, timeBase, wireInteger } from "./exact";
import type { FrameRecord, VideoStream } from "./types";
export const DECODER_PIXELS = 16_777_216;
export const METADATA_FIELDS =
  "stream=index,codec_name,codec_type,width,height,pix_fmt,time_base,start_pts,duration_ts,nb_frames,sample_aspect_ratio,color_range,color_space,color_primaries,color_transfer:stream_disposition=default,attached_pic,timed_thumbnails:stream_side_data=side_data_type,rotation,displaymatrix:stream_tags=alpha_mode";
export const FRAME_FIELDS =
  "frame=stream_index,best_effort_timestamp,pts,duration,pict_type,width,height,pix_fmt,sample_aspect_ratio,color_range,color_space,color_primaries,color_transfer:frame_side_data=";
const FRAME_KEYS = new Set([
  "stream_index",
  "best_effort_timestamp",
  "pts",
  "duration",
  "pict_type",
  "width",
  "height",
  "pix_fmt",
  "sample_aspect_ratio",
  "color_range",
  "color_space",
  "color_primaries",
  "color_transfer",
]);
export function requireClean(result: StreamingResult, context: string, allowPrefix = false) {
  if (
    (!result.earlyStop && result.code !== 0) ||
    (result.earlyStop && !allowPrefix) ||
    result.stderr.trim()
  )
    throw new CliError(
      `${context} failed: ${result.stderr.trim() || result.signal || result.code}`,
      { code: "FRAME_TOOL_FAILED" },
    );
}
function number(value: unknown, name: string, minimum = 0): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < minimum)
    throw new CliError(`Invalid selected-stream ${name}.`, { code: "FRAME_METADATA_INVALID" });
  return value;
}
function optionalTicks(value: unknown): bigint | undefined {
  if (value === undefined || value === "N/A") return;
  if (typeof value !== "number" || !Number.isSafeInteger(value))
    throw new CliError("Selected metadata contains an unsafe integer.", {
      code: "FRAME_NUMERIC_LIMIT",
    });
  return wireInteger(String(value));
}
export function parseMetadata(text: string): VideoStream {
  let data: { streams?: Record<string, unknown>[] };
  try {
    data = JSON.parse(text);
  } catch {
    throw new CliError("Invalid selected-stream metadata JSON.", {
      code: "FRAME_METADATA_INVALID",
    });
  }
  if (!data || typeof data !== "object" || !Array.isArray(data.streams))
    throw new CliError("Missing selected video streams.", { code: "FRAME_METADATA_INVALID" });
  const indexes = new Set<number>();
  for (const stream of data.streams) {
    if (!stream || typeof stream !== "object" || Array.isArray(stream))
      throw new CliError("Invalid stream metadata.", { code: "FRAME_METADATA_INVALID" });
    const index = number(stream.index, "index");
    if (indexes.has(index))
      throw new CliError("Duplicate stream index.", { code: "FRAME_METADATA_INVALID" });
    indexes.add(index);
    const flags = stream.disposition;
    if (flags !== undefined) {
      if (!flags || typeof flags !== "object" || Array.isArray(flags))
        throw new CliError("Invalid stream disposition.", { code: "FRAME_METADATA_INVALID" });
      for (const key of ["default", "attached_pic", "timed_thumbnails"]) {
        const value = (flags as Record<string, unknown>)[key];
        if (value !== undefined && value !== 0 && value !== 1)
          throw new CliError("Invalid stream disposition flag.", {
            code: "FRAME_METADATA_INVALID",
          });
      }
    }
  }
  const eligible = data.streams.filter(
    (s) =>
      s.codec_type === "video" &&
      !(s.disposition as Record<string, number> | undefined)?.attached_pic &&
      !(s.disposition as Record<string, number> | undefined)?.timed_thumbnails,
  );
  eligible.forEach((s) => number(s.index, "index"));
  eligible.sort(
    (a, b) =>
      Number(Boolean((b.disposition as Record<string, number> | undefined)?.default)) -
        Number(Boolean((a.disposition as Record<string, number> | undefined)?.default)) ||
      Number(a.index) - Number(b.index),
  );
  const selected = eligible[0];
  if (!selected) throw new CliError("No eligible video stream.", { code: "FRAME_STREAM_MISSING" });
  const index = number(selected.index, "index"),
    width = number(selected.width, "width", 1),
    height = number(selected.height, "height", 1);
  if (BigInt(width) * BigInt(height) > BigInt(DECODER_PIXELS))
    throw new CliError(`Decoded image exceeds ${DECODER_PIXELS} pixels.`, {
      code: "FRAME_PIXEL_LIMIT",
    });
  if (typeof selected.codec_name !== "string" || !selected.codec_name)
    throw new CliError("Missing video codec.", { code: "FRAME_METADATA_INVALID" });
  const base = timeBase(selected.time_base),
    startTicks = optionalTicks(selected.start_pts),
    durationTicks = optionalTicks(selected.duration_ts);
  let estimatedFrameCount: number | undefined;
  if (selected.nb_frames !== undefined && selected.nb_frames !== "N/A") {
    const count =
      typeof selected.nb_frames === "string"
        ? wireInteger(selected.nb_frames)
        : optionalTicks(selected.nb_frames)!;
    if (count < 0n || count > BigInt(Number.MAX_SAFE_INTEGER))
      throw new CliError("Unsafe frame-count estimate.", { code: "FRAME_NUMERIC_LIMIT" });
    estimatedFrameCount = Number(count);
  }
  return Object.freeze({
    index,
    codec: selected.codec_name,
    width,
    height,
    pixelFormat: typeof selected.pix_fmt === "string" ? selected.pix_fmt : undefined,
    timeBase: base,
    startTicks,
    durationTicks,
    estimatedFrameCount,
    estimatedDurationMs:
      durationTicks !== undefined && durationTicks > 0n
        ? ticksToMs(durationTicks, base)
        : undefined,
    fingerprint: JSON.stringify(selected),
    eligibleStreams: eligible.length,
    sourceAlpha: declaredAlpha(selected.tags),
    image: Object.freeze({
      sampleAspectRatio: optionalText(selected.sample_aspect_ratio),
      colorRange: optionalText(selected.color_range),
      colorSpace: optionalText(selected.color_space),
      colorPrimaries: optionalText(selected.color_primaries),
      colorTransfer: optionalText(selected.color_transfer),
      display: Object.freeze(
        Array.isArray(selected.side_data_list)
          ? selected.side_data_list
              .filter((side) => side?.side_data_type === "Display Matrix")
              .map((side) =>
                Object.freeze({
                  matrix: optionalText(side.displaymatrix),
                  rotation: typeof side.rotation === "number" ? side.rotation : undefined,
                }),
              )
          : [],
      ),
    }),
  });
}
function optionalText(value: unknown): string | undefined {
  if (value === undefined) return;
  if (typeof value !== "string")
    throw new CliError("Invalid image metadata field.", { code: "FRAME_METADATA_INVALID" });
  return value;
}
function declaredAlpha(tags: unknown): boolean | undefined {
  if (tags === undefined) return;
  if (!tags || typeof tags !== "object" || Array.isArray(tags))
    throw new CliError("Invalid source alpha metadata.", { code: "FRAME_METADATA_INVALID" });
  const value = (tags as Record<string, unknown>).alpha_mode;
  if (value === undefined) return;
  if (value !== "0" && value !== "1")
    throw new CliError("Invalid source alpha declaration.", { code: "FRAME_METADATA_INVALID" });
  return value === "1";
}
export async function inspectVideo(
  operation: ProcessOperation,
  source: string,
  ffprobe = "ffprobe",
): Promise<VideoStream> {
  const result = await operation.run(ffprobe, [
    "-v",
    "error",
    "-max_pixels",
    String(DECODER_PIXELS),
    "-threads",
    "1",
    "-select_streams",
    "V",
    "-show_entries",
    METADATA_FIELDS,
    "-of",
    "json",
    source,
  ]);
  requireClean(result, "Video inspection");
  return parseMetadata(result.stdout.toString("utf8"));
}
export function parseFrameRecord(line: string, expectedStream: number): FrameRecord | undefined {
  if (!line) return;
  const parts = line.split("|");
  if (parts.shift() !== "frame")
    throw new CliError("Unexpected frame record.", { code: "FRAME_RECORD_INVALID" });
  const fields: Record<string, string> = Object.create(null);
  for (const part of parts) {
    if (!part) continue;
    const equal = part.indexOf("=");
    const key = part.slice(0, equal);
    if (equal < 1 || !FRAME_KEYS.has(key) || key in fields || part.includes("\\"))
      throw new CliError("Invalid selected frame fields.", { code: "FRAME_RECORD_INVALID" });
    fields[key] = part.slice(equal + 1);
  }
  if (fields.stream_index !== String(expectedStream))
    throw new CliError("Frame record belongs to another stream.", { code: "FRAME_STREAM_CHANGED" });
  const timestamp =
    fields.best_effort_timestamp && fields.best_effort_timestamp !== "N/A"
      ? fields.best_effort_timestamp
      : fields.pts;
  const startTicks = timestamp && timestamp !== "N/A" ? wireInteger(timestamp) : undefined;
  const duration =
    fields.duration && fields.duration !== "N/A" ? wireInteger(fields.duration) : undefined;
  return {
    streamIndex: expectedStream,
    startTicks,
    durationTicks: duration !== undefined && duration > 0n ? duration : undefined,
    width: frameDimension(fields.width),
    height: frameDimension(fields.height),
    pixelFormat: fields.pix_fmt,
    image: {
      sampleAspectRatio: fields.sample_aspect_ratio,
      colorRange: fields.color_range,
      colorSpace: fields.color_space,
      colorPrimaries: fields.color_primaries,
      colorTransfer: fields.color_transfer,
    },
  };
}
function frameDimension(text: string | undefined): number | undefined {
  if (text === undefined) return;
  const value = wireInteger(text);
  if (value < 1n || value > BigInt(Number.MAX_SAFE_INTEGER))
    throw new CliError("Invalid displayed frame dimensions.", { code: "FRAME_RECORD_INVALID" });
  return Number(value);
}
